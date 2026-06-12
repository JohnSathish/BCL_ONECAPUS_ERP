import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class OfferingSectionStreamsService {
  constructor(private readonly prisma: PrismaService) {}

  async syncForSection(
    tenantId: string,
    offeringSectionId: string,
    streamIds: string[] | undefined,
  ) {
    if (streamIds === undefined) return;

    const uniqueIds = [...new Set(streamIds.filter(Boolean))];
    if (uniqueIds.length === 0) {
      await this.prisma.offeringSectionStream.deleteMany({
        where: { offeringSectionId },
      });
      return;
    }

    const streams = await this.prisma.academicStream.findMany({
      where: {
        id: { in: uniqueIds },
        tenantId,
        deletedAt: null,
        isActive: true,
      },
      select: { id: true },
    });
    if (streams.length !== uniqueIds.length) {
      throw new BadRequestException('One or more academic streams are invalid');
    }

    await this.prisma.offeringSectionStream.deleteMany({
      where: {
        offeringSectionId,
        academicStreamId: { notIn: uniqueIds },
      },
    });

    for (const academicStreamId of uniqueIds) {
      await this.prisma.offeringSectionStream.upsert({
        where: {
          offeringSectionId_academicStreamId: {
            offeringSectionId,
            academicStreamId,
          },
        },
        create: { offeringSectionId, academicStreamId },
        update: {},
      });
    }
  }

  eligibleStreamIdsFromSection(section: {
    eligibleStreams?: { academicStreamId: string }[];
  }): string[] {
    return (section.eligibleStreams ?? []).map((r) => r.academicStreamId);
  }
}
