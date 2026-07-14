import { Injectable, NotFoundException } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class HostelService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  listBlocks(tenantId: string) {
    return this.db().hostelBlock.findMany({
      where: { tenantId },
      include: { rooms: true },
      orderBy: { code: 'asc' },
    });
  }

  createBlock(
    user: JwtUser,
    dto: { code: string; name: string; gender?: string; capacity?: number },
  ) {
    return this.db().hostelBlock.create({
      data: {
        tenantId: user.tid,
        code: dto.code.trim(),
        name: dto.name.trim(),
        gender: dto.gender,
        capacity: dto.capacity ?? 0,
      },
    });
  }

  createRoom(
    user: JwtUser,
    dto: { blockId: string; roomNo: string; capacity?: number },
  ) {
    return this.db().hostelRoom.create({
      data: {
        tenantId: user.tid,
        blockId: dto.blockId,
        roomNo: dto.roomNo.trim(),
        capacity: dto.capacity ?? 2,
      },
    });
  }

  listAllotments(tenantId: string, roomId?: string) {
    return this.db().hostelAllotment.findMany({
      where: {
        tenantId,
        ...(roomId ? { roomId } : {}),
        status: 'ACTIVE',
      },
      include: { room: { include: { block: true } } },
      orderBy: { allottedAt: 'desc' },
    });
  }

  async allot(
    user: JwtUser,
    dto: { roomId: string; studentId: string; allottedAt?: string },
  ) {
    const room = await this.db().hostelRoom.findFirst({
      where: { id: dto.roomId, tenantId: user.tid },
    });
    if (!room) throw new NotFoundException('Room not found');
    return this.db().hostelAllotment.create({
      data: {
        tenantId: user.tid,
        roomId: dto.roomId,
        studentId: dto.studentId,
        allottedAt: dto.allottedAt ? new Date(dto.allottedAt) : new Date(),
        status: 'ACTIVE',
      },
    });
  }

  async vacate(tenantId: string, id: string) {
    const row = await this.db().hostelAllotment.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Allotment not found');
    return this.db().hostelAllotment.update({
      where: { id },
      data: { status: 'VACATED', vacatedAt: new Date() },
    });
  }
}
