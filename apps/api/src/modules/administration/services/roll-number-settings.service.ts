import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AdminAuditHelper } from '../admin-audit.helper';
import type { UpdateRollNumberConfigDto } from '../dto/roll-number-settings.dto';

@Injectable()
export class RollNumberSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditHelper,
  ) {}

  async getConfig(tenantId: string) {
    let settings = await this.prisma.rollNumberSettings.findUnique({
      where: { tenantId },
    });
    if (!settings) {
      settings = await this.prisma.rollNumberSettings.create({
        data: {
          tenantId,
          sequenceLength: 3,
          separator: '-',
          autoGenerateOnAdmit: true,
        },
      });
    }

    const streams = await this.prisma.academicStream.findMany({
      where: { tenantId, deletedAt: null, isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    const prefixRows = await this.prisma.rollPrefixConfig.findMany({
      where: { tenantId },
      include: { stream: { select: { id: true, code: true, name: true } } },
    });

    const prefixByStream = new Map(prefixRows.map((r) => [r.streamId, r]));

    return {
      settings: {
        sequenceLength: settings.sequenceLength,
        separator: settings.separator,
        autoGenerateOnAdmit: settings.autoGenerateOnAdmit,
      },
      prefixes: streams.map((stream) => {
        const cfg = prefixByStream.get(stream.id);
        return {
          streamId: stream.id,
          streamCode: stream.code,
          streamName: stream.name,
          prefix: cfg?.prefix ?? '',
          isActive: cfg?.isActive ?? false,
          configured: Boolean(cfg),
        };
      }),
    };
  }

  async updateConfig(
    tenantId: string,
    dto: UpdateRollNumberConfigDto,
    actorId?: string,
  ) {
    const before = await this.getConfig(tenantId);

    if (
      dto.sequenceLength !== undefined ||
      dto.separator !== undefined ||
      dto.autoGenerateOnAdmit !== undefined
    ) {
      await this.prisma.rollNumberSettings.upsert({
        where: { tenantId },
        create: {
          tenantId,
          sequenceLength: dto.sequenceLength ?? 3,
          separator: dto.separator ?? '-',
          autoGenerateOnAdmit: dto.autoGenerateOnAdmit ?? true,
        },
        update: {
          ...(dto.sequenceLength !== undefined
            ? { sequenceLength: dto.sequenceLength }
            : {}),
          ...(dto.separator !== undefined ? { separator: dto.separator } : {}),
          ...(dto.autoGenerateOnAdmit !== undefined
            ? { autoGenerateOnAdmit: dto.autoGenerateOnAdmit }
            : {}),
        },
      });
    }

    if (dto.prefixes?.length) {
      for (const item of dto.prefixes) {
        await this.prisma.rollPrefixConfig.upsert({
          where: { tenantId_streamId: { tenantId, streamId: item.streamId } },
          create: {
            tenantId,
            streamId: item.streamId,
            prefix: item.prefix.trim().toUpperCase(),
            isActive: item.isActive ?? true,
          },
          update: {
            prefix: item.prefix.trim().toUpperCase(),
            ...(item.isActive !== undefined ? { isActive: item.isActive } : {}),
          },
        });
      }
    }

    const after = await this.getConfig(tenantId);

    await this.audit.log({
      tenantId,
      userId: actorId,
      module: 'roll-number-settings',
      action: 'UPDATE',
      entityType: 'RollNumberSettings',
      entityId: tenantId,
      metadata: { before, after },
    });

    return after;
  }
}
