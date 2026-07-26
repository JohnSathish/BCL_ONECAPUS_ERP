import { Injectable } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import {
  MONTHLY_DEMAND_TYPE,
  VTC_MONTHLY_MODIFIER,
} from '../constants/monthly-fee.constants';
import { FeeCalendarSyncService } from '../fee-calendar-sync.service';
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
    private readonly feeCalendar: FeeCalendarSyncService,
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
    void this.feeCalendar.syncMonthlyPeriod(user, ready.billingPeriod);
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

    if (created.length) {
      const periodsSynced = [...new Set(created.map((c) => c.period))];
      for (const period of periodsSynced) {
        void this.feeCalendar.syncMonthlyPeriod(user, period);
      }
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
    if (created > 0) {
      void this.feeCalendar.syncMonthlyPeriod(
        { tid: tenantId, sub: actorId || 'system' },
        billingPeriod,
      );
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

    const lines = await this.buildCurrentMonthLines(tenantId, student, plan);

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

  /**
   * Stream for monthly fee plans. Prefer immutable program codes (BA-*, BSC-*,
   * BCOM) so display renames (e.g. "FYUP in Political Science") never mis-route
   * fees. Never treat substring "science" in political-science as B.Sc.
   */
  private resolveStudentStream(
    student: StudentCtx,
  ): 'arts' | 'commerce' | 'science' | 'geography' {
    const majorSlug = (
      student.programChoices?.[0]?.subjectSlug ?? ''
    ).toLowerCase();
    const programName = (
      student.programVersion?.program?.name ?? ''
    ).toLowerCase();
    const programCode = (
      student.programVersion?.program?.code ?? ''
    ).toUpperCase();
    const programText = `${programName} ${programCode.toLowerCase()}`;
    const tokens = majorSlug.split(/[-_\s/]+/).filter(Boolean);

    // Geography practical plan (arts with lab fee).
    if (
      programCode === 'BA-GEO' ||
      tokens.includes('geography') ||
      programText.includes('geography')
    ) {
      return 'geography';
    }

    // Immutable codes first (stable across NEP display renames).
    if (programCode.startsWith('BCOM') || programCode === 'B.COM') {
      return 'commerce';
    }
    if (programCode.startsWith('BSC-')) return 'science';
    if (programCode.startsWith('BA-')) return 'arts';

    // Legacy / name / slug fallbacks (Bachelor of … and FYUP in …).
    if (
      tokens.includes('commerce') ||
      /bachelor of commerce|fyup in commerce/.test(programText)
    ) {
      return 'commerce';
    }

    const scienceMajors = new Set([
      'physics',
      'chemistry',
      'botany',
      'zoology',
      'mathematics',
      'maths',
      'biochemistry',
      'biotechnology',
      'microbiology',
    ]);
    if (
      tokens.some((t) => scienceMajors.has(t)) ||
      /bachelor of science|fyup in (physics|chemistry|botany|zoology|mathematics)/.test(
        programText,
      )
    ) {
      return 'science';
    }
    // Exact stream slug only — not "*science*" (political-science, etc.)
    if (majorSlug === 'science' || tokens.join('-') === 'science') {
      return 'science';
    }

    if (
      tokens.includes('political') ||
      programText.includes('political science') ||
      /bachelor of arts|fyup in /.test(programText)
    ) {
      return 'arts';
    }

    return 'arts';
  }

  private async buildCurrentMonthLines(
    tenantId: string,
    student: StudentCtx,
    plan: { id: string; code?: string; lines?: Array<Record<string, unknown>> },
  ) {
    const lines = [
      ...(plan.lines ?? []).map(
        (l: { code?: string; name?: string; amount?: unknown }) => ({
          code: String(l.code),
          name: String(l.name),
          category: 'MONTHLY',
          unitAmount: Number(l.amount),
          amount: Number(l.amount),
          quantity: 1,
          sourceType: 'MONTHLY_PLAN',
          sourceRefId: plan.id,
        }),
      ),
    ];

    const stream = this.resolveStudentStream(student);
    if (stream === 'geography' && !lines.some((l) => l.code === 'LAB_FEE')) {
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
    if (hasVtc && !lines.some((l) => l.code === VTC_MONTHLY_MODIFIER.code)) {
      lines.push({
        code: VTC_MONTHLY_MODIFIER.code,
        name: VTC_MONTHLY_MODIFIER.name,
        category: 'MONTHLY',
        unitAmount: VTC_MONTHLY_MODIFIER.amount,
        amount: VTC_MONTHLY_MODIFIER.amount,
        quantity: 1,
        sourceType: 'MODIFIER',
        sourceRefId: plan.id,
      });
    }

    return lines;
  }

  private async resolvePlan(tenantId: string, student: StudentCtx) {
    const plans = await this.db().monthlyFeePlan.findMany({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });
    const stream = this.resolveStudentStream(student);
    const shiftCode = student.primaryShift?.code?.toUpperCase() ?? '';
    const programId = student.programVersion?.programId;
    // Fee structure: Morning & Evening share Arts Morning rates.
    const artsMorningShift =
      shiftCode === 'MORNING' || shiftCode === 'EVENING' || !shiftCode;

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

      if (stream === 'geography' && plan.code === 'ARTS_GEO_PRACTICAL')
        pts += 40;
      if (stream === 'commerce' && plan.code === 'COMMERCE') pts += 40;
      if (stream === 'science' && plan.code === 'SCIENCE') pts += 40;
      if (stream === 'arts' && artsMorningShift && plan.code === 'ARTS_MORNING')
        pts += 40;
      if (stream === 'arts' && shiftCode === 'DAY' && plan.code === 'ARTS_DAY')
        pts += 40;
      // Geography uses its own plan; do not also score arts shift plans higher.
      if (
        stream === 'geography' &&
        artsMorningShift &&
        plan.code === 'ARTS_MORNING'
      )
        pts += 4;
      if (
        stream === 'geography' &&
        shiftCode === 'DAY' &&
        plan.code === 'ARTS_DAY'
      )
        pts += 4;

      return pts;
    };

    return (
      plans.sort(
        (a: { code?: string }, b: { code?: string }) => score(b) - score(a),
      )[0] ?? null
    );
  }

  /**
   * True when the student has an active VTC paper (registration line or VTC track).
   * Sem 3 imports register VTC on semester lines; track may be empty.
   */
  async hasActiveVtc(tenantId: string, studentId: string) {
    const track = await this.db().studentVtcTrack.findFirst({
      where: { tenantId, studentId, resetAt: null },
    });
    if (track) return true;

    const standing = await this.db().studentAcademicStanding.findUnique({
      where: { studentId },
      select: { currentSemesterSequence: true },
    });
    const seq = standing?.currentSemesterSequence ?? 1;

    // Sem 3–6 VTC papers live on registration lines; imports often never
    // create studentVtcTrack rows.
    const registrations = await this.db().semesterRegistration.findMany({
      where: {
        tenantId,
        studentId,
        semesterSequence: { in: [seq, 3, 4, 5, 6] },
        status: { notIn: ['cancelled', 'CANCELLED'] },
      },
      include: {
        lines: {
          include: {
            offering: { include: { course: { select: { code: true } } } },
          },
        },
      },
      take: 8,
    });

    for (const reg of registrations) {
      for (const line of reg.lines ?? []) {
        const lineStatus = String(line.status ?? '').toLowerCase();
        if (lineStatus === 'cancelled' || lineStatus === 'dropped') continue;

        const category = String(line.category ?? '').toUpperCase();
        const offeringCategory = String(
          line.offering?.category ?? '',
        ).toUpperCase();
        const code = String(line.offering?.course?.code ?? '').toUpperCase();
        if (
          category === 'VTC' ||
          offeringCategory === 'VTC' ||
          code.startsWith('VTC')
        ) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Rebuild open monthly demands when plan matching was wrong
   * (e.g. Political Science matched SCIENCE via substring "science").
   */
  async reconcileOpenMonthlyDemands(tenantId: string, studentId: string) {
    const student = await this.loadStudent(tenantId, studentId);
    if (!student) return { updated: 0 };

    const plan = await this.resolvePlan(tenantId, student);
    if (!plan) return { updated: 0 };

    const demands = await this.db().studentFeeDemand.findMany({
      where: {
        tenantId,
        studentId,
        demandType: MONTHLY_DEMAND_TYPE,
        status: { in: ['PUBLISHED', 'LOCKED', 'PARTIALLY_PAID'] },
      },
      include: { lines: true },
    });

    let updated = 0;
    for (const demand of demands) {
      const metadata = (demand.metadata ?? {}) as {
        planCode?: string;
        arrearsCarriedForward?: number;
      };
      if (metadata.planCode === plan.code) continue;

      const existingLines = (demand.lines ?? []) as Array<{
        id: string;
        code?: string;
        amount?: unknown;
      }>;
      const arrearsLine = existingLines.find((l) => l.code === 'ARREARS');
      const arrearsAmount = arrearsLine ? Number(arrearsLine.amount) : 0;

      const correctLines = await this.buildCurrentMonthLines(
        tenantId,
        student,
        plan,
      );
      const monthlyTotal = correctLines.reduce((s, l) => s + l.amount, 0);
      const newTotal = monthlyTotal + arrearsAmount;
      const oldTotal = Number(demand.totalAmount);
      const delta = newTotal - oldTotal;
      if (delta === 0 && metadata.planCode === plan.code) continue;

      const paid = Number(demand.paidAmount ?? 0);
      const newBalance = Math.max(0, newTotal - paid);

      await this.db().studentFeeDemandLine.deleteMany({
        where: {
          demandId: demand.id,
          code: { not: 'ARREARS' },
        },
      });

      for (const line of correctLines) {
        await this.db().studentFeeDemandLine.create({
          data: {
            tenantId,
            demandId: demand.id,
            code: line.code,
            name: line.name,
            category: line.category,
            quantity: line.quantity,
            unitAmount: line.unitAmount,
            amount: line.amount,
            sourceType: line.sourceType,
            sourceRefId: line.sourceRefId,
          },
        });
      }

      await this.db().studentFeeDemand.update({
        where: { id: demand.id },
        data: {
          monthlyFeePlanId: plan.id,
          totalAmount: newTotal,
          balanceAmount: newBalance,
          metadata: {
            ...metadata,
            planCode: plan.code,
            arrearsCarriedForward: arrearsAmount,
            reconciledFromPlan: metadata.planCode ?? null,
          },
        },
      });

      if (delta !== 0) {
        await this.ledger.post({
          tenantId,
          studentId,
          demandId: demand.id,
          entryType: delta > 0 ? 'CHARGE' : 'REVERSAL',
          debitAmount: delta > 0 ? delta : 0,
          creditAmount: delta < 0 ? Math.abs(delta) : 0,
          referenceType: 'DEMAND',
          referenceId: demand.id,
          description: `Monthly plan correction (${metadata.planCode ?? '?'} → ${plan.code}) — ${demand.billingPeriod}`,
        });
      }
      updated += 1;
    }

    if (updated > 0) {
      await this.feeSummary.touchAfterPayment(tenantId, studentId);
    }
    return { updated };
  }

  /**
   * Add ₹100 VTC line to open monthly demands that are missing it
   * (for students who already had tuition generated before VTC detection was fixed).
   */
  async ensureVtcFeeOnOpenDemands(tenantId: string, studentId: string) {
    const hasVtc = await this.hasActiveVtc(tenantId, studentId);
    if (!hasVtc) return { updated: 0 };

    const demands = await this.db().studentFeeDemand.findMany({
      where: {
        tenantId,
        studentId,
        demandType: MONTHLY_DEMAND_TYPE,
        status: { in: ['PUBLISHED', 'LOCKED', 'PARTIALLY_PAID'] },
      },
      include: { lines: true },
    });

    let updated = 0;
    for (const demand of demands) {
      const lines = (demand.lines ?? []) as Array<{ code?: string }>;
      if (lines.some((line) => line.code === VTC_MONTHLY_MODIFIER.code)) {
        continue;
      }

      const amount = VTC_MONTHLY_MODIFIER.amount;
      await this.db().studentFeeDemandLine.create({
        data: {
          tenantId,
          demandId: demand.id,
          code: VTC_MONTHLY_MODIFIER.code,
          name: VTC_MONTHLY_MODIFIER.name,
          category: 'MONTHLY',
          quantity: 1,
          unitAmount: amount,
          amount,
          sourceType: 'MODIFIER',
        },
      });

      await this.db().studentFeeDemand.update({
        where: { id: demand.id },
        data: {
          totalAmount: Number(demand.totalAmount) + amount,
          balanceAmount: Number(demand.balanceAmount) + amount,
        },
      });

      await this.ledger.post({
        tenantId,
        studentId,
        demandId: demand.id,
        entryType: 'CHARGE',
        debitAmount: amount,
        referenceType: 'DEMAND',
        referenceId: demand.id,
        description: `VTC subject fee — ${demand.billingPeriod}`,
      });
      updated += 1;
    }

    if (updated > 0) {
      await this.feeSummary.touchAfterPayment(tenantId, studentId);
    }
    return { updated };
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
