import { Injectable, NotFoundException } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';

const DEFAULT_PROVIDERS = [
  { provider: 'DIGILOCKER', displayName: 'DigiLocker' },
  { provider: 'MOODLE', displayName: 'Moodle LMS' },
  { provider: 'TEAMS', displayName: 'Microsoft Teams' },
  { provider: 'OIDC_SSO', displayName: 'OpenID Connect SSO' },
] as const;

@Injectable()
export class IntegrationsService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  /** Seed default connectors (enabled false) if missing. */
  async listConnectors(tenantId: string) {
    const existing = await this.db().integrationConnector.findMany({
      where: { tenantId },
    });
    const byProvider = new Map(
      existing.map((r: { provider: string }) => [r.provider, r]),
    );
    const missing = DEFAULT_PROVIDERS.filter(
      (p) => !byProvider.has(p.provider),
    );
    if (missing.length) {
      await this.db().integrationConnector.createMany({
        data: missing.map((p) => ({
          tenantId,
          provider: p.provider,
          displayName: p.displayName,
          enabled: false,
          config: {},
        })),
        skipDuplicates: true,
      });
    }
    return this.db().integrationConnector.findMany({
      where: { tenantId },
      orderBy: { provider: 'asc' },
    });
  }

  async upsertConnector(
    user: JwtUser,
    dto: {
      provider: string;
      displayName?: string;
      enabled?: boolean;
      config?: Record<string, unknown>;
    },
  ) {
    const defaults = DEFAULT_PROVIDERS.find((p) => p.provider === dto.provider);
    return this.db().integrationConnector.upsert({
      where: {
        tenantId_provider: { tenantId: user.tid, provider: dto.provider },
      },
      create: {
        tenantId: user.tid,
        provider: dto.provider,
        displayName: dto.displayName ?? defaults?.displayName ?? dto.provider,
        enabled: dto.enabled ?? false,
        config: dto.config ?? {},
      },
      update: {
        ...(dto.displayName !== undefined
          ? { displayName: dto.displayName }
          : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.config !== undefined ? { config: dto.config } : {}),
      },
    });
  }

  async getOidcConfig(tenantId: string) {
    await this.listConnectors(tenantId);
    const row = await this.db().integrationConnector.findUnique({
      where: {
        tenantId_provider: { tenantId, provider: 'OIDC_SSO' },
      },
    });
    if (!row) throw new NotFoundException('OIDC_SSO connector not found');
    const config = (row.config ?? {}) as Record<string, unknown>;
    return {
      enabled: row.enabled,
      issuer: config.issuer ?? null,
      clientId: config.clientId ?? null,
      redirectUri: config.redirectUri ?? null,
      // never echo secret in GET unless present as masked
      hasClientSecret: Boolean(config.clientSecret),
    };
  }

  async setOidcConfig(
    user: JwtUser,
    dto: {
      issuer: string;
      clientId: string;
      clientSecret?: string;
      redirectUri: string;
      enabled?: boolean;
    },
  ) {
    const existing = await this.db().integrationConnector.findUnique({
      where: {
        tenantId_provider: { tenantId: user.tid, provider: 'OIDC_SSO' },
      },
    });
    const prev = (existing?.config ?? {}) as Record<string, unknown>;
    const config: Record<string, unknown> = {
      issuer: dto.issuer,
      clientId: dto.clientId,
      redirectUri: dto.redirectUri,
      clientSecret:
        dto.clientSecret !== undefined ? dto.clientSecret : prev.clientSecret,
    };
    return this.upsertConnector(user, {
      provider: 'OIDC_SSO',
      displayName: 'OpenID Connect SSO',
      enabled: dto.enabled ?? existing?.enabled ?? false,
      config,
    });
  }
}
