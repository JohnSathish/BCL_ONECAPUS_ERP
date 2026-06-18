import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';

@Injectable()
export class CommunicationAudienceSegmentService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.communicationAudienceSegment.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  create(
    user: JwtUser,
    data: {
      name: string;
      audienceType: string;
      filters: Record<string, unknown>;
    },
  ) {
    return this.prisma.communicationAudienceSegment.create({
      data: {
        tenantId: user.tid,
        name: data.name,
        audienceType: data.audienceType,
        filters: data.filters as Prisma.InputJsonValue,
        createdById: user.sub,
      },
    });
  }

  remove(user: JwtUser, id: string) {
    return this.prisma.communicationAudienceSegment.deleteMany({
      where: { id, tenantId: user.tid },
    });
  }
}
