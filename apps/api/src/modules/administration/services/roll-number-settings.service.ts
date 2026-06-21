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

  async resetConfig(tenantId: string, actorId?: string) {
    const before = await this.getConfig(tenantId);
    await this.prisma.rollNumberSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        sequenceLength: 3,
        separator: '-',
        autoGenerateOnAdmit: true,
      },
      update: {
        sequenceLength: 3,
        separator: '-',
        autoGenerateOnAdmit: true,
      },
    });
    const after = await this.getConfig(tenantId);
    await this.audit.log({
      tenantId,
      userId: actorId,
      module: 'roll-number-settings',
      action: 'RESET',
      entityType: 'RollNumberSettings',
      entityId: tenantId,
      metadata: { before, after },
    });
    return after;
  }

  async getDepartmentMappings(tenantId: string) {
    const departments = await this.prisma.department.findMany({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
    return departments.map((d) => ({
      departmentId: d.id,
      departmentName: d.name,
      departmentCode: d.code ?? '',
    }));
  }

  async getSequenceOverview(tenantId: string) {
    const settings = await this.prisma.rollNumberSettings.findUnique({
      where: { tenantId },
    });
    const sequenceLength = settings?.sequenceLength ?? 3;
    const separator = settings?.separator ?? '-';

    const sequences = await this.prisma.rollNumberSequence.findMany({
      where: { tenantId },
      orderBy: [{ admissionYear: 'desc' }, { prefix: 'asc' }],
    });

    const rows = [];
    for (const seq of sequences) {
      const yearSuffix = String(seq.admissionYear).slice(-2);
      const rollPrefix = `${seq.prefix}${yearSuffix}`;
      const padded = String(seq.nextSequence).padStart(sequenceLength, '0');
      const nextRollNumber = `${seq.prefix}${yearSuffix}${separator}${padded}`;

      const [lastStudent, totalGenerated] = await Promise.all([
        this.prisma.student.findFirst({
          where: {
            tenantId,
            deletedAt: null,
            rollNumber: { startsWith: rollPrefix },
          },
          select: { rollNumber: true },
          orderBy: { rollNumber: 'desc' },
        }),
        this.prisma.student.count({
          where: {
            tenantId,
            deletedAt: null,
            rollNumber: { startsWith: rollPrefix },
          },
        }),
      ]);

      rows.push({
        prefix: seq.prefix,
        admissionYear: seq.admissionYear,
        currentSequence: Math.max(0, seq.nextSequence - 1),
        nextSequence: seq.nextSequence,
        nextRollNumber,
        lastGeneratedRollNumber: lastStudent?.rollNumber ?? null,
        totalGenerated,
      });
    }
    return rows;
  }
}
