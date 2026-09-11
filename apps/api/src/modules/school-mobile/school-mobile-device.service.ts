import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { SchoolMobileAccessService } from './school-mobile-access.service';
import type {
  PatchSchoolMobileDeviceDto,
  RegisterSchoolMobileDeviceDto,
} from './dto/school-mobile.dto';

@Injectable()
export class SchoolMobileDeviceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: SchoolMobileAccessService,
  ) {}

  async register(user: JwtUser, dto: RegisterSchoolMobileDeviceDto) {
    const persona = this.access.assertAccess(user);
    const now = new Date();
    return this.prisma.schoolMobileDevice.upsert({
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
        deviceLabel: dto.deviceLabel ?? null,
        lastActiveAt: now,
      },
      update: {
        userId: user.sub,
        platform: dto.platform,
        persona,
        appVersion: dto.appVersion ?? undefined,
        pushToken: dto.pushToken ?? undefined,
        deviceLabel: dto.deviceLabel ?? undefined,
        lastActiveAt: now,
        revokedAt: null,
      },
    });
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
    return this.prisma.schoolMobileDevice.update({
      where: { id: row.id },
      data: {
        ...(dto.appVersion !== undefined ? { appVersion: dto.appVersion } : {}),
        ...(dto.pushToken !== undefined ? { pushToken: dto.pushToken } : {}),
        ...(dto.deviceLabel !== undefined
          ? { deviceLabel: dto.deviceLabel }
          : {}),
        lastActiveAt: new Date(),
      },
    });
  }

  async unregister(user: JwtUser, deviceId: string) {
    this.access.assertAccess(user);
    await this.prisma.schoolMobileDevice.updateMany({
      where: { tenantId: user.tid, deviceId, userId: user.sub },
      data: { revokedAt: new Date(), pushToken: null },
    });
    return { ok: true };
  }

  async listMine(user: JwtUser) {
    this.access.assertAccess(user);
    return this.prisma.schoolMobileDevice.findMany({
      where: { tenantId: user.tid, userId: user.sub },
      orderBy: { lastActiveAt: 'desc' },
    });
  }

  async revoke(user: JwtUser, id: string) {
    this.access.assertAccess(user);
    const row = await this.prisma.schoolMobileDevice.findFirst({
      where: { id, tenantId: user.tid, userId: user.sub },
    });
    if (!row) throw new NotFoundException('Session not found');
    await this.prisma.schoolMobileDevice.update({
      where: { id: row.id },
      data: { revokedAt: new Date(), pushToken: null },
    });
    return { ok: true };
  }
}
