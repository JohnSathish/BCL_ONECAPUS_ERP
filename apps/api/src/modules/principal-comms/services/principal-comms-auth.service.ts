import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
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

@Injectable()
export class PrincipalCommsAuthService {
  private readonly stateSecrets = new Map<string, OauthStatePayload>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly gmail: PrincipalCommsGmailClient,
    private readonly vault: PrincipalCommsTokenVault,
    private readonly audit: PrincipalCommsAuditService,
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
    const state = createHash('sha256')
      .update(`${tenantId}:${userId}:${nonce}`)
      .digest('hex');
    this.stateSecrets.set(state, {
      tenantId,
      userId,
      accountLabel,
      nonce,
      exp: Date.now() + 10 * 60 * 1000,
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
    const payload = this.stateSecrets.get(state);
    this.stateSecrets.delete(state);
    if (!payload || payload.exp < Date.now()) {
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

    return account;
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
}
