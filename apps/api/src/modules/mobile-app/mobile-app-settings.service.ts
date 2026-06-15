import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../shared/cache/cache.service';
import {
  DEFAULT_STAFF_DASHBOARD_CONFIG,
  DEFAULT_STUDENT_DASHBOARD_CONFIG,
  type MobileAppType,
} from './constants/dashboard-config';
import type { UpdateMobileAppSettingsDto } from './dto/mobile-app.dto';
import { isVersionBelow } from './utils/version.util';

const CACHE_TTL = 900;

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
    const updated = await this.prisma.mobileAppSettings.update({
      where: { tenantId },
      data: {
        studentAppName: dto.studentAppName,
        staffAppName: dto.staffAppName,
        studentMinVersion: dto.studentMinVersion,
        studentLatestVersion: dto.studentLatestVersion,
        staffMinVersion: dto.staffMinVersion,
        staffLatestVersion: dto.staffLatestVersion,
        studentMaintenanceMode: dto.studentMaintenanceMode,
        staffMaintenanceMode: dto.staffMaintenanceMode,
        maintenanceMessage: dto.maintenanceMessage,
        studentForceUpdate: dto.studentForceUpdate,
        staffForceUpdate: dto.staffForceUpdate,
        forceUpdateMessage: dto.forceUpdateMessage,
        studentDashboardConfig: dto.studentDashboardConfig as
          | object
          | undefined,
        staffDashboardConfig: dto.staffDashboardConfig as object | undefined,
        brandingOverrides: dto.brandingOverrides as object | undefined,
      },
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

  async getBootstrapPayload(tenantId: string, appType: MobileAppType) {
    const key = this.cacheKey(tenantId, appType);
    return this.cache.wrap(key, CACHE_TTL, async () => {
      const [settings, branding] = await Promise.all([
        this.getSettings(tenantId),
        this.prisma.tenantBranding.findUnique({ where: { tenantId } }),
      ]);
      const overrides = (settings.brandingOverrides ?? {}) as Record<
        string,
        string
      >;
      const isStudent = appType === 'STUDENT';
      return {
        appType,
        appName: isStudent ? settings.studentAppName : settings.staffAppName,
        minVersion: isStudent
          ? settings.studentMinVersion
          : settings.staffMinVersion,
        latestVersion: isStudent
          ? settings.studentLatestVersion
          : settings.staffLatestVersion,
        maintenanceMode: isStudent
          ? settings.studentMaintenanceMode
          : settings.staffMaintenanceMode,
        maintenanceMessage: settings.maintenanceMessage,
        forceUpdate: isStudent
          ? settings.studentForceUpdate
          : settings.staffForceUpdate,
        forceUpdateMessage: settings.forceUpdateMessage,
        branding: {
          logoUrl: overrides.logoUrl ?? branding?.logoUrl ?? null,
          splashImageUrl: overrides.splashImageUrl ?? null,
          primaryColor:
            overrides.primaryColor ?? branding?.primaryColor ?? null,
          displayName: branding?.displayName ?? null,
        },
      };
    });
  }

  async getConfigPayload(tenantId: string, appType: MobileAppType) {
    const settings = await this.getSettings(tenantId);
    const isStudent = appType === 'STUDENT';
    return {
      appType,
      dashboardCards: this.mergeDashboardConfig(
        isStudent
          ? settings.studentDashboardConfig
          : settings.staffDashboardConfig,
        isStudent
          ? DEFAULT_STUDENT_DASHBOARD_CONFIG
          : DEFAULT_STAFF_DASHBOARD_CONFIG,
      ),
      versions: {
        min: isStudent ? settings.studentMinVersion : settings.staffMinVersion,
        latest: isStudent
          ? settings.studentLatestVersion
          : settings.staffLatestVersion,
      },
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
          'The app is under maintenance. Please try again later.',
      };
    }
    const minVersion = isStudent
      ? settings.studentMinVersion
      : settings.staffMinVersion;
    const forceUpdate = isStudent
      ? settings.studentForceUpdate
      : settings.staffForceUpdate;
    if (appVersion && forceUpdate && minVersion) {
      if (isVersionBelow(appVersion, minVersion)) {
        return {
          blocked: true,
          statusCode: 426,
          message:
            settings.forceUpdateMessage ?? 'Please update the app to continue.',
          minVersion,
        };
      }
    }
    return { blocked: false };
  }
}
