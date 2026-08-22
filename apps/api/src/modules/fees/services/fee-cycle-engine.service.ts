import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import {
  fyugpYearForSemester,
  isFeeCycleTriggerSemester,
  semesterPairLabel,
} from '../constants/fee-cycle.constants';
import type {
  BulkGenerateCycleDemandDto,
  GenerateCycleDemandDto,
} from '../dto/fee-cycle.dto';
import { FeeCycleConfigService } from './fee-cycle-config.service';
import { FeeLedgerService } from './fee-ledger.service';
import { StudentFeeSummaryService } from './student-fee-summary.service';
import { LicenseEnforcementService } from '../../licensing/services/license-enforcement.service';

type StudentScope = {
  id: string;
  programVersionId?: string | null;
  primaryShiftId?: string | null;
  academicProfile?: {
    departmentId?: string | null;
    streamId?: string | null;
    admissionYearId?: string | null;
  } | null;
  programVersion?: { programId?: string | null } | null;
  academicStanding?: { currentSemesterSequence?: number | null } | null;
};

type CycleDemandPreview = {
  cycle: {
    id: string;
    code: string;
    name: string;
    startSemester: number;
    endSemester: number;
  };
  lines: Array<{
    code: string;
    name: string;
    category: string;
    unitAmount: number;
    amount: number;
    quantity: number;
    sourceType: string;
    sourceRefId: string;
  }>;
  totalAmount: number;
  arrearsAmount?: number;
  billingPeriod?: string;
  academicYearNo?: number;
  semesterNumber?: number;
};

function asCycleDemandPreview(preview: unknown): CycleDemandPreview | null {
  const row = preview as CycleDemandPreview;
  return row?.cycle && row?.lines && row.totalAmount != null ? row : null;
}

const STUDENT_LOAD_BATCH = 200;

@Injectable()
export class FeeCycleEngineService {
  private readonly logger = new Logger(FeeCycleEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cycles: FeeCycleConfigService,
    private readonly ledger: FeeLedgerService,
    private readonly feeSummary: StudentFeeSummaryService,
    private readonly licenseEnforcement: LicenseEnforcementService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async previewForStudent(
    tenantId: string,
    studentId: string,
    semesterNumber?: number,
  ) {
    const student = await this.loadStudent(tenantId, studentId);
    if (!student)
      return { studentId, skipped: true, reason: 'Student not found' };
    const semester =
      semesterNumber ?? student.academicStanding?.currentSemesterSequence ?? 1;
    return this.evaluate(tenantId, student, semester);
  }

  async generateForStudent(user: JwtUser, dto: GenerateCycleDemandDto) {
    await this.licenseEnforcement.assertWriteAllowed(user.tid, 'fee.write');
    const student = await this.loadStudent(user.tid, dto.studentId);
    if (!student) return { skipped: true, reason: 'Student not found' };
    const semester =
      dto.semesterNumber ??
      student.academicStanding?.currentSemesterSequence ??
      1;
    const preview = await this.evaluate(user.tid, student, semester);
    const ready = asCycleDemandPreview(preview);
    if (!ready) return preview;
    const demand = await this.createDemand(
      user,
      student,
      ready,
      dto.publish ?? true,
    );
    return { created: true, demand, preview };
  }

  async generateBulk(user: JwtUser, dto: BulkGenerateCycleDemandDto) {
    await this.licenseEnforcement.assertWriteAllowed(user.tid, 'fee.write');
    if (!isFeeCycleTriggerSemester(dto.semesterNumber)) {
      return {
        createdCount: 0,
        skippedCount: 0,
        message: `Semester ${dto.semesterNumber} does not trigger a fee cycle demand.`,
        results: [],
      };
    }

    const students = dto.studentIds?.length
      ? await this.loadStudents(user.tid, dto.studentIds)
      : await this.resolveStudentsForSemester(user.tid, dto);

    const results: Array<Record<string, unknown>> = [];
    let createdCount = 0;
    let skippedCount = 0;

    for (const student of students) {
      const preview = await this.evaluate(
        user.tid,
        student,
        dto.semesterNumber,
      );
      const ready = asCycleDemandPreview(preview);
      if (!ready) {
        skippedCount += 1;
        results.push({
          studentId: student.id,
          skipped: true,
          reason: (preview as { reason?: string }).reason,
        });
        continue;
      }
      try {
        const demand = await this.createDemand(
          user,
          student,
          ready,
          dto.publish ?? true,
        );
        createdCount += 1;
        results.push({
          studentId: student.id,
          created: true,
          demandId: demand.id,
        });
      } catch (error) {
        skippedCount += 1;
        const reason =
          error instanceof Error ? error.message : 'Failed to create demand';
        this.logger.warn(
          `Cycle demand failed for student ${student.id} (sem ${dto.semesterNumber}): ${reason}`,
        );
        results.push({
          studentId: student.id,
          skipped: true,
          reason,
        });
      }
    }

    return { createdCount, skippedCount, results };
  }

  /**
   * Generate session/admission cycle demands for students currently in the
   * FYUP entry semesters (default I, III, V). Existing demands are skipped.
   */
  async generateForEntrySemesters(
    user: JwtUser,
    dto: { semesterNumbers?: number[]; publish?: boolean },
  ) {
    const requested = dto.semesterNumbers?.length
      ? dto.semesterNumbers
      : ([1, 3, 5] as const);
    const semesters = [...new Set(requested)].filter((sem) =>
      isFeeCycleTriggerSemester(sem),
    );
    if (!semesters.length) {
      return {
        createdCount: 0,
        skippedCount: 0,
        message: 'No valid fee-trigger semesters selected.',
        bySemester: [] as Array<{
          semesterNumber: number;
          createdCount: number;
          skippedCount: number;
        }>,
      };
    }

    const bySemester: Array<{
      semesterNumber: number;
      createdCount: number;
      skippedCount: number;
    }> = [];
    let createdCount = 0;
    let skippedCount = 0;

    for (const semesterNumber of semesters) {
      const result = await this.generateBulk(user, {
        semesterNumber,
        publish: dto.publish ?? true,
      });
      createdCount += result.createdCount;
      skippedCount += result.skippedCount;
      bySemester.push({
        semesterNumber,
        createdCount: result.createdCount,
        skippedCount: result.skippedCount,
      });
    }

    return { createdCount, skippedCount, bySemester };
  }

  /** Called automatically on enrollment (Sem I) or promotion (Sem III / V). */
  async onStudentSemesterEntry(
    tenantId: string,
    studentId: string,
    semesterNumber: number,
    actorId?: string,
  ) {
    if (!isFeeCycleTriggerSemester(semesterNumber)) {
      return { skipped: true, reason: 'Not a fee trigger semester' };
    }
    const student = await this.loadStudent(tenantId, studentId);
    if (!student) return { skipped: true, reason: 'Student not found' };
    const preview = await this.evaluate(tenantId, student, semesterNumber);
    const ready = asCycleDemandPreview(preview);
    if (!ready) return preview;
    const pseudoUser = { tid: tenantId, sub: actorId ?? 'system' } as JwtUser;
    const demand = await this.createDemand(pseudoUser, student, ready, true);
    return {
      created: true,
      demandId: demand.id,
      cycleCode: preview.cycle?.code,
    };
  }

  async studentFeeAccount(tenantId: string, studentId: string) {
    const ledger = await this.ledger.studentLedger(tenantId, studentId);
    const cycles = await this.db().academicFeeCycle.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { startSemester: 'asc' },
    });

    const cycleDemands = cycles.map(
      (cycle: {
        id: string;
        code: string;
        name: string;
        startSemester: number;
        endSemester: number;
        totalAmount: unknown;
      }) => {
        const demand = (ledger.demands as Array<Record<string, unknown>>).find(
          (d) => d.feeCycleId === cycle.id && d.status !== 'CANCELLED',
        );
        return {
          cycleId: cycle.id,
          cycleCode: cycle.code,
          cycleName: cycle.name,
          covers: semesterPairLabel(cycle.startSemester, cycle.endSemester),
          configuredAmount: Number(cycle.totalAmount),
          status: demand
            ? demand.status === 'PAID' || Number(demand.balanceAmount) <= 0
              ? 'PAID'
              : Number(demand.paidAmount) > 0
                ? 'PARTIAL'
                : 'PENDING'
            : 'NOT_GENERATED',
          demandId: demand?.id ?? null,
          demandNo: demand?.demandNo ?? null,
          totalAmount: demand ? Number(demand.totalAmount) : null,
          paidAmount: demand ? Number(demand.paidAmount) : null,
          balanceAmount: demand ? Number(demand.balanceAmount) : null,
        };
      },
    );

    const arrears = (ledger.demands as Array<Record<string, unknown>>)
      .filter((d) => Number(d.balanceAmount) > 0 && d.status !== 'CANCELLED')
      .reduce((sum, d) => sum + Number(d.balanceAmount), 0);

    return {
      studentId,
      summary: {
        ...ledger.summary,
        totalArrears: arrears,
        totalDue: arrears,
      },
      cycles: cycleDemands,
      ledger,
    };
  }

  private async evaluate(
    tenantId: string,
    student: StudentScope,
    semesterNumber: number,
  ) {
    if (!isFeeCycleTriggerSemester(semesterNumber)) {
      return {
        studentId: student.id,
        semesterNumber,
        skipped: true,
        reason: `Semester ${semesterNumber} is covered by the previous cycle — no new demand.`,
      };
    }

    const cycle = await this.cycles.resolveForStudent(
      tenantId,
      semesterNumber,
      {
        programId: student.programVersion?.programId,
        departmentId: student.academicProfile?.departmentId,
        shiftId: student.primaryShiftId,
        academicYearId: student.academicProfile?.admissionYearId,
      },
    );

    if (!cycle) {
      return {
        studentId: student.id,
        semesterNumber,
        skipped: true,
        reason: `No active fee cycle configured for Semester ${semesterNumber}.`,
      };
    }

    const existing = await this.db().studentFeeDemand.findFirst({
      where: {
        tenantId,
        studentId: student.id,
        feeCycleId: cycle.id,
        status: { notIn: ['CANCELLED', 'ROLLED_BACK'] },
      },
    });
    if (existing) {
      return {
        studentId: student.id,
        semesterNumber,
        skipped: true,
        reason: `Demand already exists for ${cycle.name}.`,
        existingDemandId: existing.id,
      };
    }

    const arrears = await this.calculateArrears(
      tenantId,
      student.id,
      cycle.startSemester,
    );
    const lines = this.buildDemandLines(cycle, arrears);
    const totalAmount = lines.reduce((sum, line) => sum + line.amount, 0);

    return {
      studentId: student.id,
      semesterNumber,
      skipped: false,
      cycle,
      lines,
      totalAmount,
      arrearsAmount: arrears,
      billingPeriod: `CYCLE-${cycle.code}`,
      academicYearNo: fyugpYearForSemester(semesterNumber),
    };
  }

  private buildDemandLines(
    cycle: {
      id: string;
      code: string;
      name: string;
      totalAmount: unknown;
      lines?: Array<{
        amount: unknown;
        sortOrder: number;
        feeHead: { code: string; name: string; category: string };
      }>;
    },
    arrears: number,
  ) {
    const lines = cycle.lines?.length
      ? cycle.lines.map((line) => ({
          code: line.feeHead.code,
          name: line.feeHead.name,
          category: line.feeHead.category,
          unitAmount: Number(line.amount),
          amount: Number(line.amount),
          quantity: 1,
          sourceType: 'FEE_CYCLE',
          sourceRefId: cycle.id,
        }))
      : [
          {
            code: cycle.code,
            name: cycle.name,
            category: 'SESSION',
            unitAmount: Number(cycle.totalAmount),
            amount: Number(cycle.totalAmount),
            quantity: 1,
            sourceType: 'FEE_CYCLE',
            sourceRefId: cycle.id,
          },
        ];

    if (arrears > 0) {
      lines.push({
        code: 'ARREARS',
        name: 'Outstanding from previous cycle(s)',
        category: 'ARREARS',
        unitAmount: arrears,
        amount: arrears,
        quantity: 1,
        sourceType: 'ARREARS',
        sourceRefId: cycle.id,
      });
    }

    const computed = lines.reduce((sum, line) => sum + line.amount, 0);
    const configured = Number(cycle.totalAmount) + arrears;
    if (Math.abs(computed - configured) > 0.01 && cycle.lines?.length) {
      const diff = configured - computed;
      if (diff !== 0) {
        lines.push({
          code: 'CYCLE_ADJUSTMENT',
          name: 'Cycle amount adjustment',
          category: 'ADJUSTMENT',
          unitAmount: diff,
          amount: diff,
          quantity: 1,
          sourceType: 'FEE_CYCLE',
          sourceRefId: cycle.id,
        });
      }
    }

    return lines;
  }

  private async calculateArrears(
    tenantId: string,
    studentId: string,
    currentStartSemester: number,
  ) {
    const priorCycles = await this.db().academicFeeCycle.findMany({
      where: {
        tenantId,
        deletedAt: null,
        endSemester: { lt: currentStartSemester },
      },
      select: { id: true },
    });
    if (!priorCycles.length) return 0;

    const priorDemands = await this.db().studentFeeDemand.findMany({
      where: {
        tenantId,
        studentId,
        feeCycleId: { in: priorCycles.map((c: { id: string }) => c.id) },
        status: { in: ['PUBLISHED', 'LOCKED', 'PARTIALLY_PAID'] },
      },
    });

    return priorDemands.reduce(
      (sum: number, demand: { balanceAmount: unknown }) =>
        sum + Number(demand.balanceAmount ?? 0),
      0,
    );
  }

  private async createDemand(
    user: JwtUser,
    student: StudentScope,
    preview: CycleDemandPreview,
    publish: boolean,
  ) {
    let demand: Record<string, any> | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const demandNo = await this.nextDemandNo(user.tid);
      try {
        demand = await this.db().studentFeeDemand.create({
          data: {
            tenantId: user.tid,
            studentId: student.id,
            feeCycleId: preview.cycle.id,
            academicYearId: student.academicProfile?.admissionYearId,
            semesterNumber:
              preview.semesterNumber ?? preview.cycle.startSemester,
            academicYearNo: preview.academicYearNo,
            demandNo,
            demandType: 'ADMISSION_SESSION',
            billingLayer: 'BIENNIAL',
            billingPeriod: preview.billingPeriod,
            status: publish ? 'PUBLISHED' : 'DRAFT',
            totalAmount: preview.totalAmount,
            balanceAmount: preview.totalAmount,
            publishedAt: publish ? new Date() : undefined,
            generatedById: user.sub,
            metadata: {
              feeCycleCode: preview.cycle.code,
              feeCycleName: preview.cycle.name,
              coversSemesters: [
                preview.cycle.startSemester,
                preview.cycle.endSemester,
              ],
              arrearsCarriedForward: preview.arrearsAmount ?? 0,
            },
            lines: {
              create: preview.lines.map((line) => ({
                tenantId: user.tid,
                code: line.code,
                name: line.name,
                category: line.category,
                quantity: line.quantity,
                unitAmount: line.unitAmount,
                amount: line.amount,
                sourceType: line.sourceType,
                sourceRefId: line.sourceRefId,
              })),
            },
          },
          include: { lines: true },
        });
        break;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          attempt < 2
        ) {
          continue;
        }
        throw error;
      }
    }
    if (!demand) {
      throw new Error('Could not allocate a unique fee demand number');
    }

    await this.ledger.post({
      tenantId: user.tid,
      studentId: student.id,
      demandId: demand.id,
      entryType: 'CHARGE',
      debitAmount: preview.totalAmount,
      referenceType: 'DEMAND',
      referenceId: demand.id,
      description: `${preview.cycle.name} — ${semesterPairLabel(preview.cycle.startSemester, preview.cycle.endSemester)}`,
      postedById: user.sub,
    });

    await this.db().feeAuditLog.create({
      data: {
        tenantId: user.tid,
        demandId: demand.id,
        actorId: user.sub,
        action: 'fee_cycle_demand.generated',
        after: {
          demandId: demand.id,
          demandNo: demand.demandNo,
          totalAmount: Number(demand.totalAmount),
        },
        metadata: { feeCycleId: preview.cycle.id },
      },
    });

    if (publish) {
      try {
        await this.feeSummary.touchAfterPayment(user.tid, student.id);
      } catch (error) {
        this.logger.warn(
          `Fee summary refresh failed for ${student.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return demand;
  }

  private async nextDemandNo(tenantId: string) {
    const year = new Date().getFullYear();
    const prefix = `FD-${year}-`;
    const latest = await this.db().studentFeeDemand.findFirst({
      where: { tenantId, demandNo: { startsWith: prefix } },
      orderBy: { demandNo: 'desc' },
      select: { demandNo: true },
    });
    const parsed = Number.parseInt(
      String(latest?.demandNo ?? '').slice(prefix.length),
      10,
    );
    const next = Number.isFinite(parsed) && parsed >= 0 ? parsed + 1 : 1;
    return `${prefix}${String(next).padStart(6, '0')}`;
  }

  private studentInclude() {
    return {
      academicProfile: true,
      academicStanding: true,
      programVersion: { select: { programId: true } },
    };
  }

  private async loadStudent(
    tenantId: string,
    studentId: string,
  ): Promise<StudentScope | null> {
    return this.db().student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
      include: this.studentInclude(),
    });
  }

  private async loadStudents(
    tenantId: string,
    studentIds: string[],
  ): Promise<StudentScope[]> {
    if (!studentIds.length) return [];
    const loaded: StudentScope[] = [];
    for (let i = 0; i < studentIds.length; i += STUDENT_LOAD_BATCH) {
      const chunk = studentIds.slice(i, i + STUDENT_LOAD_BATCH);
      const rows = await this.db().student.findMany({
        where: { id: { in: chunk }, tenantId, deletedAt: null },
        include: this.studentInclude(),
      });
      loaded.push(...(rows as StudentScope[]));
    }
    return loaded;
  }

  private async resolveStudentsForSemester(
    tenantId: string,
    dto: BulkGenerateCycleDemandDto,
  ) {
    const standings = await this.db().studentAcademicStanding.findMany({
      where: {
        tenantId,
        currentSemesterSequence: dto.semesterNumber,
        lifecycleState: 'ACTIVE',
      },
      select: { studentId: true },
    });
    const ids = standings.map((s: { studentId: string }) => s.studentId);
    const students = await this.loadStudents(tenantId, ids);
    return students.filter((student) => {
      if (dto.programId && student.programVersion?.programId !== dto.programId)
        return false;
      if (dto.shiftId && student.primaryShiftId !== dto.shiftId) return false;
      return true;
    });
  }
}
