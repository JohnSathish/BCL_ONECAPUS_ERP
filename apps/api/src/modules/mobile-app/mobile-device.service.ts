import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import type { RegisterDeviceDto, UpdateDeviceDto } from './dto/mobile-app.dto';

@Injectable()
export class MobileDeviceService {
  constructor(private readonly prisma: PrismaService) {}

  async register(user: JwtUser, dto: RegisterDeviceDto) {
    const blocked = await this.prisma.mobileDevice.findFirst({
      where: { tenantId: user.tid, deviceId: dto.deviceId, status: 'BLOCKED' },
    });
    if (blocked) {
      throw new ForbiddenException(
        'This device has been blocked by an administrator.',
      );
    }

    const device = await this.prisma.mobileDevice.upsert({
      where: {
        tenantId_deviceId: { tenantId: user.tid, deviceId: dto.deviceId },
      },
      create: {
        id: randomUUID(),
        tenantId: user.tid,
        userId: user.sub,
        appType: dto.appType,
        deviceId: dto.deviceId,
        platform: dto.platform,
        pushToken: dto.pushToken,
        appVersion: dto.appVersion,
        osVersion: dto.osVersion,
        deviceModel: dto.deviceModel,
        status: 'ACTIVE',
        lastSeenAt: new Date(),
      },
      update: {
        userId: user.sub,
        appType: dto.appType,
        platform: dto.platform,
        pushToken: dto.pushToken ?? undefined,
        appVersion: dto.appVersion ?? undefined,
        osVersion: dto.osVersion ?? undefined,
        deviceModel: dto.deviceModel ?? undefined,
        status: 'ACTIVE',
        lastSeenAt: new Date(),
      },
    });
    return device;
  }

  async update(user: JwtUser, deviceId: string, dto: UpdateDeviceDto) {
    const device = await this.prisma.mobileDevice.findFirst({
      where: { tenantId: user.tid, deviceId, userId: user.sub },
    });
    if (!device) throw new NotFoundException('Device not found');
    if (device.status === 'BLOCKED') {
      throw new ForbiddenException('This device has been blocked.');
    }
    return this.prisma.mobileDevice.update({
      where: { id: device.id },
      data: {
        pushToken: dto.pushToken ?? undefined,
        appVersion: dto.appVersion ?? undefined,
        osVersion: dto.osVersion ?? undefined,
        lastSeenAt: new Date(),
      },
    });
  }

  async unregister(user: JwtUser, deviceId: string) {
    const device = await this.prisma.mobileDevice.findFirst({
      where: { tenantId: user.tid, deviceId, userId: user.sub },
    });
    if (!device) return { success: true };
    await this.prisma.mobileDevice.update({
      where: { id: device.id },
      data: { status: 'REVOKED', pushToken: null },
    });
    return { success: true };
  }

  async blockDevice(tenantId: string, deviceId: string) {
    const device = await this.prisma.mobileDevice.findFirst({
      where: { tenantId, deviceId },
    });
    if (!device) throw new NotFoundException('Device not found');
    return this.prisma.mobileDevice.update({
      where: { id: device.id },
      data: { status: 'BLOCKED', pushToken: null },
    });
  }

  async listTokensForUser(tenantId: string, userId: string) {
    const devices = await this.prisma.mobileDevice.findMany({
      where: {
        tenantId,
        userId,
        status: 'ACTIVE',
        pushToken: { not: null },
      },
      select: { pushToken: true, platform: true, deviceId: true },
    });
    return devices
      .map((d) => d.pushToken)
      .filter((t): t is string => Boolean(t));
  }
}
