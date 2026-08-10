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

export type LoginNoticesConfig = {
  showBanner: boolean;
  bannerTitle: string | null;
  bannerSubtitle: string | null;
  customUpdates: string[];
  /** When custom updates exist, still append auto admissions/session lines. Default true. */
  includeAutoUpdates: boolean;
  includeAdmissions: boolean;
  includeAcademicSession: boolean;
  includeNepHint: boolean;
};

function normalizeLoginNotices(raw: unknown): LoginNoticesConfig {
  const o = (raw ?? {}) as Record<string, unknown>;
  const custom = Array.isArray(o.customUpdates)
    ? (o.customUpdates as unknown[])
        .map((x) => String(x ?? '').trim())
        .filter(Boolean)
    : typeof o.customUpdates === 'string'
      ? String(o.customUpdates)
          .split('\n')
          .map((x) => x.trim())
          .filter(Boolean)
      : [];
  return {
    showBanner: o.showBanner !== false,
    bannerTitle:
      typeof o.bannerTitle === 'string' && o.bannerTitle.trim()
        ? o.bannerTitle.trim()
        : null,
    bannerSubtitle:
      typeof o.bannerSubtitle === 'string' && o.bannerSubtitle.trim()
        ? o.bannerSubtitle.trim()
        : null,
    customUpdates: custom,
    includeAutoUpdates: o.includeAutoUpdates !== false,
    includeAdmissions: o.includeAdmissions !== false,
    includeAcademicSession: o.includeAcademicSession !== false,
    includeNepHint: o.includeNepHint === true,
  };
}

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
    if (dto.loginNotices !== undefined) data.loginNotices = dto.loginNotices;
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
      const notices = normalizeLoginNotices((settings as any).loginNotices);
      const autoUpdates: string[] = [];
      if (notices.includeAdmissions !== false && openIntake) {
        autoUpdates.push(`Admissions open — ${openIntake.name}`);
      }
      if (notices.includeAcademicSession !== false && academicYear?.name) {
        autoUpdates.push(`Academic session ${academicYear.name} active`);
      }
      if (notices.includeNepHint) {
        autoUpdates.push('NEP 2020 curriculum enabled');
      }
      const customUpdates = notices.customUpdates;
      const updates =
        customUpdates.length > 0
          ? notices.includeAutoUpdates === false
            ? customUpdates
            : [...customUpdates, ...autoUpdates]
          : autoUpdates.length > 0
            ? autoUpdates
            : ['Campus updates will appear here'];

      const isMaintenance = isStudent
        ? settings.studentMaintenanceMode
        : settings.staffMaintenanceMode;

      return {
        appType,
        appName: isStudent ? settings.studentAppName : settings.staffAppName,
        configVersion: (settings as any).configVersion ?? 1,
        ...versions,
        maintenanceMode: isMaintenance,
        maintenanceMessage: isMaintenance
          ? (settings.maintenanceMessage ??
            'The system is currently undergoing scheduled maintenance. Please try again later.')
          : (settings.maintenanceMessage ?? null),
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
          productName: branding?.productName ?? null,
          productTagline: branding?.productTagline ?? null,
          poweredByText: branding?.poweredByText ?? null,
          showPoweredBy: branding?.showPoweredBy ?? true,
        },
        loginNotices: {
          showBanner: notices.showBanner,
          bannerTitle: notices.bannerTitle,
          bannerSubtitle: notices.bannerSubtitle,
        },
        portalHighlights: {
          stats: {
            students: studentCount,
            faculty: facultyCount,
            departments: departmentCount,
            academicYear: academicYear?.name ?? null,
          },
          updates,
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
