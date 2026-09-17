import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { SchoolMobileAccessService } from './school-mobile-access.service';
import type {
  PatchSchoolMobileDeviceDto,
  RegisterSchoolMobileDeviceDto,
} from './dto/school-mobile.dto';

const IP_RETENTION_DAYS = 90;

@Injectable()
export class SchoolMobileDeviceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: SchoolMobileAccessService,
  ) {}

  private publicRow<T extends { pushToken?: string | null }>(row: T) {
    const { pushToken: _hidden, ...rest } = row;
    void _hidden;
    return rest;
  }

  async register(
    user: JwtUser,
    dto: RegisterSchoolMobileDeviceDto,
    ip?: string,
  ) {
    const persona = this.access.assertAccess(user);
    const existing = await this.prisma.schoolMobileDevice.findUnique({
      where: {
        tenantId_deviceId: { tenantId: user.tid, deviceId: dto.deviceId },
      },
    });
    if (existing?.deviceStatus === 'BLOCKED') {
      throw new ForbiddenException('DEVICE_BLOCKED');
    }
    const now = new Date();
    const isNew = !existing;
    const ipChanged = Boolean(
      ip && existing?.lastIpAddress && existing.lastIpAddress !== ip,
    );
    const pushEnabled = Boolean(dto.pushToken ?? dto.pushCapability);
    const row = await this.prisma.schoolMobileDevice.upsert({
      where: {
        tenantId_deviceId: { tenantId: user.tid, deviceId: dto.deviceId },
      },
      create: {
        id: randomUUID(),
        tenantId: user.tid,
        userId: user.sub,
        deviceId: dto.deviceId,
        platform: dto.platform,
        persona,
        appVersion: dto.appVersion ?? null,
        pushToken: dto.pushToken ?? null,
        deviceLabel: dto.deviceLabel ?? dto.deviceName ?? null,
        deviceModel: dto.deviceModel ?? null,
        osVersion: dto.osVersion ?? null,
        manufacturer: dto.manufacturer ?? null,
        deviceName: dto.deviceName ?? null,
        buildNumber: dto.buildNumber ?? null,
        screenResolution: dto.screenResolution ?? null,
        timezone: dto.timezone ?? null,
        locale: dto.locale ?? null,
        networkType: dto.networkType ?? null,
        lastIpAddress: ip ?? null,
        deviceStatus: 'ACTIVE',
        pushEnabled,
        biometricEnabled: dto.biometricEnabled ?? false,
        lastTokenRefreshAt: dto.pushToken ? now : null,
        lastActiveAt: now,
        lastLoginAt: now,
        lastSyncAt: now,
      },
      update: {
        userId: user.sub,
        platform: dto.platform,
        persona,
        appVersion: dto.appVersion ?? undefined,
        pushToken: dto.pushToken ?? undefined,
        deviceLabel: dto.deviceLabel ?? dto.deviceName ?? undefined,
        deviceModel: dto.deviceModel ?? undefined,
        osVersion: dto.osVersion ?? undefined,
        manufacturer: dto.manufacturer ?? undefined,
        deviceName: dto.deviceName ?? undefined,
        buildNumber: dto.buildNumber ?? undefined,
        screenResolution: dto.screenResolution ?? undefined,
        timezone: dto.timezone ?? undefined,
        locale: dto.locale ?? undefined,
        networkType: dto.networkType ?? undefined,
        previousIpAddress: ipChanged ? existing!.lastIpAddress : undefined,
        lastIpAddress: ip ?? undefined,
        deviceStatus: 'ACTIVE',
        pushEnabled:
          dto.pushToken !== undefined ? Boolean(dto.pushToken) : undefined,
        biometricEnabled: dto.biometricEnabled ?? undefined,
        lastTokenRefreshAt: dto.pushToken ? now : undefined,
        lastActiveAt: now,
        lastSyncAt: now,
        revokedAt: null,
        revokeReason: null,
        signedOutAt: null,
      },
    });
    if (ip) {
      await this.recordIp(user.tid, row.id, user.sub, ip, dto.networkType);
    }
    if (isNew) {
      await this.prisma.schoolDeviceSecurityEvent.create({
        data: {
          id: randomUUID(),
          tenantId: user.tid,
          deviceRowId: row.id,
          userId: user.sub,
          eventType: 'NEW_DEVICE',
          description: 'User signed in from a new device',
          ipAddress: ip ?? null,
        },
      });
    }
    const activeCount = await this.prisma.schoolMobileDevice.count({
      where: {
        tenantId: user.tid,
        userId: user.sub,
        deviceStatus: 'ACTIVE',
        revokedAt: null,
      },
    });
    if (activeCount > 1) {
      await this.prisma.schoolDeviceSecurityEvent.create({
        data: {
          id: randomUUID(),
          tenantId: user.tid,
          deviceRowId: row.id,
          userId: user.sub,
          eventType: 'MULTIPLE_DEVICES',
          description: `User currently has ${activeCount} active devices`,
          ipAddress: ip ?? null,
          metadata: { count: activeCount },
        },
      });
    }
    return this.publicRow(row);
  }

  async heartbeat(
    user: JwtUser,
    dto: { deviceId: string; networkType?: string },
    ip?: string,
  ) {
    this.access.assertAccess(user);
    const row = await this.prisma.schoolMobileDevice.findFirst({
      where: { tenantId: user.tid, deviceId: dto.deviceId, userId: user.sub },
    });
    if (!row) return { ok: true };
    if (row.deviceStatus === 'BLOCKED')
      throw new ForbiddenException('DEVICE_BLOCKED');
    if (row.deviceStatus === 'REVOKED' || row.revokedAt) {
      throw new ForbiddenException('SESSION_REVOKED');
    }
    const ipChanged = Boolean(
      ip && row.lastIpAddress && row.lastIpAddress !== ip,
    );
    await this.prisma.schoolMobileDevice.update({
      where: { id: row.id },
      data: {
        lastActiveAt: new Date(),
        lastSyncAt: new Date(),
        networkType: dto.networkType ?? undefined,
        previousIpAddress: ipChanged ? row.lastIpAddress : undefined,
        lastIpAddress: ip ?? undefined,
      },
    });
    if (ip)
      await this.recordIp(user.tid, row.id, user.sub, ip, dto.networkType);
    return { ok: true };
  }

  async update(
    user: JwtUser,
    deviceId: string,
    dto: PatchSchoolMobileDeviceDto,
  ) {
    this.access.assertAccess(user);
    const row = await this.prisma.schoolMobileDevice.findFirst({
      where: {
        tenantId: user.tid,
        deviceId,
        userId: user.sub,
      },
    });
    if (!row) throw new NotFoundException('Device not found');
    if (row.deviceStatus === 'BLOCKED')
      throw new ForbiddenException('DEVICE_BLOCKED');
    const updated = await this.prisma.schoolMobileDevice.update({
      where: { id: row.id },
      data: {
        ...(dto.appVersion !== undefined ? { appVersion: dto.appVersion } : {}),
        ...(dto.pushToken !== undefined
          ? { pushToken: dto.pushToken, pushEnabled: Boolean(dto.pushToken) }
          : {}),
        ...(dto.deviceLabel !== undefined
          ? { deviceLabel: dto.deviceLabel }
          : {}),
        lastActiveAt: new Date(),
      },
    });
    return this.publicRow(updated);
  }

  async unregister(user: JwtUser, deviceId: string) {
    this.access.assertAccess(user);
    await this.prisma.schoolMobileDevice.updateMany({
      where: { tenantId: user.tid, deviceId, userId: user.sub },
      data: {
        revokedAt: new Date(),
        deviceStatus: 'SIGNED_OUT',
        signedOutAt: new Date(),
        pushToken: null,
        pushEnabled: false,
      },
    });
    return { ok: true };
  }

  async listMine(user: JwtUser, currentDeviceId?: string) {
    this.access.assertAccess(user);
    const rows = await this.prisma.schoolMobileDevice.findMany({
      where: { tenantId: user.tid, userId: user.sub },
      orderBy: { lastActiveAt: 'desc' },
    });
    return rows.map((row) => ({
      ...this.publicRow(row),
      thisDevice: currentDeviceId ? row.deviceId === currentDeviceId : false,
    }));
  }

  async revoke(user: JwtUser, id: string) {
    this.access.assertAccess(user);
    const row = await this.prisma.schoolMobileDevice.findFirst({
      where: { id, tenantId: user.tid, userId: user.sub },
    });
    if (!row) throw new NotFoundException('Session not found');
    const now = new Date();
    await this.prisma.schoolMobileDevice.update({
      where: { id: row.id },
      data: {
        deviceStatus: 'SIGNED_OUT',
        signedOutAt: now,
        lastLogoutAt: now,
        pushToken: null,
        pushEnabled: false,
      },
    });
    const sessions = await this.prisma.refreshSession.findMany({
      where: { tenantId: user.tid, userId: user.sub, revokedAt: null },
      select: { id: true, metadata: true },
    });
    const ids = sessions
      .filter(
        (s) =>
          ((s.metadata ?? {}) as { deviceId?: string }).deviceId ===
          row.deviceId,
      )
      .map((s) => s.id);
    if (ids.length) {
      await this.prisma.refreshSession.updateMany({
        where: { id: { in: ids } },
        data: { revokedAt: now },
      });
    }
    return { ok: true };
  }

  async signOutOthers(user: JwtUser, keepDeviceId: string) {
    this.access.assertAccess(user);
    const others = await this.prisma.schoolMobileDevice.findMany({
      where: {
        tenantId: user.tid,
        userId: user.sub,
        deviceId: { not: keepDeviceId },
        deviceStatus: { notIn: ['BLOCKED'] },
      },
    });
    const now = new Date();
    for (const row of others) {
      await this.prisma.schoolMobileDevice.update({
        where: { id: row.id },
        data: {
          deviceStatus: 'SIGNED_OUT',
          signedOutAt: now,
          lastLogoutAt: now,
          pushToken: null,
          pushEnabled: false,
        },
      });
    }
    const sessions = await this.prisma.refreshSession.findMany({
      where: { tenantId: user.tid, userId: user.sub, revokedAt: null },
      select: { id: true, metadata: true },
    });
    const ids = sessions
      .filter(
        (s) =>
          ((s.metadata ?? {}) as { deviceId?: string }).deviceId !==
          keepDeviceId,
      )
      .map((s) => s.id);
    if (ids.length) {
      await this.prisma.refreshSession.updateMany({
        where: { id: { in: ids } },
        data: { revokedAt: now },
      });
    }
    return { ok: true, count: others.length };
  }

  private async recordIp(
    tenantId: string,
    deviceRowId: string,
    userId: string,
    ip: string,
    networkType?: string,
  ) {
    const recent = await this.prisma.schoolDeviceIpHistory.findFirst({
      where: { tenantId, deviceRowId },
      orderBy: { observedAt: 'desc' },
    });
    if (
      recent &&
      recent.ipAddress === ip &&
      Date.now() - recent.observedAt.getTime() < 30 * 60_000
    ) {
      return;
    }
    await this.prisma.schoolDeviceIpHistory.create({
      data: {
        id: randomUUID(),
        tenantId,
        deviceRowId,
        userId,
        ipAddress: ip,
        networkType: networkType ?? null,
      },
    });
    await this.prisma.schoolDeviceIpHistory.deleteMany({
      where: {
        tenantId,
        deviceRowId,
        observedAt: {
          lt: new Date(Date.now() - IP_RETENTION_DAYS * 24 * 60 * 60_000),
        },
      },
    });
  }
}
