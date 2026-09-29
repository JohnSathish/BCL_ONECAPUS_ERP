import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { MobileAppUpdatePolicy } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../shared/cache/cache.service';
import { FcmPushService } from '../communication/services/fcm-push.service';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import type {
  SaveAppUpdatePolicyDto,
  SendAppUpdateNotificationDto,
} from './dto/app-update.dto';
import { compareVersions, isVersionBelow } from './utils/version.util';

export const APP_UPDATE_PLATFORMS = ['ANDROID', 'IOS'] as const;
export type AppUpdatePlatform = (typeof APP_UPDATE_PLATFORMS)[number];

export const DEFAULT_STORE_URLS: Record<AppUpdatePlatform, string> = {
  ANDROID: 'https://play.google.com/store/apps/details?id=edu.onecampus.mobile',
  IOS: 'https://apps.apple.com/app/id6798552213',
};

const PUBLIC_CACHE_TTL = 120;
const MEMO_TTL_MS = 30_000;
const NOTIFY_COOLDOWN_MS = 2 * 60_000;
const PUSH_CHUNK_SIZE = 25;
const PUSH_CONCURRENCY = 4;

export type PublicPlatformPolicy = {
  active: boolean;
  latestVersion: string | null;
  minimumVersion: string | null;
  forceUpdate: boolean;
  storeUrl: string;
  releaseTitle: string | null;
  releaseNotes: string[];
  releaseDate: string | null;
  updatedAt: string | null;
};

export type PublicAppVersionPayload = {
  android: PublicPlatformPolicy;
  ios: PublicPlatformPolicy;
  releaseTitle: string | null;
  releaseNotes: string[];
  releaseDate: string | null;
};

export function parseAppUpdatePlatform(
  raw: string | undefined | null,
): AppUpdatePlatform | null {
  const value = String(raw ?? '')
    .trim()
    .toUpperCase();
  if (value === 'ANDROID') return 'ANDROID';
  if (value === 'IOS') return 'IOS';
  return null;
}

/** Platform of a mobile request: explicit header first, then the native HTTP client's user agent. */
export function detectClientPlatform(
  platformHeader: string | undefined,
  userAgent: string | undefined,
): AppUpdatePlatform | null {
  const explicit = parseAppUpdatePlatform(platformHeader);
  if (explicit) return explicit;
  const ua = String(userAgent ?? '');
  if (/okhttp|android/i.test(ua)) return 'ANDROID';
  if (/cfnetwork|darwin|iphone|ipad|\bios\b/i.test(ua)) return 'IOS';
  return null;
}

/** Oldest version still allowed to use the app. Force update makes the latest version mandatory. */
export function effectiveMinimumVersion(policy: {
  latestVersion: string;
  minimumVersion: string;
  forceUpdate: boolean;
}): string {
  return policy.forceUpdate ? policy.latestVersion : policy.minimumVersion;
}

function normalizeNotes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x ?? '').trim()).filter(Boolean);
}

function toDateOnly(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function isAllowedStoreUrl(url: string) {
  return /^(https:\/\/|market:\/\/|itms-apps:\/\/)/i.test(url);
}

@Injectable()
export class AppUpdatePolicyService {
  private readonly logger = new Logger(AppUpdatePolicyService.name);
  private readonly memo = new Map<
    string,
    { expiresAt: number; value: MobileAppUpdatePolicy[] }
  >();
  private readonly sending = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly fcm: FcmPushService,
  ) {}

  private publicCacheKey(tenantId: string) {
    return `app-update:public:${tenantId}`;
  }

  private async loadPolicies(
    tenantId: string,
  ): Promise<MobileAppUpdatePolicy[]> {
    const hit = this.memo.get(tenantId);
    if (hit && hit.expiresAt > Date.now()) return hit.value;
    const value = await this.prisma.mobileAppUpdatePolicy.findMany({
      where: { tenantId },
    });
    this.memo.set(tenantId, { expiresAt: Date.now() + MEMO_TTL_MS, value });
    return value;
  }

  private async invalidate(tenantId: string) {
    this.memo.delete(tenantId);
    await this.cache.del(this.publicCacheKey(tenantId));
  }

  /** Active policy for a platform, or null when the admin has not enabled one. */
  async getActivePolicy(
    tenantId: string,
    platform: AppUpdatePlatform,
  ): Promise<MobileAppUpdatePolicy | null> {
    const rows = await this.loadPolicies(tenantId);
    return rows.find((r) => r.platform === platform && r.isActive) ?? null;
  }

  private toPublic(
    platform: AppUpdatePlatform,
    row: MobileAppUpdatePolicy | undefined,
  ): PublicPlatformPolicy {
    const active = Boolean(row?.isActive);
    return {
      active,
      latestVersion: active ? row!.latestVersion : null,
      minimumVersion: active ? row!.minimumVersion : null,
      forceUpdate: active ? row!.forceUpdate : false,
      storeUrl: row?.storeUrl?.trim() || DEFAULT_STORE_URLS[platform],
      releaseTitle: active ? (row!.releaseTitle ?? null) : null,
      releaseNotes: active ? normalizeNotes(row!.releaseNotes) : [],
      releaseDate: active ? toDateOnly(row!.releaseDate) : null,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
    };
  }

  async getPublicPayload(
    tenantId: string,
    platform: AppUpdatePlatform | null,
  ): Promise<PublicAppVersionPayload> {
    const base = await this.cache.wrap(
      this.publicCacheKey(tenantId),
      PUBLIC_CACHE_TTL,
      async () => {
        const rows = await this.loadPolicies(tenantId);
        return {
          android: this.toPublic(
            'ANDROID',
            rows.find((r) => r.platform === 'ANDROID'),
          ),
          ios: this.toPublic(
            'IOS',
            rows.find((r) => r.platform === 'IOS'),
          ),
        };
      },
    );
    const primary = platform === 'IOS' ? base.ios : base.android;
    return {
      ...base,
      releaseTitle: primary.releaseTitle,
      releaseNotes: primary.releaseNotes,
      releaseDate: primary.releaseDate,
    };
  }

  private async deviceStats(tenantId: string) {
    const [all, withPush] = await Promise.all([
      this.prisma.mobileDevice.groupBy({
        by: ['platform', 'appVersion'],
        where: { tenantId, status: 'ACTIVE' },
        _count: { _all: true },
      }),
      this.prisma.mobileDevice.groupBy({
        by: ['platform', 'appVersion'],
        where: { tenantId, status: 'ACTIVE', pushToken: { not: null } },
        _count: { _all: true },
      }),
    ]);
    const pushKey = (p: string, v: string | null) => `${p}|${v ?? ''}`;
    const pushCounts = new Map(
      withPush.map((r) => [
        pushKey(r.platform.toLowerCase(), r.appVersion),
        r._count._all,
      ]),
    );
    const byPlatform: Record<
      AppUpdatePlatform,
      Array<{ version: string | null; devices: number; pushEnabled: number }>
    > = { ANDROID: [], IOS: [] };
    for (const row of all) {
      const platform = parseAppUpdatePlatform(row.platform);
      if (!platform) continue;
      byPlatform[platform].push({
        version: row.appVersion,
        devices: row._count._all,
        pushEnabled:
          pushCounts.get(pushKey(row.platform.toLowerCase(), row.appVersion)) ??
          0,
      });
    }
    for (const platform of APP_UPDATE_PLATFORMS) {
      byPlatform[platform].sort((a, b) =>
        compareVersions(b.version ?? '0', a.version ?? '0'),
      );
    }
    return byPlatform;
  }

  async listForAdmin(tenantId: string) {
    const [rows, stats] = await Promise.all([
      this.prisma.mobileAppUpdatePolicy.findMany({ where: { tenantId } }),
      this.deviceStats(tenantId),
    ]);
    return {
      pushConfigured: this.fcm.isConfigured(),
      defaults: DEFAULT_STORE_URLS,
      policies: APP_UPDATE_PLATFORMS.map((platform) => {
        const row = rows.find((r) => r.platform === platform);
        return {
          platform,
          exists: Boolean(row),
          latestVersion: row?.latestVersion ?? '1.0.0',
          minimumVersion: row?.minimumVersion ?? '1.0.0',
          forceUpdate: row?.forceUpdate ?? false,
          storeUrl: row?.storeUrl ?? null,
          releaseTitle: row?.releaseTitle ?? null,
          releaseNotes: normalizeNotes(row?.releaseNotes),
          releaseDate: toDateOnly(row?.releaseDate),
          isActive: row?.isActive ?? false,
          lastNotifiedAt: row?.lastNotifiedAt?.toISOString() ?? null,
          lastNotifiedVersion: row?.lastNotifiedVersion ?? null,
          lastNotifiedCount: row?.lastNotifiedCount ?? null,
          updatedAt: row?.updatedAt?.toISOString() ?? null,
          devices: stats[platform],
        };
      }),
    };
  }

  async save(
    user: JwtUser,
    platform: AppUpdatePlatform,
    dto: SaveAppUpdatePolicyDto,
  ) {
    const latestVersion = dto.latestVersion.trim();
    const minimumVersion = dto.minimumVersion.trim();
    if (compareVersions(minimumVersion, latestVersion) > 0) {
      throw new BadRequestException(
        'Minimum version cannot be higher than the latest version.',
      );
    }
    const storeUrl = dto.storeUrl?.trim() || null;
    if (storeUrl && !isAllowedStoreUrl(storeUrl)) {
      throw new BadRequestException(
        'Store URL must start with https://, market:// or itms-apps://',
      );
    }
    const releaseNotes = normalizeNotes(dto.releaseNotes ?? []);
    const data = {
      latestVersion,
      minimumVersion,
      forceUpdate: dto.forceUpdate,
      storeUrl,
      releaseTitle: dto.releaseTitle?.trim() || null,
      releaseNotes,
      releaseDate: dto.releaseDate ? new Date(dto.releaseDate) : null,
      isActive: dto.isActive,
      updatedById: user.sub,
    };
    await this.prisma.mobileAppUpdatePolicy.upsert({
      where: { tenantId_platform: { tenantId: user.tid, platform } },
      create: { id: randomUUID(), tenantId: user.tid, platform, ...data },
      update: data,
    });
    await this.invalidate(user.tid);
    const list = await this.listForAdmin(user.tid);
    return list.policies.find((p) => p.platform === platform)!;
  }

  async sendNotification(
    user: JwtUser,
    platform: AppUpdatePlatform,
    dto: SendAppUpdateNotificationDto,
  ) {
    const tenantId = user.tid;
    const lockKey = `${tenantId}:${platform}`;
    const policy = await this.prisma.mobileAppUpdatePolicy.findUnique({
      where: { tenantId_platform: { tenantId, platform } },
    });
    if (!policy?.isActive) {
      throw new BadRequestException(
        'Save and activate this platform’s update before sending a notification.',
      );
    }
    if (!this.fcm.isConfigured()) {
      throw new BadRequestException(
        'Push notifications are not configured on the server (FCM).',
      );
    }
    if (
      this.sending.has(lockKey) ||
      (policy.lastNotifiedAt &&
        Date.now() - policy.lastNotifiedAt.getTime() < NOTIFY_COOLDOWN_MS)
    ) {
      throw new ConflictException(
        'An update notification was just sent. Please wait a couple of minutes before sending again.',
      );
    }

    const onlyOutdated = dto.onlyOutdated !== false;
    const devices = await this.prisma.mobileDevice.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        pushToken: { not: null },
        platform: { equals: platform.toLowerCase(), mode: 'insensitive' },
      },
      select: { pushToken: true, appVersion: true },
    });
    const tokens = [
      ...new Set(
        devices
          .filter(
            (d) =>
              !onlyOutdated ||
              !d.appVersion ||
              isVersionBelow(d.appVersion, policy.latestVersion),
          )
          .map((d) => d.pushToken!.trim())
          .filter(Boolean),
      ),
    ];

    const notes = normalizeNotes(policy.releaseNotes);
    const title = dto.title?.trim() || 'New OneCampus Update Available';
    const body =
      dto.body?.trim() ||
      `Version ${policy.latestVersion} is now available${
        notes.length ? ` with ${notes.slice(0, 3).join(', ')}` : ''
      }. Tap to update.`;
    const storeUrl = policy.storeUrl?.trim() || DEFAULT_STORE_URLS[platform];

    await this.prisma.mobileAppUpdatePolicy.update({
      where: { id: policy.id },
      data: {
        lastNotifiedAt: new Date(),
        lastNotifiedVersion: policy.latestVersion,
        lastNotifiedCount: 0,
      },
    });

    if (tokens.length) {
      this.sending.add(lockKey);
      void this.deliver(tenantId, policy.id, tokens, {
        title,
        body,
        data: {
          type: 'APP_UPDATE',
          platform,
          version: policy.latestVersion,
          storeUrl,
        },
      }).finally(() => this.sending.delete(lockKey));
    }

    return {
      queued: tokens.length,
      platform,
      version: policy.latestVersion,
      title,
      body,
    };
  }

  private async deliver(
    tenantId: string,
    policyId: string,
    tokens: string[],
    payload: { title: string; body: string; data: Record<string, string> },
  ) {
    const chunks: string[][] = [];
    for (let i = 0; i < tokens.length; i += PUSH_CHUNK_SIZE) {
      chunks.push(tokens.slice(i, i + PUSH_CHUNK_SIZE));
    }
    let delivered = 0;
    const invalid: string[] = [];
    let next = 0;
    const worker = async () => {
      while (next < chunks.length) {
        const chunk = chunks[next++];
        try {
          const result = await this.fcm.sendToTokens(chunk, payload);
          delivered += result.successCount ?? 0;
          if (result.invalidTokens?.length)
            invalid.push(...result.invalidTokens);
        } catch (err) {
          this.logger.warn(
            `App update push chunk failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    };
    try {
      await Promise.all(
        Array.from({ length: Math.min(PUSH_CONCURRENCY, chunks.length) }, () =>
          worker(),
        ),
      );
      if (invalid.length) {
        await this.prisma.mobileDevice.updateMany({
          where: { tenantId, pushToken: { in: invalid } },
          data: { pushToken: null },
        });
      }
      await this.prisma.mobileAppUpdatePolicy.update({
        where: { id: policyId },
        data: { lastNotifiedCount: delivered },
      });
      this.logger.log(
        `App update push: ${delivered}/${tokens.length} delivered (tenant ${tenantId})`,
      );
    } catch (err) {
      this.logger.error(
        `App update push failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
