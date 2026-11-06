import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { prefixForDepartment } from '../../students/domain/department-roll-prefix';
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
    const admissionYear = new Date().getFullYear();
    const yearSuffix = String(admissionYear).slice(-2);
    const [departments, rolls] = await Promise.all([
      this.prisma.department.findMany({
        where: { tenantId, deletedAt: null, status: 'ACTIVE' },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.student.findMany({
        where: { tenantId, deletedAt: null, rollNumber: { not: null } },
        select: { departmentId: true, rollNumber: true },
      }),
    ]);
    return departments.map((d) => {
      const prefix = prefixForDepartment(d.name, d.code);
      let studentCount = 0;
      let lastSequence = 0;
      if (prefix) {
        const pattern = new RegExp(`^${prefix}${yearSuffix}-(\\d+)$`, 'i');
        for (const row of rolls) {
          if (row.departmentId !== d.id || !row.rollNumber) continue;
          const match = row.rollNumber.trim().match(pattern);
          if (!match) continue;
          studentCount += 1;
          lastSequence = Math.max(lastSequence, Number(match[1]));
        }
      }
      const nextSequence = lastSequence > 0 ? lastSequence + 1 : 1;
      const nextRollNumber = prefix
        ? `${prefix}${yearSuffix}-${String(nextSequence).padStart(2, '0')}`
        : null;
      return {
        departmentId: d.id,
        departmentName: d.name,
        departmentCode: d.code ?? '',
        prefix: prefix ?? '',
        sequenceStart: prefix ? 1 : null,
        studentCount,
        lastSequence,
        nextRollNumber,
        admissionYear,
      };
    });
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
