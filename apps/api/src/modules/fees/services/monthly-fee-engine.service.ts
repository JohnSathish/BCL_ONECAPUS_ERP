import { Injectable } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { MONTHLY_DEMAND_TYPE } from '../constants/monthly-fee.constants';
import { FeeFinanceSettingsService } from './fee-finance-settings.service';
import { FeeLedgerService } from './fee-ledger.service';
import { StudentFeeSummaryService } from './student-fee-summary.service';
import { LicenseEnforcementService } from '../../licensing/services/license-enforcement.service';

type StudentCtx = {
  id: string;
  primaryShiftId?: string | null;
  programVersion?: {
    programId?: string | null;
    program?: { code?: string; name?: string };
  } | null;
  academicProfile?: { departmentId?: string | null } | null;
  programChoices?: Array<{ subjectSlug?: string }>;
  primaryShift?: { code?: string; name?: string } | null;
};

type MonthlyDemandPreview = {
  billingPeriod: string;
  plan: { id: string; code: string; name: string };
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
  dueDate?: Date;
};

function asMonthlyDemandPreview(preview: unknown): MonthlyDemandPreview | null {
  const row = preview as MonthlyDemandPreview;
  return row?.plan && row?.lines && row.totalAmount != null ? row : null;
}

@Injectable()
export class MonthlyFeeEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: FeeLedgerService,
    private readonly settings: FeeFinanceSettingsService,
    private readonly feeSummary: StudentFeeSummaryService,
    private readonly licenseEnforcement: LicenseEnforcementService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  billingPeriod(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  periodsFrom(startPeriod: string, count: number) {
    const [startYear, startMonth] = startPeriod.split('-').map(Number);
    const periods: string[] = [];
    let year = startYear;
    let month = startMonth;
    for (let i = 0; i < count; i += 1) {
      periods.push(`${year}-${String(month).padStart(2, '0')}`);
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
    return periods;
  }

  async previewForStudent(
    tenantId: string,
    studentId: string,
    period?: string,
  ) {
    const student = await this.loadStudent(tenantId, studentId);
    if (!student) return { skipped: true, reason: 'Student not found' };
    return this.evaluate(tenantId, student, period ?? this.billingPeriod());
  }

  async generateForStudent(user: JwtUser, studentId: string, period?: string) {
    await this.licenseEnforcement.assertWriteAllowed(user.tid, 'fee.write');
    const preview = await this.previewForStudent(user.tid, studentId, period);
    const ready = asMonthlyDemandPreview(preview);
    if (!ready) return preview;
    const demand = await this.createDemand(
      user.tid,
      studentId,
      ready,
      user.sub,
    );
    return { created: true, demand, preview };
  }

  async generateAdvanceForStudent(
    user: JwtUser,
    studentId: string,
    monthsAhead: number,
    startPeriod?: string,
  ) {
    await this.licenseEnforcement.assertWriteAllowed(user.tid, 'fee.write');
    const count = Math.min(Math.max(1, Math.floor(monthsAhead)), 12);
    const start = startPeriod ?? this.billingPeriod();
    const periods = this.periodsFrom(start, count);
    const created: Array<{ period: string; demandId: string; amount: number }> =
      [];
    const skipped: Array<{ period: string; reason?: string }> = [];

    for (const period of periods) {
      const preview = await this.previewForStudent(user.tid, studentId, period);
      const ready = asMonthlyDemandPreview(preview);
      if (!ready) {
        skipped.push({
          period,
          reason: (preview as { reason?: string }).reason,
        });
        continue;
      }
      const demand = await this.createDemand(
        user.tid,
        studentId,
        ready,
        user.sub,
      );
      created.push({ period, demandId: demand.id, amount: ready.totalAmount });
    }

    return {
      monthsAhead: count,
      startPeriod: start,
      endPeriod: periods[periods.length - 1],
      created: created.length,
      skipped: skipped.length,
      demands: created,
      skippedDetails: skipped,
    };
  }

  async generateBulk(tenantId: string, period?: string, actorId?: string) {
    const billingPeriod = period ?? this.billingPeriod();
    const standings = await this.db().studentAcademicStanding.findMany({
      where: { tenantId, lifecycleState: 'ACTIVE' },
      select: { studentId: true },
    });
    let created = 0;
    let skipped = 0;
    const results: Array<Record<string, unknown>> = [];

    for (const { studentId } of standings) {
      try {
        const preview = await this.previewForStudent(
          tenantId,
          studentId,
          billingPeriod,
        );
        const ready = asMonthlyDemandPreview(preview);
        if (!ready) {
          skipped += 1;
          results.push({
            studentId,
            skipped: true,
            reason: (preview as { reason?: string }).reason,
          });
          continue;
        }
        const demand = await this.createDemand(
          tenantId,
          studentId,
          ready,
          actorId,
        );
        created += 1;
        results.push({ studentId, demandId: demand.id });
      } catch (err) {
        skipped += 1;
        const message =
          err instanceof Error ? err.message : 'Generation failed';
        results.push({ studentId, skipped: true, reason: message });
      }
    }
    return { billingPeriod, created, skipped, results };
  }

  private async evaluate(
    tenantId: string,
    student: StudentCtx,
    billingPeriod: string,
  ) {
    const existing = await this.db().studentFeeDemand.findFirst({
      where: {
        tenantId,
        studentId: student.id,
        demandType: MONTHLY_DEMAND_TYPE,
        billingPeriod,
        status: { notIn: ['CANCELLED', 'ROLLED_BACK'] },
      },
    });
    if (existing) {
      return {
        studentId: student.id,
        skipped: true,
        reason: 'Monthly demand already exists',
        billingPeriod,
      };
    }

    const plan = await this.resolvePlan(tenantId, student);
    if (!plan) {
      return {
        studentId: student.id,
        skipped: true,
        reason: 'No matching monthly fee plan',
        billingPeriod,
      };
    }

    const lines = [
      ...(plan.lines ?? []).map(
        (l: { code: string; name: string; amount: unknown }) => ({
          code: l.code,
          name: l.name,
          category: 'MONTHLY',
          unitAmount: Number(l.amount),
          amount: Number(l.amount),
          quantity: 1,
          sourceType: 'MONTHLY_PLAN',
          sourceRefId: plan.id,
        }),
      ),
    ];

    const majorSlug =
      student.programChoices?.[0]?.subjectSlug?.toLowerCase() ?? '';
    if (
      majorSlug.includes('geography') &&
      !lines.some((l) => l.code === 'LAB_FEE')
    ) {
      lines.push({
        code: 'LAB_FEE',
        name: 'Lab Fee (Geography Practical)',
        category: 'MONTHLY',
        unitAmount: 200,
        amount: 200,
        quantity: 1,
        sourceType: 'MODIFIER',
        sourceRefId: plan.id,
      });
    }

    const sciencePracticalCount = await this.countSciencePracticals(
      tenantId,
      student.id,
    );
    if (sciencePracticalCount > 0 && plan.code === 'SCIENCE') {
      const labPerSubject = 450 + 350;
      lines.push({
        code: 'SCIENCE_LAB_PER_SUBJECT',
        name: `Science Lab (${sciencePracticalCount} practical subject(s))`,
        category: 'MONTHLY',
        unitAmount: labPerSubject,
        amount: labPerSubject * sciencePracticalCount,
        quantity: sciencePracticalCount,
        sourceType: 'MODIFIER',
        sourceRefId: plan.id,
      });
    }

    const hasVtc = await this.hasActiveVtc(tenantId, student.id);
    if (hasVtc) {
      lines.push({
        code: 'VTC',
        name: 'VTC Subject',
        category: 'MONTHLY',
        unitAmount: 100,
        amount: 100,
        quantity: 1,
        sourceType: 'MODIFIER',
        sourceRefId: plan.id,
      });
    }

    const currentPeriod = this.billingPeriod();
    let arrears = 0;
    if (billingPeriod <= currentPeriod) {
      arrears = await this.monthlyArrears(tenantId, student.id, billingPeriod);
    }
    if (arrears > 0) {
      lines.push({
        code: 'ARREARS',
        name: 'Outstanding from previous months',
        category: 'ARREARS',
        unitAmount: arrears,
        amount: arrears,
        quantity: 1,
        sourceType: 'ARREARS',
        sourceRefId: plan.id,
      });
    }

    const totalAmount = lines.reduce((s, l) => s + l.amount, 0);
    const dueDate = await this.settings.dueDateForPeriod(
      tenantId,
      billingPeriod,
    );

    return {
      studentId: student.id,
      skipped: false,
      billingPeriod,
      plan,
      lines,
      totalAmount,
      arrearsAmount: arrears,
      dueDate,
    };
  }

  private async resolvePlan(tenantId: string, student: StudentCtx) {
    const plans = await this.db().monthlyFeePlan.findMany({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });
    const majorSlug =
      student.programChoices?.[0]?.subjectSlug?.toLowerCase() ?? '';
    const shiftCode = student.primaryShift?.code?.toUpperCase() ?? '';
    const programId = student.programVersion?.programId;

    const score = (plan: {
      programId?: string | null;
      shiftId?: string | null;
      majorSlug?: string | null;
      code?: string;
    }) => {
      let pts = 0;
      if (plan.programId && plan.programId === programId) pts += 8;
      else if (!plan.programId) pts += 1;
      if (plan.shiftId && plan.shiftId === student.primaryShiftId) pts += 4;
      else if (!plan.shiftId) pts += 1;
      if (plan.majorSlug && majorSlug.includes(plan.majorSlug)) pts += 16;
      else if (!plan.majorSlug) pts += 1;
      if (majorSlug.includes('geography') && plan.code === 'ARTS_GEO_PRACTICAL')
        pts += 32;
      if (majorSlug.includes('commerce') && plan.code === 'COMMERCE') pts += 32;
      if (majorSlug.includes('science') && plan.code === 'SCIENCE') pts += 32;
      if (
        shiftCode &&
        ['MORNING', 'EVENING'].includes(shiftCode) &&
        plan.code === 'ARTS_MORNING'
      )
        pts += 8;
      if (shiftCode === 'DAY' && plan.code === 'ARTS_DAY') pts += 8;
      return pts;
    };

    return (
      plans.sort(
        (a: { code?: string }, b: { code?: string }) => score(b) - score(a),
      )[0] ?? null
    );
  }

  private async hasActiveVtc(tenantId: string, studentId: string) {
    const track = await this.db().studentVtcTrack.findFirst({
      where: { tenantId, studentId, resetAt: null },
    });
    return Boolean(track);
  }

  private async countSciencePracticals(tenantId: string, studentId: string) {
    const standing = await this.db().studentAcademicStanding.findUnique({
      where: { studentId },
      select: { currentSemesterSequence: true },
    });
    const seq = standing?.currentSemesterSequence ?? 1;
    const reg = await this.db().semesterRegistration.findFirst({
      where: {
        tenantId,
        studentId,
        semesterSequence: seq,
        status: { in: ['confirmed', 'completed'] },
      },
      include: {
        lines: { include: { offering: { include: { course: true } } } },
      },
    });
    if (!reg?.lines) return 0;
    return reg.lines.filter(
      (l: { offering?: { course?: { hasPractical?: boolean } } }) =>
        l.offering?.course?.hasPractical,
    ).length;
  }

  private async monthlyArrears(
    tenantId: string,
    studentId: string,
    currentPeriod: string,
  ) {
    const demands = await this.db().studentFeeDemand.findMany({
      where: {
        tenantId,
        studentId,
        demandType: MONTHLY_DEMAND_TYPE,
        status: { in: ['PUBLISHED', 'LOCKED', 'PARTIALLY_PAID'] },
        balanceAmount: { gt: 0 },
        billingPeriod: { lt: currentPeriod },
      },
    });
    return demands.reduce(
      (s: number, d: { balanceAmount: unknown }) => s + Number(d.balanceAmount),
      0,
    );
  }

  private async createDemand(
    tenantId: string,
    studentId: string,
    preview: MonthlyDemandPreview,
    actorId?: string,
  ) {
    const count = await this.db().studentFeeDemand.count({
      where: { tenantId },
    });
    const demand = await this.db().studentFeeDemand.create({
      data: {
        tenantId,
        studentId,
        monthlyFeePlanId: preview.plan.id,
        feeProductCode: 'MONTHLY_TUITION',
        demandNo: `MF-${preview.billingPeriod.replace('-', '')}-${String(count + 1).padStart(6, '0')}`,
        demandType: MONTHLY_DEMAND_TYPE,
        billingLayer: 'MONTHLY',
        billingPeriod: preview.billingPeriod,
        status: 'PUBLISHED',
        totalAmount: preview.totalAmount,
        balanceAmount: preview.totalAmount,
        dueDate: preview.dueDate,
        publishedAt: new Date(),
        generatedById: actorId,
        metadata: {
          planCode: preview.plan.code,
          arrearsCarriedForward: preview.arrearsAmount ?? 0,
        },
        lines: {
          create: preview.lines.map((line) => ({
            tenantId,
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
      tenantId,
      studentId,
      demandId: demand.id,
      entryType: 'CHARGE',
      debitAmount: preview.totalAmount,
      referenceType: 'DEMAND',
      referenceId: demand.id,
      description: `Monthly tuition — ${preview.billingPeriod}`,
      postedById: actorId,
    });

    await this.feeSummary.touchAfterPayment(tenantId, studentId);

    return demand;
  }

  private loadStudent(
    tenantId: string,
    studentId: string,
  ): Promise<StudentCtx | null> {
    return this.db().student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
      include: {
        programVersion: { include: { program: true } },
        academicProfile: true,
        primaryShift: true,
        programChoices: {
          where: { choiceType: 'MAJOR', deletedAt: null, status: 'active' },
          take: 1,
          select: { subjectSlug: true },
        },
      },
    });
  }
}
