import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../shared/cache/cache.service';
import { AdmissionCalendarSyncService } from './admission-calendar-sync.service';

export type CycleSettings = {
  applicationNumberPrefix?: string;
  applicationFee?: number;
  admissionFeeMin?: number;
  meritRules?: {
    class12Weight?: number;
    cuetWeight?: number;
    tieBreakers?: string[];
  };
  /** When false, applicants may submit before fee is recorded (default: required). */
  requirePaymentBeforeSubmit?: boolean;
  helpDesk?: { phone?: string; email?: string };
};

export type DeadlineMode = 'clear' | 'shiftYear' | 'keep';

export type CloneAdmissionCycleInput = {
  sourceCycleId?: string;
  academicYearId?: string;
  createAcademicYear?: {
    name: string;
    startDate: string | Date;
    endDate: string | Date;
    institutionId?: string;
  };
  applicationNumberPrefix?: string;
  deadlineMode?: DeadlineMode;
  /** Archive the source cycle after cloning (soft read-only). */
  archiveSource?: boolean;
  /**
   * AY-create hook: soft-archive all non-archived active cycles before cloning.
   * Defaults false for wizard clones.
   */
  archiveOtherActive?: boolean;
  title?: string;
  registrationOpensAt?: Date | null;
  registrationClosesAt?: Date | null;
  applicationDeadline?: Date | null;
  paymentDeadline?: Date | null;
  settingsOverrides?: Partial<CycleSettings>;
};

export type ClonePreviewResult = {
  sourceCycleId: string;
  sourceTitle: string;
  sourceStatus: string;
  academicYearName: string;
  proposedPrefix: string;
  proposedCode: string;
  proposedTitle: string;
  applicationSeqResetTo: number;
  programCount: number;
  intakeCount: number;
  totalSeats: number;
  warnings: string[];
  formDocsTemplatesNote: string;
};

@Injectable()
export class AdmissionsCycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly admissionCalendar: AdmissionCalendarSyncService,
  ) {}

  private async bustPortalInfoCache(tenantId: string) {
    await this.cache.del(`admissions:portal:info:${tenantId}`);
  }

  /** Prefer bumping YY in prior prefix (DBCT26→DBCT27); else DBCT{YY} from year name. */
  deriveApplicationNumberPrefix(
    yearName: string,
    previousPrefix?: string | null,
  ): string {
    const yearMatch = yearName.match(/(\d{4})/);
    const yy = yearMatch
      ? yearMatch[1].slice(-2)
      : yearName.replace(/\D/g, '').slice(-2) || '26';

    if (previousPrefix) {
      const prefixMatch = previousPrefix.match(/^(.*?)(\d{2})$/);
      if (prefixMatch) {
        return `${prefixMatch[1]}${yy}`;
      }
    }
    return `DBCT${yy}`;
  }

  private yearShortFromName(academicYearName: string): string {
    const yearMatch = academicYearName.match(/(\d{4})/);
    return yearMatch
      ? yearMatch[1].slice(-2)
      : academicYearName.replace(/\D/g, '').slice(-2) || '26';
  }

  private shiftDateByYears(
    value: Date | null | undefined,
    years: number,
  ): Date | null {
    if (!value) return null;
    const next = new Date(value);
    next.setFullYear(next.getFullYear() + years);
    return next;
  }

  private resolveDeadlines(
    template: {
      registrationOpensAt: Date | null;
      registrationClosesAt: Date | null;
      applicationDeadline: Date | null;
      paymentDeadline: Date | null;
      academicYear?: { name: string } | null;
    } | null,
    targetYearName: string,
    mode: DeadlineMode,
    overrides?: {
      registrationOpensAt?: Date | null;
      registrationClosesAt?: Date | null;
      applicationDeadline?: Date | null;
      paymentDeadline?: Date | null;
    },
  ) {
    if (overrides) {
      const hasAny =
        overrides.registrationOpensAt !== undefined ||
        overrides.registrationClosesAt !== undefined ||
        overrides.applicationDeadline !== undefined ||
        overrides.paymentDeadline !== undefined;
      if (hasAny) {
        return {
          registrationOpensAt: overrides.registrationOpensAt ?? null,
          registrationClosesAt: overrides.registrationClosesAt ?? null,
          applicationDeadline: overrides.applicationDeadline ?? null,
          paymentDeadline: overrides.paymentDeadline ?? null,
        };
      }
    }

    if (!template || mode === 'clear') {
      return {
        registrationOpensAt: null,
        registrationClosesAt: null,
        applicationDeadline: null,
        paymentDeadline: null,
      };
    }

    if (mode === 'keep') {
      return {
        registrationOpensAt: template.registrationOpensAt,
        registrationClosesAt: template.registrationClosesAt,
        applicationDeadline: template.applicationDeadline,
        paymentDeadline: template.paymentDeadline,
      };
    }

    const sourceYear = Number(
      (template.academicYear?.name ?? '').match(/(\d{4})/)?.[1] ?? NaN,
    );
    const targetYear = Number(targetYearName.match(/(\d{4})/)?.[1] ?? NaN);
    const delta =
      Number.isFinite(sourceYear) && Number.isFinite(targetYear)
        ? targetYear - sourceYear
        : 1;

    return {
      registrationOpensAt: this.shiftDateByYears(
        template.registrationOpensAt,
        delta,
      ),
      registrationClosesAt: this.shiftDateByYears(
        template.registrationClosesAt,
        delta,
      ),
      applicationDeadline: this.shiftDateByYears(
        template.applicationDeadline,
        delta,
      ),
      paymentDeadline: this.shiftDateByYears(template.paymentDeadline, delta),
    };
  }

  private assertNotArchived(cycle: { status: string }, action: string) {
    if (cycle.status === 'ARCHIVED') {
      throw new BadRequestException(
        `Archived cycles are read-only (${action})`,
      );
    }
  }

  listCycles(tenantId: string, status?: string) {
    return this.prisma.admissionCycle.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(status ? { status } : {}),
      },
      include: {
        academicYear: { select: { id: true, name: true } },
        _count: {
          select: {
            applications: { where: { deletedAt: null } },
            intakes: { where: { deletedAt: null } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  getCycle(tenantId: string, id: string) {
    return this.prisma.admissionCycle.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        academicYear: true,
        programs: { include: { program: true } },
        intakes: {
          where: { deletedAt: null },
          include: {
            program: true,
            shiftCaps: { include: { shift: true } },
          },
        },
      },
    });
  }

  async getActiveCycle(tenantId: string) {
    return this.prisma.admissionCycle.findFirst({
      where: { tenantId, status: 'OPEN', deletedAt: null },
      include: { academicYear: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateCycle(
    tenantId: string,
    id: string,
    data: {
      title?: string;
      registrationOpensAt?: Date;
      registrationClosesAt?: Date;
      applicationDeadline?: Date;
      paymentDeadline?: Date;
      settings?: CycleSettings;
    },
    actorId?: string,
  ) {
    const cycle = await this.getCycle(tenantId, id);
    if (!cycle) throw new NotFoundException('Admission cycle not found');
    this.assertNotArchived(cycle, 'update');

    const updated = await this.prisma.admissionCycle.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.registrationOpensAt !== undefined
          ? { registrationOpensAt: data.registrationOpensAt }
          : {}),
        ...(data.registrationClosesAt !== undefined
          ? { registrationClosesAt: data.registrationClosesAt }
          : {}),
        ...(data.applicationDeadline !== undefined
          ? { applicationDeadline: data.applicationDeadline }
          : {}),
        ...(data.paymentDeadline !== undefined
          ? { paymentDeadline: data.paymentDeadline }
          : {}),
        ...(data.settings !== undefined
          ? {
              settings: {
                ...((cycle.settings as CycleSettings) ?? {}),
                ...data.settings,
              } as Prisma.InputJsonValue,
            }
          : {}),
      },
      include: { academicYear: true },
    });

    await this.audit(
      tenantId,
      id,
      'cycle',
      id,
      'cycle.updated',
      actorId,
      null,
      {
        title: updated.title,
      },
    );
    await this.bustPortalInfoCache(tenantId);
    void this.admissionCalendar.syncCycle(tenantId, id, actorId);
    return updated;
  }

  async publishCycle(tenantId: string, id: string, actorId?: string) {
    const cycle = await this.getCycle(tenantId, id);
    if (!cycle) throw new NotFoundException('Admission cycle not found');
    this.assertNotArchived(cycle, 'publish');
    if (cycle.status !== 'DRAFT' && cycle.status !== 'CLOSED') {
      throw new BadRequestException(
        'Only draft or closed cycles can be published',
      );
    }

    const previouslyOpen = await this.prisma.admissionCycle.findMany({
      where: {
        tenantId,
        status: 'OPEN',
        deletedAt: null,
        id: { not: id },
      },
      select: { id: true },
    });

    if (previouslyOpen.length) {
      await this.prisma.admissionCycle.updateMany({
        where: { id: { in: previouslyOpen.map((r) => r.id) } },
        data: { status: 'CLOSED' },
      });
    }

    const updated = await this.prisma.admissionCycle.update({
      where: { id },
      data: { status: 'OPEN' },
      include: { academicYear: true },
    });

    await this.audit(tenantId, id, 'cycle', id, 'cycle.published', actorId);
    await this.bustPortalInfoCache(tenantId);
    void this.admissionCalendar.syncCycle(tenantId, id, actorId);
    for (const row of previouslyOpen) {
      void this.admissionCalendar.syncCycle(tenantId, row.id, actorId);
    }
    return updated;
  }

  async closeCycle(tenantId: string, id: string, actorId?: string) {
    const cycle = await this.getCycle(tenantId, id);
    if (!cycle) throw new NotFoundException('Admission cycle not found');
    this.assertNotArchived(cycle, 'close');
    if (cycle.status !== 'OPEN') {
      throw new BadRequestException('Only open cycles can be closed');
    }

    const updated = await this.prisma.admissionCycle.update({
      where: { id },
      data: { status: 'CLOSED' },
    });
    await this.audit(tenantId, id, 'cycle', id, 'cycle.closed', actorId);
    await this.bustPortalInfoCache(tenantId);
    void this.admissionCalendar.syncCycle(tenantId, id, actorId);
    return updated;
  }

  async archiveCycle(tenantId: string, id: string, actorId?: string) {
    const cycle = await this.getCycle(tenantId, id);
    if (!cycle) throw new NotFoundException('Admission cycle not found');
    if (cycle.status === 'ARCHIVED') {
      return cycle;
    }

    const updated = await this.prisma.admissionCycle.update({
      where: { id },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
      include: { academicYear: true },
    });

    await this.audit(tenantId, id, 'cycle', id, 'cycle.archived', actorId);
    await this.bustPortalInfoCache(tenantId);
    void this.admissionCalendar.removeCycles(tenantId, [id], actorId);
    return updated;
  }

  async upsertCycleProgram(
    tenantId: string,
    cycleId: string,
    programId: string,
    enabled: boolean,
  ) {
    const cycle = await this.getCycle(tenantId, cycleId);
    if (!cycle) throw new NotFoundException('Admission cycle not found');
    this.assertNotArchived(cycle, 'update programs');

    return this.prisma.admissionCycleProgram.upsert({
      where: { cycleId_programId: { cycleId, programId } },
      update: { enabled },
      create: { tenantId, cycleId, programId, enabled },
      include: { program: true },
    });
  }

  async upsertIntakeShift(
    tenantId: string,
    intakeId: string,
    shiftId: string,
    totalSeats: number,
    reservedSeats?: Record<string, number>,
  ) {
    const intake = await this.prisma.admissionIntake.findFirst({
      where: { id: intakeId, tenantId, deletedAt: null },
      include: { cycle: { select: { id: true, status: true } } },
    });
    if (!intake) throw new NotFoundException('Intake not found');
    if (intake.cycle) this.assertNotArchived(intake.cycle, 'update seats');

    return this.prisma.admissionIntakeShift.upsert({
      where: { intakeId_shiftId: { intakeId, shiftId } },
      update: {
        totalSeats,
        reservedSeats: (reservedSeats ?? {}) as Prisma.InputJsonValue,
      },
      create: {
        tenantId,
        intakeId,
        shiftId,
        totalSeats,
        reservedSeats: (reservedSeats ?? {}) as Prisma.InputJsonValue,
      },
      include: { shift: true },
    });
  }

  async previewClone(
    tenantId: string,
    sourceCycleId: string,
    academicYearName: string,
  ): Promise<ClonePreviewResult> {
    const source = await this.prisma.admissionCycle.findFirst({
      where: { id: sourceCycleId, tenantId, deletedAt: null },
      include: {
        academicYear: { select: { name: true } },
        programs: true,
        intakes: {
          where: { deletedAt: null },
          include: { shiftCaps: true },
        },
      },
    });
    if (!source)
      throw new NotFoundException('Source admission cycle not found');

    const sourceSettings = (source.settings as CycleSettings) ?? {};
    const proposedPrefix = this.deriveApplicationNumberPrefix(
      academicYearName,
      sourceSettings.applicationNumberPrefix,
    );
    const yearShort = this.yearShortFromName(academicYearName);
    const totalSeats = source.intakes.reduce(
      (sum, intake) =>
        sum +
        (intake.shiftCaps.length
          ? intake.shiftCaps.reduce((s, c) => s + c.totalSeats, 0)
          : intake.totalSeats),
      0,
    );

    const warnings: string[] = [];
    if (source.status === 'ARCHIVED') {
      warnings.push('Source cycle is already archived.');
    }
    if (!source.programs.length) {
      warnings.push('Source cycle has no programmes — clone will be empty.');
    }
    if (!source.intakes.length) {
      warnings.push('Source cycle has no intakes — seats will not copy.');
    }

    return {
      sourceCycleId: source.id,
      sourceTitle: source.title,
      sourceStatus: source.status,
      academicYearName,
      proposedPrefix,
      proposedCode: `ADM-${academicYearName.replace(/\s+/g, '-')}`,
      proposedTitle: `Admission ${academicYearName}`,
      applicationSeqResetTo: 0,
      programCount: source.programs.length,
      intakeCount: source.intakes.length,
      totalSeats,
      warnings,
      formDocsTemplatesNote:
        'Form schema, document slots, and notification templates are tenant-global and will be reused automatically (not cloned as cycle rows).',
    };
  }

  /**
   * Clone programmes / intakes / seat matrix / settings into a new DRAFT cycle.
   * Never copies applications, payments, merit, or allocations.
   */
  async cloneAdmissionCycle(
    tenantId: string,
    actorId: string | undefined,
    input: CloneAdmissionCycleInput,
  ) {
    const deadlineMode: DeadlineMode = input.deadlineMode ?? 'clear';
    const now = new Date();

    let academicYearId = input.academicYearId;
    let academicYearName = '';
    let institutionId = '';

    if (input.createAcademicYear) {
      if (academicYearId) {
        throw new BadRequestException(
          'Provide either academicYearId or createAcademicYear, not both',
        );
      }
      institutionId = input.createAcademicYear.institutionId ?? '';
      if (!institutionId) {
        const inst = await this.prisma.institution.findFirst({
          where: { tenantId, deletedAt: null },
          orderBy: { createdAt: 'asc' },
        });
        if (!inst) {
          throw new BadRequestException(
            'Create an institution before academic years',
          );
        }
        institutionId = inst.id;
      }
      const year = await this.prisma.academicYear.create({
        data: {
          tenantId,
          institutionId,
          name: input.createAcademicYear.name,
          startDate: new Date(input.createAcademicYear.startDate),
          endDate: new Date(input.createAcademicYear.endDate),
        },
      });
      academicYearId = year.id;
      academicYearName = year.name;
    } else if (academicYearId) {
      const year = await this.prisma.academicYear.findFirst({
        where: { id: academicYearId, tenantId, deletedAt: null },
      });
      if (!year) throw new NotFoundException('Academic year not found');
      academicYearId = year.id;
      academicYearName = year.name;
      institutionId = year.institutionId;
    } else {
      throw new BadRequestException(
        'academicYearId or createAcademicYear is required',
      );
    }

    const existingForYear = await this.prisma.admissionCycle.findFirst({
      where: {
        tenantId,
        academicYearId,
        deletedAt: null,
      },
      select: { id: true, code: true, status: true },
    });
    if (existingForYear) {
      throw new BadRequestException(
        `Academic year "${academicYearName}" already has admission cycle ${existingForYear.code} (${existingForYear.status}). Delete is not supported — use that cycle or pick another year.`,
      );
    }

    let template = null as Awaited<
      ReturnType<typeof this.loadCloneTemplate>
    > | null;

    if (input.sourceCycleId) {
      template = await this.loadCloneTemplate(tenantId, input.sourceCycleId);
      if (!template) {
        throw new NotFoundException('Source admission cycle not found');
      }
      if (!institutionId) institutionId = template.institutionId;
    } else if (input.archiveOtherActive) {
      // AY hook without explicit source — use latest non-archived as template
      const priors = await this.prisma.admissionCycle.findMany({
        where: {
          tenantId,
          institutionId,
          status: { in: ['OPEN', 'CLOSED', 'DRAFT'] },
          deletedAt: null,
        },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });
      if (priors[0]) {
        template = await this.loadCloneTemplate(tenantId, priors[0].id);
      }
    }

    if (input.archiveOtherActive) {
      const priorCycles = await this.prisma.admissionCycle.findMany({
        where: {
          tenantId,
          institutionId,
          status: { in: ['OPEN', 'CLOSED', 'DRAFT'] },
          deletedAt: null,
        },
        select: { id: true },
      });
      if (priorCycles.length > 0) {
        await this.prisma.admissionCycle.updateMany({
          where: {
            id: { in: priorCycles.map((c) => c.id) },
          },
          data: { status: 'ARCHIVED', archivedAt: now },
        });
        void this.admissionCalendar.removeCycles(
          tenantId,
          priorCycles.map((c) => c.id),
          actorId,
        );
      }
    }

    const yearShort = this.yearShortFromName(academicYearName);
    const code = `ADM-${academicYearName.replace(/\s+/g, '-')}`;
    const sourceSettings = (template?.settings as CycleSettings) ?? undefined;
    const prefix =
      input.applicationNumberPrefix ??
      this.deriveApplicationNumberPrefix(
        academicYearName,
        sourceSettings?.applicationNumberPrefix,
      );

    const settings: CycleSettings = {
      applicationFee: sourceSettings?.applicationFee ?? 600,
      admissionFeeMin: sourceSettings?.admissionFeeMin ?? 10500,
      meritRules: sourceSettings?.meritRules ?? {
        class12Weight: 1,
        tieBreakers: ['meritScore', 'submittedAt'],
      },
      requirePaymentBeforeSubmit:
        sourceSettings?.requirePaymentBeforeSubmit !== false,
      helpDesk: sourceSettings?.helpDesk,
      ...input.settingsOverrides,
      applicationNumberPrefix:
        input.settingsOverrides?.applicationNumberPrefix ?? prefix,
    };

    const deadlines = this.resolveDeadlines(
      template,
      academicYearName,
      deadlineMode,
      {
        registrationOpensAt: input.registrationOpensAt,
        registrationClosesAt: input.registrationClosesAt,
        applicationDeadline: input.applicationDeadline,
        paymentDeadline: input.paymentDeadline,
      },
    );

    const cycle = await this.prisma.admissionCycle.create({
      data: {
        tenantId,
        institutionId,
        academicYearId,
        code,
        title: input.title ?? `Admission ${academicYearName}`,
        status: 'DRAFT',
        applicationSeq: 0,
        settings: settings as Prisma.InputJsonValue,
        registrationOpensAt: deadlines.registrationOpensAt,
        registrationClosesAt: deadlines.registrationClosesAt,
        applicationDeadline: deadlines.applicationDeadline,
        paymentDeadline: deadlines.paymentDeadline,
      },
    });

    let programCount = 0;
    let intakeCount = 0;
    let seatCount = 0;

    if (template) {
      for (const cp of template.programs) {
        await this.prisma.admissionCycleProgram.create({
          data: {
            tenantId,
            cycleId: cycle.id,
            programId: cp.programId,
            enabled: cp.enabled,
          },
        });
        programCount += 1;
      }

      for (const intake of template.intakes) {
        const newIntake = await this.prisma.admissionIntake.create({
          data: {
            tenantId,
            cycleId: cycle.id,
            programId: intake.programId,
            academicYearId,
            name:
              intake.name.replace(
                /\d{4}/,
                academicYearName.match(/(\d{4})/)?.[1] ?? yearShort,
              ) || intake.name,
            code: `${intake.code.split('-')[0]}-${yearShort}`,
            totalSeats: intake.totalSeats,
            status: 'draft',
          },
        });
        intakeCount += 1;

        for (const cap of intake.shiftCaps) {
          await this.prisma.admissionIntakeShift.create({
            data: {
              tenantId,
              intakeId: newIntake.id,
              shiftId: cap.shiftId,
              totalSeats: cap.totalSeats,
              reservedSeats: cap.reservedSeats as Prisma.InputJsonValue,
            },
          });
          seatCount += cap.totalSeats;
        }
        if (!intake.shiftCaps.length) seatCount += intake.totalSeats;
      }
    } else {
      const programs = await this.prisma.program.findMany({
        where: { tenantId, deletedAt: null },
        take: 20,
      });
      for (const program of programs) {
        await this.prisma.admissionCycleProgram.create({
          data: {
            tenantId,
            cycleId: cycle.id,
            programId: program.id,
            enabled: true,
          },
        });
        programCount += 1;
        const intake = await this.prisma.admissionIntake.create({
          data: {
            tenantId,
            cycleId: cycle.id,
            programId: program.id,
            academicYearId,
            name: `${program.name} Admission ${academicYearName}`,
            code: `${program.code}-${yearShort}`,
            totalSeats: 60,
            status: 'draft',
          },
        });
        intakeCount += 1;
        const shifts = await this.prisma.shift.findMany({
          where: { tenantId, deletedAt: null },
          take: 3,
        });
        const perShift = Math.max(
          1,
          Math.floor(60 / Math.max(shifts.length, 1)),
        );
        for (const shift of shifts) {
          await this.prisma.admissionIntakeShift.create({
            data: {
              tenantId,
              intakeId: intake.id,
              shiftId: shift.id,
              totalSeats: perShift,
              reservedSeats: { GENERAL: perShift } as Prisma.InputJsonValue,
            },
          });
          seatCount += perShift;
        }
      }
    }

    if (input.archiveSource && template && !input.archiveOtherActive) {
      if (template.status !== 'ARCHIVED') {
        await this.prisma.admissionCycle.update({
          where: { id: template.id },
          data: { status: 'ARCHIVED', archivedAt: now },
        });
        void this.admissionCalendar.removeCycles(
          tenantId,
          [template.id],
          actorId,
        );
      }
    }

    await this.audit(
      tenantId,
      cycle.id,
      'cycle',
      cycle.id,
      'CYCLE_CLONED',
      actorId,
      null,
      {
        sourceCycleId: template?.id ?? null,
        academicYearId,
        code,
        prefix,
        programCount,
        intakeCount,
        seatCount,
        deadlineMode,
        applicationSeq: 0,
      },
    );

    if (template) {
      await this.audit(
        tenantId,
        template.id,
        'cycle',
        template.id,
        'CYCLE_CLONED_FROM',
        actorId,
        null,
        { targetCycleId: cycle.id },
      );
    }

    void this.admissionCalendar.syncCycle(tenantId, cycle.id, actorId);
    await this.bustPortalInfoCache(tenantId);

    const full = await this.getCycle(tenantId, cycle.id);
    return {
      cycle: full ?? cycle,
      summary: {
        programCount,
        intakeCount,
        seatCount,
        applicationNumberPrefix: prefix,
        applicationSeq: 0,
        sourceCycleId: template?.id ?? null,
        academicYearId,
        academicYearName,
      },
    };
  }

  private loadCloneTemplate(tenantId: string, cycleId: string) {
    return this.prisma.admissionCycle.findFirst({
      where: { id: cycleId, tenantId, deletedAt: null },
      include: {
        academicYear: { select: { id: true, name: true } },
        intakes: {
          where: { deletedAt: null },
          include: { shiftCaps: true },
        },
        programs: true,
      },
    });
  }

  /** Called after academicYear.create — archives prior cycles and provisions a DRAFT cycle. */
  async onAcademicYearCreated(
    tenantId: string,
    institutionId: string,
    academicYearId: string,
    academicYearName: string,
    actorId?: string,
  ) {
    const result = await this.cloneAdmissionCycle(tenantId, actorId, {
      academicYearId,
      archiveOtherActive: true,
      deadlineMode: 'keep',
      createAcademicYear: undefined,
    });

    // Preserve legacy audit action name used by AY provisioning
    await this.audit(
      tenantId,
      result.cycle.id,
      'cycle',
      result.cycle.id,
      'cycle.provisioned',
      actorId,
      null,
      { academicYearId, code: result.cycle.code, via: 'academicYear.create' },
    );

    return result.cycle;
  }

  async nextApplicationNumber(cycleId: string): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      const cycle = await tx.admissionCycle.findUnique({
        where: { id: cycleId },
      });
      if (!cycle) {
        throw new BadRequestException('Admission cycle not found');
      }
      if (cycle.status === 'ARCHIVED') {
        throw new BadRequestException(
          'Cannot issue application numbers for an archived cycle',
        );
      }
      // Atomic increment avoids duplicate application numbers under concurrent register.
      const updated = await tx.admissionCycle.update({
        where: { id: cycleId },
        data: { applicationSeq: { increment: 1 } },
      });
      const settings = (updated.settings as CycleSettings) ?? {};
      const prefix = settings.applicationNumberPrefix ?? 'DBCT26';
      return `${prefix}-${String(updated.applicationSeq).padStart(4, '0')}`;
    });
  }

  async audit(
    tenantId: string,
    cycleId: string | null,
    entityType: string,
    entityId: string,
    action: string,
    actorId?: string | null,
    oldValue?: Prisma.InputJsonValue | null,
    newValue?: Prisma.InputJsonValue | null,
  ) {
    await this.prisma.admissionAuditLog.create({
      data: {
        tenantId,
        cycleId,
        entityType,
        entityId,
        action,
        actorId: actorId ?? null,
        oldValue: oldValue ?? undefined,
        newValue: newValue ?? undefined,
      },
    });
  }
}
