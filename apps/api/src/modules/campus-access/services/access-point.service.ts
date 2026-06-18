import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { hashKioskToken } from '../utils/kiosk-token.util';

@Injectable()
export class AccessPointService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.accessPoint.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { name: 'asc' },
      include: {
        devices: {
          where: { active: true },
          select: {
            id: true,
            name: true,
            tokenPrefix: true,
            lastSeenAt: true,
            active: true,
          },
        },
        _count: { select: { logs: true } },
      },
    });
  }

  async getById(tenantId: string, id: string) {
    const row = await this.prisma.accessPoint.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        devices: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            tokenPrefix: true,
            lastSeenAt: true,
            active: true,
            createdAt: true,
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Access point not found');
    return row;
  }

  create(
    tenantId: string,
    dto: {
      code: string;
      name: string;
      accessType: string;
      location?: string;
      blockOnFine?: boolean;
      blockInactive?: boolean;
      attendanceMode?: boolean;
      voiceEnabled?: boolean;
    },
  ) {
    const code = dto.code.trim().toLowerCase();
    return this.prisma.accessPoint.create({
      data: {
        tenantId,
        code,
        name: dto.name.trim(),
        accessType: dto.accessType.toUpperCase(),
        location: dto.location?.trim() || null,
        blockOnFine: dto.blockOnFine ?? false,
        blockInactive: dto.blockInactive ?? true,
        attendanceMode: dto.attendanceMode ?? false,
        voiceEnabled: dto.voiceEnabled ?? true,
      },
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: {
      name?: string;
      location?: string;
      active?: boolean;
      blockOnFine?: boolean;
      blockInactive?: boolean;
      attendanceMode?: boolean;
      voiceEnabled?: boolean;
    },
  ) {
    await this.getById(tenantId, id);
    return this.prisma.accessPoint.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.location !== undefined
          ? { location: dto.location?.trim() || null }
          : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.blockOnFine !== undefined
          ? { blockOnFine: dto.blockOnFine }
          : {}),
        ...(dto.blockInactive !== undefined
          ? { blockInactive: dto.blockInactive }
          : {}),
        ...(dto.attendanceMode !== undefined
          ? { attendanceMode: dto.attendanceMode }
          : {}),
        ...(dto.voiceEnabled !== undefined
          ? { voiceEnabled: dto.voiceEnabled }
          : {}),
      },
    });
  }

  async resolveKioskContext(code: string, token: string) {
    const normalizedCode = code.trim().toLowerCase();
    const tokenHash = hashKioskToken(token);
    const device = await this.prisma.accessKioskDevice.findFirst({
      where: {
        tokenHash,
        active: true,
        accessPoint: {
          code: normalizedCode,
          active: true,
          deletedAt: null,
        },
      },
      include: {
        accessPoint: true,
      },
    });
    if (!device) {
      throw new UnauthorizedException('Invalid kiosk token or access point');
    }
    return device;
  }

  async touchDevice(deviceId: string) {
    await this.prisma.accessKioskDevice.update({
      where: { id: deviceId },
      data: { lastSeenAt: new Date() },
    });
  }

  async createDevice(
    tenantId: string,
    accessPointId: string,
    name: string,
    token: string,
    hash: string,
    prefix: string,
  ) {
    const point = await this.getById(tenantId, accessPointId);
    if (!point.active) {
      throw new BadRequestException('Access point is inactive');
    }
    return this.prisma.accessKioskDevice.create({
      data: {
        tenantId,
        accessPointId,
        name: name.trim(),
        tokenHash: hash,
        tokenPrefix: prefix,
      },
    });
  }

  revokeDevice(tenantId: string, deviceId: string) {
    return this.prisma.accessKioskDevice.updateMany({
      where: { id: deviceId, tenantId },
      data: { active: false },
    });
  }
}
