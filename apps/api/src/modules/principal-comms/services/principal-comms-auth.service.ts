import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import { PrincipalCommsAuditService } from './principal-comms-audit.service';
import { PrincipalCommsGmailClient } from './principal-comms-gmail.client';
import {
  PrincipalCommsTokenVault,
  type StoredGoogleTokens,
} from './principal-comms-token-vault.service';

type OauthStatePayload = {
  tenantId: string;
  userId: string;
  accountLabel: string;
  nonce: string;
  exp: number;
};

/**
 * OAuth CSRF state must survive API restarts and multi-instance load balancing.
 * Previously this used an in-memory Map which caused "OAuth state expired or invalid"
 * whenever the process that started OAuth was not the one handling the callback.
 */
@Injectable()
export class PrincipalCommsAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gmail: PrincipalCommsGmailClient,
    private readonly vault: PrincipalCommsTokenVault,
    private readonly audit: PrincipalCommsAuditService,
    private readonly config: ConfigService,
  ) {}

  listAccounts(tenantId: string, ownerUserId: string) {
    return this.prisma.principalMailboxAccount.findMany({
      where: { tenantId, ownerUserId, deletedAt: null },
      select: {
        id: true,
        googleEmail: true,
        accountLabel: true,
        status: true,
        lastSyncedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async startOAuth(
    tenantId: string,
    userId: string,
    accountLabel: 'PERSONAL' | 'PRINCIPAL_OFFICE' = 'PERSONAL',
  ) {
    this.gmail.assertConfigured();
    const nonce = randomBytes(16).toString('hex');
    const state = this.signState({
      tenantId,
      userId,
      accountLabel,
      nonce,
      exp: Date.now() + 15 * 60 * 1000,
    });
    return {
      authUrl: this.gmail.buildAuthUrl(state),
      state,
    };
  }

  async handleOAuthCallback(
    code: string,
    state: string,
    meta?: { ip?: string; userAgent?: string },
  ) {
    if (!code?.trim() || !state?.trim()) {
      throw new ForbiddenException('OAuth state expired or invalid');
    }
    const payload = this.verifyState(state);
    if (!payload) {
      throw new ForbiddenException('OAuth state expired or invalid');
    }

    const tokens = await this.gmail.exchangeCode(code);
    const email = (tokens.email ?? '').toLowerCase();
    if (!email) throw new ForbiddenException('Could not resolve Google email');

    const encrypted = this.vault.encryptTokens({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
      tokenType: tokens.tokenType,
    });

    const account = await this.prisma.principalMailboxAccount.upsert({
      where: {
        tenantId_ownerUserId_googleEmail: {
          tenantId: payload.tenantId,
          ownerUserId: payload.userId,
          googleEmail: email,
        },
      },
      create: {
        tenantId: payload.tenantId,
        ownerUserId: payload.userId,
        googleEmail: email,
        accountLabel: payload.accountLabel,
        encryptedTokens: encrypted,
        scopes: tokens.scope ?? '',
        status: 'ACTIVE',
      },
      update: {
        encryptedTokens: encrypted,
        scopes: tokens.scope ?? '',
        accountLabel: payload.accountLabel,
        status: 'ACTIVE',
        deletedAt: null,
      },
    });

    await this.audit.log({
      tenantId: payload.tenantId,
      actorId: payload.userId,
      accountId: account.id,
      action: 'ACCOUNT_CONNECTED',
      entityType: 'account',
      entityId: account.id,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
      metadata: { googleEmail: email, accountLabel: payload.accountLabel },
    });

    await this.ensurePrincipalMailPushPref(payload.tenantId, payload.userId);

    return account;
  }

  /** Turn on principalMail push preference when first connecting a mailbox (never forces off). */
  private async ensurePrincipalMailPushPref(tenantId: string, userId: string) {
    const existing = await this.prisma.notificationPreference.findUnique({
      where: {
        tenantId_userId_channel: { tenantId, userId, channel: 'PUSH' },
      },
    });
    const settings = {
      ...((existing?.settings ?? {}) as Record<string, unknown>),
    };
    if (settings.principalMail === false) return;
    settings.principalMail = true;
    await this.prisma.notificationPreference.upsert({
      where: {
        tenantId_userId_channel: { tenantId, userId, channel: 'PUSH' },
      },
      create: {
        tenantId,
        userId,
        channel: 'PUSH',
        enabled: true,
        settings,
      },
      update: {
        enabled: existing?.enabled !== false,
        settings,
      },
    });
  }

  async disconnect(
    tenantId: string,
    ownerUserId: string,
    accountId: string,
    meta?: { ip?: string; userAgent?: string },
  ) {
    const account = await this.requireOwnedAccount(
      tenantId,
      ownerUserId,
      accountId,
    );
    await this.prisma.principalMailboxAccount.update({
      where: { id: account.id },
      data: {
        status: 'DISCONNECTED',
        encryptedTokens: '',
        deletedAt: new Date(),
      },
    });
    await this.audit.log({
      tenantId,
      actorId: ownerUserId,
      accountId: account.id,
      action: 'ACCOUNT_DISCONNECTED',
      entityType: 'account',
      entityId: account.id,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
    });
    return { ok: true };
  }

  async requireOwnedAccount(
    tenantId: string,
    ownerUserId: string,
    accountId: string,
  ) {
    const account = await this.prisma.principalMailboxAccount.findFirst({
      where: {
        id: accountId,
        tenantId,
        ownerUserId,
        deletedAt: null,
        status: 'ACTIVE',
      },
    });
    if (!account) throw new NotFoundException('Mailbox account not found');
    return account;
  }

  async getValidAccessToken(account: {
    id: string;
    encryptedTokens: string;
  }): Promise<string> {
    if (!account.encryptedTokens) {
      throw new ForbiddenException('Mailbox is disconnected');
    }
    let tokens = this.vault.decryptTokens(account.encryptedTokens);
    if (tokens.expiresAt > Date.now() + 60_000) {
      return tokens.accessToken;
    }
    const refreshed = await this.gmail.refreshAccessToken(tokens.refreshToken);
    tokens = {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      expiresAt: refreshed.expiresAt,
      scope: refreshed.scope,
      tokenType: refreshed.tokenType,
    } satisfies StoredGoogleTokens;
    await this.prisma.principalMailboxAccount.update({
      where: { id: account.id },
      data: { encryptedTokens: this.vault.encryptTokens(tokens) },
    });
    return tokens.accessToken;
  }

  private stateSigningKey(): string {
    return (
      this.config.get<string>('PRINCIPAL_COMMS_TOKEN_KEY') ||
      this.config.get<string>('ENCRYPTION_KEY') ||
      this.config.get<string>('JWT_SECRET') ||
      'principal-comms-oauth-dev-only'
    );
  }

  private signState(payload: OauthStatePayload): string {
    const body = Buffer.from(JSON.stringify(payload), 'utf8').toString(
      'base64url',
    );
    const sig = createHmac('sha256', this.stateSigningKey())
      .update(body)
      .digest('base64url');
    return `${body}.${sig}`;
  }

  private verifyState(state: string): OauthStatePayload | null {
    const dot = state.lastIndexOf('.');
    if (dot <= 0) return null;
    const body = state.slice(0, dot);
    const sig = state.slice(dot + 1);
    if (!body || !sig) return null;

    const expected = createHmac('sha256', this.stateSigningKey())
      .update(body)
      .digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return null;
    }

    try {
      const payload = JSON.parse(
        Buffer.from(body, 'base64url').toString('utf8'),
      ) as OauthStatePayload;
      if (
        !payload?.tenantId ||
        !payload?.userId ||
        !payload?.nonce ||
        typeof payload.exp !== 'number'
      ) {
        return null;
      }
      if (payload.exp < Date.now()) return null;
      return payload;
    } catch {
      return null;
    }
  }
}
