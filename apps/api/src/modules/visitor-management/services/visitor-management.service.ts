import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class VisitorManagementService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async checkIn(
    user: JwtUser,
    dto: {
      visitorName: string;
      phone?: string;
      photoUrl?: string;
      vehicleNumber?: string;
      hostUserId?: string;
      hostName?: string;
      purpose?: string;
    },
  ) {
    const passCode = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    const qrToken = randomUUID();
    return this.db().visitorVisit.create({
      data: {
        tenantId: user.tid,
        visitorName: dto.visitorName.trim(),
        phone: dto.phone,
        photoUrl: dto.photoUrl,
        vehicleNumber: dto.vehicleNumber,
        hostUserId: dto.hostUserId ?? user.sub,
        hostName: dto.hostName,
        purpose: dto.purpose,
        passCode,
        qrToken,
        status: 'CHECKED_IN',
        checkedInAt: new Date(),
      },
    });
  }

  async checkOut(tenantId: string, id: string) {
    const visit = await this.db().visitorVisit.findFirst({
      where: { id, tenantId },
    });
    if (!visit) throw new NotFoundException('Visit not found');
    return this.db().visitorVisit.update({
      where: { id },
      data: {
        status: 'CHECKED_OUT',
        checkedOutAt: new Date(),
      },
    });
  }

  async list(tenantId: string, status?: string) {
    return this.db().visitorVisit.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
      },
      orderBy: { checkedInAt: 'desc' },
      take: 200,
    });
  }
}
