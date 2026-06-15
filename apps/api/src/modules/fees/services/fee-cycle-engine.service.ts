import { Injectable } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import {
  FEE_CYCLE_TRIGGER_SEMESTERS,
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

@Injectable()
export class FeeCycleEngineService {
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
      ? await Promise.all(
          dto.studentIds.map((id) => this.loadStudent(user.tid, id)),
        )
      : await this.resolveStudentsForSemester(user.tid, dto);

    const results: Array<Record<string, unknown>> = [];
    let createdCount = 0;
    let skippedCount = 0;

    for (const student of students.filter(Boolean) as StudentScope[]) {
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
    }

    return { createdCount, skippedCount, results };
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
    const demandNo = await this.nextDemandNo(user.tid);
    const demand = await this.db().studentFeeDemand.create({
      data: {
        tenantId: user.tid,
        studentId: student.id,
        feeCycleId: preview.cycle.id,
        academicYearId: student.academicProfile?.admissionYearId,
        semesterNumber: preview.semesterNumber ?? preview.cycle.startSemester,
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
        after: demand,
        metadata: { feeCycleId: preview.cycle.id },
      },
    });

    if (publish) {
      await this.feeSummary.touchAfterPayment(user.tid, student.id);
    }

    return demand;
  }

  private async nextDemandNo(tenantId: string) {
    const year = new Date().getFullYear();
    const count = await this.db().studentFeeDemand.count({
      where: { tenantId },
    });
    return `FD-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  private async loadStudent(
    tenantId: string,
    studentId: string,
  ): Promise<StudentScope | null> {
    return this.db().student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
      include: {
        academicProfile: true,
        academicStanding: true,
        programVersion: { select: { programId: true } },
      },
    });
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
    const students = await Promise.all(
      ids.map((id: string) => this.loadStudent(tenantId, id)),
    );
    return students.filter((student) => {
      if (!student) return false;
      if (dto.programId && student.programVersion?.programId !== dto.programId)
        return false;
      if (dto.shiftId && student.primaryShiftId !== dto.shiftId) return false;
      return true;
    });
  }
}
