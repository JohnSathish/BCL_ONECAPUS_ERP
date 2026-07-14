import { createHash } from 'crypto';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { IpGeoService } from './ip-geo.service';

export type DeviceCaptureInput = {
  tenantId: string;
  userId: string;
  deviceId?: string | null;
  clientType?: string | null;
  appType?: string | null;
  appVersion?: string | null;
  deviceLabel?: string | null;
  deviceModel?: string | null;
  model?: string | null;
  manufacturer?: string | null;
  brand?: string | null;
  platform?: string | null;
  osVersion?: string | null;
  browserName?: string | null;
  browserVersion?: string | null;
  screenResolution?: string | null;
  language?: string | null;
  timeZone?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  countryHint?: string | null;
  mobileDeviceId?: string | null;
  geoLookupEnabled?: boolean;
};

export type ParsedUa = {
  browserName: string | null;
  browserVersion: string | null;
  platform: string | null;
  osVersion: string | null;
  deviceType: string | null;
};

@Injectable()
export class AccessDeviceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: IpGeoService,
  ) {}

  fingerprintFrom(
    deviceId: string | null | undefined,
    userAgent?: string | null,
  ) {
    const raw = (
      deviceId?.trim() ||
      userAgent?.slice(0, 120) ||
      'unknown'
    ).toLowerCase();
    return createHash('sha256').update(raw).digest('hex').slice(0, 48);
  }

  parseUserAgent(ua: string | null | undefined): ParsedUa {
    if (!ua) {
      return {
        browserName: null,
        browserVersion: null,
        platform: null,
        osVersion: null,
        deviceType: null,
      };
    }
    const browser =
      /Edg\/([\d.]+)/i.exec(ua) ??
      /Chrome\/([\d.]+)/i.exec(ua) ??
      /Firefox\/([\d.]+)/i.exec(ua) ??
      /Version\/([\d.]+).*Safari/i.exec(ua) ??
      /Safari\/([\d.]+)/i.exec(ua);
    let browserName: string | null = null;
    if (/Edg\//i.test(ua)) browserName = 'Edge';
    else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browserName = 'Chrome';
    else if (/Firefox\//i.test(ua)) browserName = 'Firefox';
    else if (/Safari\//i.test(ua)) browserName = 'Safari';

    let platform: string | null = null;
    let osVersion: string | null = null;
    if (/Android/i.test(ua)) {
      platform = 'Android';
      osVersion = /Android\s([\d.]+)/i.exec(ua)?.[1] ?? null;
    } else if (/iPhone|iPad|iOS/i.test(ua)) {
      platform = 'iOS';
      osVersion = /OS\s([\d_]+)/i.exec(ua)?.[1]?.replace(/_/g, '.') ?? null;
    } else if (/Windows NT/i.test(ua)) {
      platform = 'Windows';
      osVersion = /Windows NT\s([\d.]+)/i.exec(ua)?.[1] ?? null;
    } else if (/Mac OS X/i.test(ua)) {
      platform = 'macOS';
      osVersion =
        /Mac OS X\s([\d_]+)/i.exec(ua)?.[1]?.replace(/_/g, '.') ?? null;
    } else if (/Linux/i.test(ua)) {
      platform = 'Linux';
    }

    const deviceType = /Mobile|Android|iPhone/i.test(ua)
      ? 'MOBILE'
      : /iPad|Tablet/i.test(ua)
        ? 'TABLET'
        : 'DESKTOP';

    return {
      browserName,
      browserVersion: browser?.[1] ?? null,
      platform,
      osVersion,
      deviceType,
    };
  }

  async assertNotBlocked(
    tenantId: string,
    userId: string,
    deviceId?: string | null,
    userAgent?: string | null,
  ) {
    const fingerprint = this.fingerprintFrom(deviceId, userAgent);
    const row = await this.prisma.accessDevice.findUnique({
      where: {
        tenantId_userId_deviceFingerprint: {
          tenantId,
          userId,
          deviceFingerprint: fingerprint,
        },
      },
      select: { id: true, status: true, blockReason: true },
    });
    if (row?.status === 'BLOCKED') {
      throw new ForbiddenException(
        row.blockReason
          ? `${row.blockReason} Ask your college administrator to unblock this device.`
          : 'This device has been blocked by an administrator. Sign in from another device or ask them to unblock it.',
      );
    }
    return fingerprint;
  }

  async upsertFromLogin(input: DeviceCaptureInput) {
    const uaParsed = this.parseUserAgent(input.userAgent);
    const fingerprint = this.fingerprintFrom(input.deviceId, input.userAgent);
    const clientType = (
      input.clientType || (input.appType ? 'ANDROID' : 'WEB')
    ).toUpperCase();

    const geo = await this.geo.lookup(input.ipAddress, {
      enabled: input.geoLookupEnabled !== false,
      countryHint: input.countryHint,
    });

    const deviceName =
      input.deviceLabel ||
      input.deviceModel ||
      [input.brand, input.model].filter(Boolean).join(' ') ||
      (clientType === 'WEB'
        ? `${uaParsed.browserName ?? 'Browser'} on ${uaParsed.platform ?? 'Unknown'}`
        : 'Mobile device');

    const existing = await this.prisma.accessDevice.findUnique({
      where: {
        tenantId_userId_deviceFingerprint: {
          tenantId: input.tenantId,
          userId: input.userId,
          deviceFingerprint: fingerprint,
        },
      },
    });

    if (existing?.status === 'BLOCKED') {
      throw new ForbiddenException(
        existing.blockReason ||
          'This device has been blocked by an administrator',
      );
    }

    const isNew = !existing;
    const data = {
      clientType,
      deviceType:
        input.clientType === 'ANDROID' || clientType === 'ANDROID'
          ? 'MOBILE'
          : uaParsed.deviceType,
      deviceName,
      manufacturer: input.manufacturer ?? null,
      brand: input.brand ?? null,
      model: input.model ?? input.deviceModel ?? null,
      platform: input.platform ?? uaParsed.platform,
      osVersion: input.osVersion ?? uaParsed.osVersion,
      appVersion: input.appVersion ?? null,
      browserName: input.browserName ?? uaParsed.browserName,
      browserVersion: input.browserVersion ?? uaParsed.browserVersion,
      screenResolution: input.screenResolution ?? null,
      language: input.language ?? null,
      timeZone: input.timeZone ?? null,
      lastIp: input.ipAddress ?? null,
      lastIpMasked: this.geo.maskIp(input.ipAddress),
      lastCity: geo.city,
      lastRegion: geo.region,
      lastCountry: geo.country,
      lastIsp: geo.isp,
      lastSeenAt: new Date(),
      mobileDeviceId: input.mobileDeviceId ?? existing?.mobileDeviceId ?? null,
    };

    const row = existing
      ? await this.prisma.accessDevice.update({
          where: { id: existing.id },
          data: {
            ...data,
            loginCount: { increment: 1 },
          },
        })
      : await this.prisma.accessDevice.create({
          data: {
            tenantId: input.tenantId,
            userId: input.userId,
            deviceFingerprint: fingerprint,
            status: 'ACTIVE',
            loginCount: 1,
            firstSeenAt: new Date(),
            ...data,
          },
        });

    return { device: row, isNew, geo, fingerprint };
  }

  async getById(tenantId: string, id: string) {
    const row = await this.prisma.accessDevice.findFirst({
      where: { id, tenantId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            student: {
              select: {
                rollNumber: true,
                enrollmentNumber: true,
                department: { select: { name: true } },
                primaryShift: { select: { name: true, code: true } },
                programVersion: {
                  select: {
                    program: { select: { name: true, code: true } },
                  },
                },
              },
            },
            staffProfile: {
              select: {
                employeeCode: true,
                fullName: true,
                department: { select: { name: true } },
              },
            },
          },
        },
        mobileDevice: true,
      },
    });
    if (!row) throw new NotFoundException('Device not found');
    return row;
  }

  async block(tenantId: string, id: string, actorId: string, reason?: string) {
    const row = await this.getById(tenantId, id);
    const updated = await this.prisma.accessDevice.update({
      where: { id: row.id },
      data: {
        status: 'BLOCKED',
        blockedAt: new Date(),
        blockedById: actorId,
        blockReason: reason ?? 'Blocked by administrator',
      },
    });
    if (row.mobileDeviceId) {
      await this.prisma.mobileDevice.updateMany({
        where: { id: row.mobileDeviceId, tenantId },
        data: { status: 'BLOCKED' },
      });
    }
    return updated;
  }

  async unblock(tenantId: string, id: string) {
    const row = await this.getById(tenantId, id);
    const updated = await this.prisma.accessDevice.update({
      where: { id: row.id },
      data: {
        status: 'ACTIVE',
        blockedAt: null,
        blockedById: null,
        blockReason: null,
      },
    });
    if (row.mobileDeviceId) {
      await this.prisma.mobileDevice.updateMany({
        where: { id: row.mobileDeviceId, tenantId },
        data: { status: 'ACTIVE' },
      });
    }
    return updated;
  }

  async trust(tenantId: string, id: string) {
    const row = await this.getById(tenantId, id);
    if (row.status === 'BLOCKED') {
      throw new ForbiddenException('Unblock the device before trusting it');
    }
    return this.prisma.accessDevice.update({
      where: { id: row.id },
      data: { status: 'TRUSTED' },
    });
  }

  async clearTrustedForUser(tenantId: string, userId: string) {
    const result = await this.prisma.accessDevice.updateMany({
      where: { tenantId, userId, status: 'TRUSTED' },
      data: { status: 'ACTIVE' },
    });
    return { cleared: result.count };
  }
}
