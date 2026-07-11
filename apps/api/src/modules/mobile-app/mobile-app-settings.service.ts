import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../shared/cache/cache.service';
import {
  DEFAULT_MOBILE_FEATURE_FLAGS,
  DEFAULT_STAFF_DASHBOARD_CONFIG,
  DEFAULT_STUDENT_DASHBOARD_CONFIG,
  type MobileAppType,
} from './constants/dashboard-config';
import type { UpdateMobileAppSettingsDto } from './dto/mobile-app.dto';
import { toPublicUploadUrl } from '../../common/uploads/public-upload-url';
import { isVersionBelow } from './utils/version.util';

const CACHE_TTL = 900;

/** ICO/favicon URLs do not render in React Native — omit so the app uses its PNG fallback. */
function mobileBootstrapLogoUrl(
  overrides: Record<string, string>,
  brandingLogo: string | null | undefined,
): string | null {
  const raw = overrides.logoUrl ?? brandingLogo ?? null;
  if (!raw?.trim()) return null;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.endsWith('.ico') || trimmed.includes('favicon')) {
    return null;
  }
  return toPublicUploadUrl(raw) ?? raw;
}

@Injectable()
export class MobileAppSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  private cacheKey(tenantId: string, appType: MobileAppType) {
    return `mobile-app:config:${tenantId}:${appType}`;
  }

  async ensureDefaults(tenantId: string) {
    const existing = await this.prisma.mobileAppSettings.findUnique({
      where: { tenantId },
    });
    if (!existing) {
      await this.prisma.mobileAppSettings.create({
        data: {
          id: randomUUID(),
          tenantId,
          studentDashboardConfig: DEFAULT_STUDENT_DASHBOARD_CONFIG,
          staffDashboardConfig: DEFAULT_STAFF_DASHBOARD_CONFIG,
          featureFlags: DEFAULT_MOBILE_FEATURE_FLAGS,
          configVersion: 1,
        },
      });
    }
  }

  async getSettings(tenantId: string) {
    await this.ensureDefaults(tenantId);
    return this.prisma.mobileAppSettings.findUniqueOrThrow({
      where: { tenantId },
    });
  }

  async updateSettings(tenantId: string, dto: UpdateMobileAppSettingsDto) {
    await this.ensureDefaults(tenantId);
    const current = await this.getSettings(tenantId);
    const data: Record<string, unknown> = {
      configVersion: ((current as any).configVersion ?? 1) + 1,
    };
    if (dto.studentAppName !== undefined)
      data.studentAppName = dto.studentAppName;
    if (dto.staffAppName !== undefined) data.staffAppName = dto.staffAppName;
    if (dto.studentMinVersion !== undefined)
      data.studentMinVersion = dto.studentMinVersion;
    if (dto.studentLatestVersion !== undefined)
      data.studentLatestVersion = dto.studentLatestVersion;
    if (dto.staffMinVersion !== undefined)
      data.staffMinVersion = dto.staffMinVersion;
    if (dto.staffLatestVersion !== undefined)
      data.staffLatestVersion = dto.staffLatestVersion;
    if (dto.studentMaintenanceMode !== undefined)
      data.studentMaintenanceMode = dto.studentMaintenanceMode;
    if (dto.staffMaintenanceMode !== undefined)
      data.staffMaintenanceMode = dto.staffMaintenanceMode;
    if (dto.maintenanceMessage !== undefined)
      data.maintenanceMessage = dto.maintenanceMessage;
    if (dto.studentForceUpdate !== undefined)
      data.studentForceUpdate = dto.studentForceUpdate;
    if (dto.staffForceUpdate !== undefined)
      data.staffForceUpdate = dto.staffForceUpdate;
    if (dto.forceUpdateMessage !== undefined)
      data.forceUpdateMessage = dto.forceUpdateMessage;
    if (dto.studentDashboardConfig !== undefined)
      data.studentDashboardConfig = dto.studentDashboardConfig;
    if (dto.staffDashboardConfig !== undefined)
      data.staffDashboardConfig = dto.staffDashboardConfig;
    if (dto.brandingOverrides !== undefined)
      data.brandingOverrides = dto.brandingOverrides;
    if (dto.playStoreUrl !== undefined) data.playStoreUrl = dto.playStoreUrl;
    if (dto.apkDownloadUrl !== undefined)
      data.apkDownloadUrl = dto.apkDownloadUrl;
    if (dto.releaseNotes !== undefined) data.releaseNotes = dto.releaseNotes;
    if (dto.featureFlags !== undefined) data.featureFlags = dto.featureFlags;

    const updated = await this.prisma.mobileAppSettings.update({
      where: { tenantId },
      data: data as any,
    });
    await this.cache.delByPrefix(`mobile-app:config:${tenantId}:`);
    return updated;
  }

  mergeDashboardConfig(
    stored: unknown,
    defaults: Record<string, boolean>,
  ): Record<string, boolean> {
    const raw = (stored ?? {}) as Record<string, boolean>;
    return { ...defaults, ...raw };
  }

  mergeFeatureFlags(stored: unknown): Record<string, boolean> {
    const raw = (stored ?? {}) as Record<string, boolean>;
    return { ...DEFAULT_MOBILE_FEATURE_FLAGS, ...raw };
  }

  private versionBlock(settings: any, appType: MobileAppType) {
    const isStudent = appType === 'STUDENT';
    return {
      minVersion: isStudent
        ? settings.studentMinVersion
        : settings.staffMinVersion,
      latestVersion: isStudent
        ? settings.studentLatestVersion
        : settings.staffLatestVersion,
      forceUpdate: isStudent
        ? settings.studentForceUpdate
        : settings.staffForceUpdate,
      forceUpdateMessage:
        settings.forceUpdateMessage ??
        'A new version of BCL OneCampus is required to continue. Please update the application to access the latest features and security improvements.',
      softUpdateMessage:
        'A new version of BCL OneCampus is available. Update now to enjoy the latest features and improvements.',
      playStoreUrl: settings.playStoreUrl ?? null,
      apkDownloadUrl: settings.apkDownloadUrl ?? null,
      releaseNotes: settings.releaseNotes ?? null,
    };
  }

  async getBootstrapPayload(tenantId: string, appType: MobileAppType) {
    const key = this.cacheKey(tenantId, appType);
    return this.cache.wrap(key, CACHE_TTL, async () => {
      const [
        settings,
        branding,
        studentCount,
        facultyCount,
        departmentCount,
        academicYear,
        openIntake,
      ] = await Promise.all([
        this.getSettings(tenantId),
        this.prisma.tenantBranding.findUnique({ where: { tenantId } }),
        this.prisma.student.count({ where: { tenantId, deletedAt: null } }),
        this.prisma.staffProfile.count({
          where: { tenantId, deletedAt: null, status: 'ACTIVE' },
        }),
        this.prisma.department.count({ where: { tenantId, deletedAt: null } }),
        this.prisma.academicYear.findFirst({
          where: {
            tenantId,
            deletedAt: null,
            OR: [{ status: 'ACTIVE' }, { isPrimarySession: true }],
          },
          orderBy: { startDate: 'desc' },
          select: { name: true },
        }),
        this.prisma.admissionIntake.findFirst({
          where: {
            tenantId,
            deletedAt: null,
            status: { in: ['open', 'OPEN', 'active', 'ACTIVE'] },
          },
          select: { name: true },
        }),
      ]);
      const overrides = (settings.brandingOverrides ?? {}) as Record<
        string,
        string
      >;
      const isStudent = appType === 'STUDENT';
      const versions = this.versionBlock(settings, appType);
      const featureFlags = this.mergeFeatureFlags(
        (settings as any).featureFlags,
      );
      return {
        appType,
        appName: isStudent ? settings.studentAppName : settings.staffAppName,
        configVersion: (settings as any).configVersion ?? 1,
        ...versions,
        maintenanceMode: isStudent
          ? settings.studentMaintenanceMode
          : settings.staffMaintenanceMode,
        maintenanceMessage:
          settings.maintenanceMessage ??
          'The system is currently undergoing scheduled maintenance. Please try again later.',
        featureFlags,
        menuVisibility: featureFlags,
        branding: {
          logoUrl: mobileBootstrapLogoUrl(overrides, branding?.logoUrl ?? null),
          splashImageUrl: overrides.splashImageUrl
            ? (toPublicUploadUrl(overrides.splashImageUrl) ??
              overrides.splashImageUrl)
            : null,
          primaryColor:
            overrides.primaryColor ?? branding?.primaryColor ?? null,
          displayName: branding?.displayName ?? null,
        },
        portalHighlights: {
          stats: {
            students: studentCount,
            faculty: facultyCount,
            departments: departmentCount,
            academicYear: academicYear?.name ?? null,
          },
          updates: [
            ...(openIntake ? [`Admissions open — ${openIntake.name}`] : []),
            ...(academicYear?.name
              ? [`Academic session ${academicYear.name} active`]
              : []),
            'NEP 2020 curriculum enabled',
          ],
        },
      };
    });
  }

  async getConfigPayload(tenantId: string, appType: MobileAppType) {
    const settings = await this.getSettings(tenantId);
    const isStudent = appType === 'STUDENT';
    const featureFlags = this.mergeFeatureFlags((settings as any).featureFlags);
    const versions = this.versionBlock(settings, appType);
    return {
      appType,
      configVersion: (settings as any).configVersion ?? 1,
      dashboardCards: this.mergeDashboardConfig(
        isStudent
          ? settings.studentDashboardConfig
          : settings.staffDashboardConfig,
        isStudent
          ? DEFAULT_STUDENT_DASHBOARD_CONFIG
          : DEFAULT_STAFF_DASHBOARD_CONFIG,
      ),
      featureFlags,
      menuVisibility: featureFlags,
      ...versions,
      versions: {
        min: versions.minVersion,
        latest: versions.latestVersion,
      },
      maintenanceMode: isStudent
        ? settings.studentMaintenanceMode
        : settings.staffMaintenanceMode,
      maintenanceMessage: settings.maintenanceMessage,
    };
  }

  async checkGate(
    tenantId: string,
    appType: MobileAppType,
    appVersion?: string,
  ) {
    const settings = await this.getSettings(tenantId);
    const isStudent = appType === 'STUDENT';
    const maintenance = isStudent
      ? settings.studentMaintenanceMode
      : settings.staffMaintenanceMode;
    if (maintenance) {
      return {
        blocked: true,
        statusCode: 503,
        message:
          settings.maintenanceMessage ??
          'The system is currently undergoing scheduled maintenance. Please try again later.',
      };
    }
    const minVersion = isStudent
      ? settings.studentMinVersion
      : settings.staffMinVersion;
    const forceUpdate = isStudent
      ? settings.studentForceUpdate
      : settings.staffForceUpdate;
    if (appVersion && (forceUpdate || minVersion)) {
      if (isVersionBelow(appVersion, minVersion)) {
        return {
          blocked: true,
          statusCode: 426,
          message:
            settings.forceUpdateMessage ??
            'A new version of BCL OneCampus is required to continue. Please update the application to access the latest features and security improvements.',
          minVersion,
          playStoreUrl: (settings as any).playStoreUrl,
          apkDownloadUrl: (settings as any).apkDownloadUrl,
        };
      }
    }
    return { blocked: false };
  }
}
