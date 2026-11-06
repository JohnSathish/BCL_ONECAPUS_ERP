import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  prefixForDepartment,
  shiftBandFor,
  suggestDepartmentShiftBands,
} from '../../students/domain/department-roll-prefix';
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

  async getDepartmentRollRanges(
    tenantId: string,
    admissionYear = new Date().getFullYear(),
  ) {
    const yearSuffix = String(admissionYear).slice(-2);
    const [departments, shifts, rolls, saved] = await Promise.all([
      this.prisma.department.findMany({
        where: { tenantId, deletedAt: null, status: 'ACTIVE' },
        select: { id: true, name: true, code: true, institutionId: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.shift.findMany({
        where: { tenantId, deletedAt: null, status: 'ACTIVE' },
        select: { id: true, code: true, name: true, institutionId: true },
      }),
      this.prisma.student.findMany({
        where: { tenantId, deletedAt: null, rollNumber: { not: null } },
        select: {
          departmentId: true,
          rollNumber: true,
          primaryShift: { select: { code: true, name: true } },
        },
      }),
      this.prisma.rollDepartmentShiftRange.findMany({
        where: { tenantId, admissionYear, isActive: true },
      }),
    ]);

    const rows = [];
    for (const department of departments) {
      const prefix = prefixForDepartment(department.name, department.code);
      if (!prefix) continue;
      const pattern = new RegExp(`^${prefix}${yearSuffix}-(\\d+)$`, 'i');
      let dayHighest = 0;
      let morningHighest = 0;
      let dayStudents = 0;
      let morningStudents = 0;
      for (const roll of rolls) {
        if (roll.departmentId !== department.id || !roll.rollNumber) continue;
        const match = roll.rollNumber.trim().match(pattern);
        if (!match) continue;
        const sequence = Number(match[1]);
        const band = shiftBandFor(
          roll.primaryShift?.code,
          roll.primaryShift?.name,
        );
        if (band === 'morning') {
          morningStudents += 1;
          morningHighest = Math.max(morningHighest, sequence);
        } else {
          dayStudents += 1;
          dayHighest = Math.max(dayHighest, sequence);
        }
      }
      const suggested = suggestDepartmentShiftBands(dayHighest, morningHighest);
      const dayShift = shifts.find(
        (shift) =>
          shift.institutionId === department.institutionId &&
          shiftBandFor(shift.code, shift.name) === 'day',
      );
      const morningShift = shifts.find(
        (shift) =>
          shift.institutionId === department.institutionId &&
          shiftBandFor(shift.code, shift.name) === 'morning',
      );
      const daySaved = saved.find(
        (row) =>
          row.departmentId === department.id && row.shiftId === dayShift?.id,
      );
      const morningSaved = saved.find(
        (row) =>
          row.departmentId === department.id &&
          row.shiftId === morningShift?.id,
      );
      const day = daySaved
        ? {
            start: daySaved.sequenceStart,
            end: daySaved.sequenceEnd,
            next: Math.max(daySaved.nextSequence, suggested.day.next),
          }
        : suggested.day;
      const morning = morningSaved
        ? {
            start: morningSaved.sequenceStart,
            end: morningSaved.sequenceEnd,
            next: Math.max(morningSaved.nextSequence, suggested.morning.next),
          }
        : suggested.morning;
      const sample = (sequence: number) =>
        `${prefix}${yearSuffix}-${String(sequence).padStart(2, '0')}`;
      rows.push({
        departmentId: department.id,
        departmentName: department.name,
        prefix,
        admissionYear,
        dayShiftId: dayShift?.id ?? null,
        morningShiftId: morningShift?.id ?? null,
        dayStudents,
        morningStudents,
        day,
        morning,
        nextDayRoll: sample(day.next),
        nextMorningRoll: sample(morning.next),
        note: suggested.note,
      });
    }
    return { admissionYear, rows };
  }

  async saveDepartmentRollRanges(
    tenantId: string,
    input: {
      admissionYear: number;
      ranges: Array<{
        departmentId: string;
        shiftId: string;
        sequenceStart: number;
        sequenceEnd: number;
        nextSequence: number;
      }>;
    },
    actorId?: string,
  ) {
    const byDepartment = new Map<string, typeof input.ranges>();
    for (const range of input.ranges) {
      if (range.sequenceEnd < range.sequenceStart) {
        throw new BadRequestException(
          'The end number has to be at least the start number.',
        );
      }
      const list = byDepartment.get(range.departmentId) ?? [];
      list.push(range);
      byDepartment.set(range.departmentId, list);
    }
    for (const ranges of byDepartment.values()) {
      if (ranges.length < 2) continue;
      const ordered = [...ranges].sort(
        (a, b) => a.sequenceStart - b.sequenceStart,
      );
      if (ordered[0].sequenceEnd >= ordered[1].sequenceStart) {
        throw new BadRequestException(
          'Day Shift and Morning Shift numbers overlap. Morning Shift must start after Day Shift ends.',
        );
      }
    }

    for (const range of input.ranges) {
      const department = await this.prisma.department.findFirst({
        where: { id: range.departmentId, tenantId, deletedAt: null },
        select: { institutionId: true },
      });
      if (!department) continue;
      await this.prisma.rollDepartmentShiftRange.upsert({
        where: {
          tenantId_departmentId_shiftId_admissionYear: {
            tenantId,
            departmentId: range.departmentId,
            shiftId: range.shiftId,
            admissionYear: input.admissionYear,
          },
        },
        create: {
          tenantId,
          institutionId: department.institutionId,
          departmentId: range.departmentId,
          shiftId: range.shiftId,
          admissionYear: input.admissionYear,
          sequenceStart: range.sequenceStart,
          sequenceEnd: range.sequenceEnd,
          nextSequence: range.nextSequence,
        },
        update: {
          sequenceStart: range.sequenceStart,
          sequenceEnd: range.sequenceEnd,
          nextSequence: range.nextSequence,
          isActive: true,
        },
      });
    }

    await this.audit.log({
      tenantId,
      userId: actorId,
      module: 'roll-number-settings',
      action: 'UPDATE_DEPARTMENT_RANGES',
      entityType: 'RollDepartmentShiftRange',
      entityId: tenantId,
      metadata: {
        admissionYear: input.admissionYear,
        count: input.ranges.length,
      },
    });
    return this.getDepartmentRollRanges(tenantId, input.admissionYear);
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
