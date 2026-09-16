import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { SchoolSisService } from '../school-sis/school-sis.service';
import {
  SCHOOL_MOBILE_APP_NAME,
  SCHOOL_MOBILE_TENANT_SLUG,
} from './school-mobile.constants';
import type { PatchSchoolMobileSettingsDto } from './dto/school-mobile.dto';
import { isSchoolMobileVersionBelow } from './school-mobile.util';

@Injectable()
export class SchoolMobileSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sis: SchoolSisService,
  ) {}

  async ensure(tenantId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const existing = await this.prisma.schoolMobileSettings.findUnique({
      where: { tenantId },
    });
    if (existing) return existing;
    return this.prisma.schoolMobileSettings.create({
      data: {
        id: randomUUID(),
        tenantId,
        androidLatestVersion: '1.0.0',
        iosLatestVersion: '1.0.0',
        minVersion: '1.0.0',
        extrasJson: {},
      },
    });
  }

  async getSettings(tenantId: string) {
    return this.ensure(tenantId);
  }

  async updateSettings(tenantId: string, dto: PatchSchoolMobileSettingsDto) {
    await this.ensure(tenantId);
    return this.prisma.schoolMobileSettings.update({
      where: { tenantId },
      data: {
        ...(dto.androidLatestVersion !== undefined
          ? { androidLatestVersion: dto.androidLatestVersion.trim() }
          : {}),
        ...(dto.iosLatestVersion !== undefined
          ? { iosLatestVersion: dto.iosLatestVersion.trim() }
          : {}),
        ...(dto.minVersion !== undefined
          ? { minVersion: dto.minVersion.trim() }
          : {}),
        ...(dto.forceUpdate !== undefined
          ? { forceUpdate: dto.forceUpdate }
          : {}),
        ...(dto.androidStoreUrl !== undefined
          ? { androidStoreUrl: dto.androidStoreUrl.trim() || null }
          : {}),
        ...(dto.iosStoreUrl !== undefined
          ? { iosStoreUrl: dto.iosStoreUrl.trim() || null }
          : {}),
        ...(dto.releaseNotes !== undefined
          ? { releaseNotes: dto.releaseNotes.trim() || null }
          : {}),
        ...(dto.maintenanceMode !== undefined
          ? { maintenanceMode: dto.maintenanceMode }
          : {}),
        ...(dto.maintenanceMessage !== undefined
          ? { maintenanceMessage: dto.maintenanceMessage.trim() || null }
          : {}),
      },
    });
  }

  async bootstrap(
    tenantId: string,
    input: { platform?: string; appVersion?: string },
  ) {
    const settings = await this.ensure(tenantId);
    const branding = await this.prisma.tenantBranding.findUnique({
      where: { tenantId },
    });
    const platform = (input.platform || 'android').toLowerCase();
    const latest =
      platform === 'ios'
        ? settings.iosLatestVersion
        : settings.androidLatestVersion;
    const current = input.appVersion?.trim() || '0.0.0';
    const belowMin = isSchoolMobileVersionBelow(current, settings.minVersion);
    const updateAvailable = isSchoolMobileVersionBelow(current, latest);
    return {
      appName: SCHOOL_MOBILE_APP_NAME,
      tenantSlug: SCHOOL_MOBILE_TENANT_SLUG,
      displayName: branding?.displayName ?? "St. Luke's Secondary School, Tura",
      motto: branding?.productTagline ?? 'Knowledge · Service · Light',
      logoUrl: branding?.logoUrl ?? '/school-sis/st-lukes-logo.png',
      primaryColor: branding?.primaryColor ?? '#1a237e',
      accentColor: branding?.accentColor ?? '#ffd400',
      androidLatestVersion: settings.androidLatestVersion,
      iosLatestVersion: settings.iosLatestVersion,
      minVersion: settings.minVersion,
      latestVersion: latest,
      forceUpdate: settings.forceUpdate || belowMin,
      updateAvailable,
      androidStoreUrl: settings.androidStoreUrl,
      iosStoreUrl: settings.iosStoreUrl,
      releaseNotes: settings.releaseNotes,
      maintenanceMode: settings.maintenanceMode,
      maintenanceMessage: settings.maintenanceMessage,
      privacyPolicyUrl: 'https://stlukestura.in/privacy',
      supportEmail: 'admin@stlukestura.in',
      product: 'school-sis',
      features: {
        transport: true,
        library: true,
        onlineFees: true,
        homework: true,
        chat: false,
        gpsTracking: false,
        hr: true,
        payroll: true,
      },
    };
  }
}
