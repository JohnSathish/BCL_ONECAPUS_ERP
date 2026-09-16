import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import ExcelJS from 'exceljs';
import puppeteer from 'puppeteer';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SchoolSisService } from './school-sis.service';
import { SchoolSisEventBus } from './school-sis-event-bus.service';
import type {
  CollectSchoolFeeDto,
  SaveSchoolFeeSettingsDto,
  SaveSchoolMonthlyFeePlanDto,
  VoidSchoolFeeDto,
} from './dto/school-sis.dto';
import {
  monthLabel,
  monthlyFeeReceiptHtml,
  type MonthlyFeeReceiptView,
} from './school-sis-monthly-fee-receipt';

export const JUNIOR_FEE_CODES = [
  'NURSERY',
  'LKG',
  'UKG',
  'I',
  'II',
  'III',
  'IV',
] as const;

/** Printed Class V–X monthly fee book (pink cover, March–December slips). */
export const MIDDLE_FEE_CODES = ['V', 'VI', 'VII', 'VIII', 'IX', 'X'] as const;

export const MONTHLY_FEE_CODES = [
  ...JUNIOR_FEE_CODES,
  ...MIDDLE_FEE_CODES,
] as const;

const DEFAULT_INSTRUCTIONS = [
  'Fees are to be paid before the 15th of every month.',
  'Annual Fees and Jan. & Feb. Tuition Fees to be paid at the time of Admission.',
  'Pupils with dues may be barred from sitting for the Examinations.',
  'Fees once paid are not refundable.',
];

const MIDDLE_INSTRUCTIONS = [
  'Fees are to be paid before the 10th of every month.',
  'Annual Fees and Jan. & Feb. Tuition Fees to be paid at the time of Admission.',
  'Pupils with dues may be barred from sitting for the Examinations.',
  'Fees once paid are not refundable.',
];

function isMonthlyFeeGrade(
  code: string,
): code is (typeof MONTHLY_FEE_CODES)[number] {
  return (MONTHLY_FEE_CODES as readonly string[]).includes(code);
}

function isMiddleFeeGrade(code: string) {
  return (MIDDLE_FEE_CODES as readonly string[]).includes(code);
}

function dueDayForGrade(code: string, settingsDueDay: number) {
  return isMiddleFeeGrade(code) ? 10 : settingsDueDay;
}

function instructionsForGrade(code: string, stored: string[]) {
  if (isMiddleFeeGrade(code)) return MIDDLE_INSTRUCTIONS;
  return stored.length ? stored : DEFAULT_INSTRUCTIONS;
}

function otherLabelForGrade(code: string) {
  return isMiddleFeeGrade(code) ? 'Computer Fee' : 'Other Fee';
}

const DEFAULT_METHODS = ['CASH', 'UPI', 'BANK', 'CHEQUE', 'ONLINE', 'OTHER'];

function isMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function dueDate(feeMonth: string, dueDay: number) {
  const [y, m] = feeMonth.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return new Date(y, m - 1, Math.min(dueDay, last));
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

@Injectable()
export class SchoolSisMonthlyFeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sis: SchoolSisService,
    private readonly events: SchoolSisEventBus,
  ) {}

  async ensureSetup(tenantId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const year = await this.sis.currentYear(tenantId);
    await this.ensureLkg(tenantId);
    const settings = await this.ensureSettings(tenantId, year.id);
    const plans = await this.ensurePlans(tenantId, year.id);
    return { year, settings, plans };
  }

  private async ensureLkg(tenantId: string) {
    const existing = await this.prisma.schoolGrade.findFirst({
      where: { tenantId, code: 'LKG', deletedAt: null },
    });
    if (existing) return existing;
    return this.prisma.schoolGrade.create({
      data: { tenantId, code: 'LKG', name: 'LKG', sortOrder: 1, active: true },
    });
  }

  private async ensureSettings(tenantId: string, academicYearId: string) {
    const branding = await this.prisma.tenantBranding.findUnique({
      where: { tenantId },
    });
    const found = await this.prisma.schoolFeeSettings.findUnique({
      where: { tenantId_academicYearId: { tenantId, academicYearId } },
    });
    if (found) return found;
    return this.prisma.schoolFeeSettings.create({
      data: {
        tenantId,
        academicYearId,
        schoolName:
          branding?.displayName || "St. Luke's Secondary School, Tura",
        schoolAddress:
          branding?.address ||
          'Walbakgre, Tura - 794101, West Garo Hills, Meghalaya',
        logoUrl: branding?.logoUrl ?? null,
        instructionsJson: DEFAULT_INSTRUCTIONS,
        paymentMethods: DEFAULT_METHODS,
      },
    });
  }

  private async ensurePlans(tenantId: string, academicYearId: string) {
    const grades = await this.prisma.schoolGrade.findMany({
      where: {
        tenantId,
        deletedAt: null,
        code: { in: [...MONTHLY_FEE_CODES] },
      },
      orderBy: { sortOrder: 'asc' },
    });
    const existing = await this.prisma.schoolMonthlyFeePlan.findMany({
      where: { tenantId, academicYearId },
    });
    const byGrade = new Map(existing.map((row) => [row.gradeId, row]));
    for (const grade of grades) {
      if (byGrade.has(grade.id)) continue;
      const middle = isMiddleFeeGrade(grade.code);
      const tuition = middle
        ? 600
        : await this.defaultTuition(tenantId, academicYearId, grade.id);
      const created = await this.prisma.schoolMonthlyFeePlan.create({
        data: {
          tenantId,
          academicYearId,
          gradeId: grade.id,
          tuitionAmount: tuition,
          otherAmount: middle ? 100 : 0,
        },
      });
      byGrade.set(grade.id, created);
    }
    return this.prisma.schoolMonthlyFeePlan.findMany({
      where: { tenantId, academicYearId },
      include: { grade: true },
      orderBy: { grade: { sortOrder: 'asc' } },
    });
  }

  private async defaultTuition(
    tenantId: string,
    academicYearId: string,
    gradeId: string,
  ) {
    const structure = await this.prisma.schoolFeeStructure.findFirst({
      where: { tenantId, academicYearId, gradeId, status: 'PUBLISHED' },
      include: { lines: true },
    });
    const monthly = structure?.lines.find(
      (l) => l.code === 'TUI-M' && l.amount,
    );
    if (monthly?.amount) return monthly.amount;
    const janFeb = structure?.lines.find(
      (l) => l.code === 'TUI-JF' && l.amount,
    );
    if (janFeb?.amount) return Math.round(janFeb.amount / 2);
    return 600;
  }

  async getConfig(tenantId: string) {
    const { year, settings, plans } = await this.ensureSetup(tenantId);
    const updater = settings.updatedById
      ? await this.prisma.user.findFirst({
          where: { id: settings.updatedById, tenantId },
          select: { displayName: true, username: true, email: true },
        })
      : null;
    const defaultGw = await this.prisma.schoolPaymentGateway.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        isDefault: true,
        isActive: true,
        connectionStatus: 'OK',
      },
      select: { name: true, provider: true, environment: true },
    });
    const grades = await this.prisma.schoolGrade.findMany({
      where: {
        tenantId,
        deletedAt: null,
        code: { in: [...MONTHLY_FEE_CODES] },
      },
      select: { name: true, code: true },
      orderBy: { sortOrder: 'asc' },
    });
    return {
      academicYear: year,
      settings: this.publicSettings(settings),
      plans,
      applicableClasses: grades,
      updatedAt: settings.updatedAt,
      updatedBy: updater
        ? updater.displayName || updater.username || updater.email
        : null,
      onlinePayments: {
        available: Boolean(defaultGw),
        gatewayName: defaultGw?.name ?? null,
        provider: defaultGw?.provider ?? null,
        environment: defaultGw?.environment ?? null,
        warning: defaultGw
          ? null
          : 'Online payments are currently unavailable. No active default payment gateway has been configured.',
      },
    };
  }

  private publicSettings(settings: {
    dueDay: number;
    lateFeeAmount: number;
    lateFeeEnabled: boolean;
    paymentMethods: Prisma.JsonValue;
    receiptPrefix: string;
    signatoryName: string | null;
    schoolName: string;
    schoolAddress: string;
    logoUrl: string | null;
    instructionsJson: Prisma.JsonValue;
    refundPolicy?: string | null;
    examInstructions?: string | null;
    otherNotes?: string | null;
  }) {
    return {
      ...settings,
      paymentMethods: Array.isArray(settings.paymentMethods)
        ? (settings.paymentMethods as string[])
        : DEFAULT_METHODS,
      instructionsJson: Array.isArray(settings.instructionsJson)
        ? (settings.instructionsJson as string[])
        : DEFAULT_INSTRUCTIONS,
    };
  }

  async saveSettings(
    tenantId: string,
    dto: SaveSchoolFeeSettingsDto,
    actorUserId?: string,
  ) {
    const { year } = await this.ensureSetup(tenantId);
    return this.prisma.schoolFeeSettings.update({
      where: {
        tenantId_academicYearId: { tenantId, academicYearId: year.id },
      },
      data: {
        ...(dto.dueDay !== undefined ? { dueDay: dto.dueDay } : {}),
        ...(dto.lateFeeAmount !== undefined
          ? { lateFeeAmount: dto.lateFeeAmount }
          : {}),
        ...(dto.lateFeeEnabled !== undefined
          ? { lateFeeEnabled: dto.lateFeeEnabled }
          : {}),
        ...(dto.paymentMethods
          ? { paymentMethods: dto.paymentMethods as Prisma.InputJsonValue }
          : {}),
        ...(dto.receiptPrefix
          ? { receiptPrefix: dto.receiptPrefix.trim().toUpperCase() }
          : {}),
        ...(dto.signatoryName !== undefined
          ? { signatoryName: dto.signatoryName.trim() || null }
          : {}),
        ...(dto.schoolName ? { schoolName: dto.schoolName.trim() } : {}),
        ...(dto.schoolAddress
          ? { schoolAddress: dto.schoolAddress.trim() }
          : {}),
        ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl || null } : {}),
        ...(dto.instructions ? { instructionsJson: dto.instructions } : {}),
        ...(dto.refundPolicy !== undefined
          ? { refundPolicy: dto.refundPolicy.trim() || null }
          : {}),
        ...(dto.examInstructions !== undefined
          ? { examInstructions: dto.examInstructions.trim() || null }
          : {}),
        ...(dto.otherNotes !== undefined
          ? { otherNotes: dto.otherNotes.trim() || null }
          : {}),
        ...(actorUserId ? { updatedById: actorUserId } : {}),
      },
    });
  }

  async resetSettings(tenantId: string, actorUserId?: string) {
    const { year } = await this.ensureSetup(tenantId);
    return this.prisma.schoolFeeSettings.update({
      where: {
        tenantId_academicYearId: { tenantId, academicYearId: year.id },
      },
      data: {
        dueDay: 15,
        lateFeeAmount: 20,
        lateFeeEnabled: true,
        paymentMethods: DEFAULT_METHODS,
        receiptPrefix: 'FB',
        instructionsJson: DEFAULT_INSTRUCTIONS,
        refundPolicy: 'Fees once paid are not refundable.',
        examInstructions:
          'Pupils with dues may be barred from sitting for the Examinations.',
        otherNotes: null,
        updatedById: actorUserId ?? null,
      },
    });
  }

  async savePlan(tenantId: string, dto: SaveSchoolMonthlyFeePlanDto) {
    const { year } = await this.ensureSetup(tenantId);
    const grade = await this.prisma.schoolGrade.findFirst({
      where: { id: dto.gradeId, tenantId, deletedAt: null },
    });
    if (!grade) throw new NotFoundException('Class not found');
    return this.prisma.schoolMonthlyFeePlan.upsert({
      where: {
        tenantId_academicYearId_gradeId: {
          tenantId,
          academicYearId: year.id,
          gradeId: grade.id,
        },
      },
      update: {
        tuitionAmount: dto.tuitionAmount,
        lateFeeAmount: dto.lateFeeAmount ?? null,
        otherAmount: dto.otherAmount ?? 0,
        active: dto.active ?? true,
      },
      create: {
        tenantId,
        academicYearId: year.id,
        gradeId: grade.id,
        tuitionAmount: dto.tuitionAmount,
        lateFeeAmount: dto.lateFeeAmount ?? null,
        otherAmount: dto.otherAmount ?? 0,
        active: dto.active ?? true,
      },
      include: { grade: true },
    });
  }

  async quote(tenantId: string, studentId: string, feeMonth: string) {
    if (!isMonth(feeMonth))
      throw new BadRequestException('Use fee month YYYY-MM');
    const { year, settings, plans } = await this.ensureSetup(tenantId);
    const enrollment = await this.loadMonthlyEnrollment(
      tenantId,
      year.id,
      studentId,
    );
    const paid = await this.prisma.schoolFeePayment.findFirst({
      where: {
        tenantId,
        academicYearId: year.id,
        studentId,
        feeMonth,
        status: 'PAID',
      },
    });
    const plan = plans.find((p) => p.gradeId === enrollment.section.gradeId);
    const gradeCode = enrollment.section.grade.code;
    const tuition = plan?.tuitionAmount ?? 600;
    const other = plan?.otherAmount ?? (isMiddleFeeGrade(gradeCode) ? 100 : 0);
    const lateRule = plan?.lateFeeAmount ?? settings.lateFeeAmount;
    const lateApplies =
      Boolean(settings.lateFeeEnabled) &&
      startOfDay(new Date()) >
        dueDate(feeMonth, dueDayForGrade(gradeCode, settings.dueDay));
    const previousBalance = await this.arrears(
      tenantId,
      year.id,
      studentId,
      feeMonth,
      enrollment.section.gradeId,
      plans,
    );
    const lateFeeAmount = lateApplies ? lateRule : 0;
    const totalAmount = Math.max(
      0,
      tuition + other + lateFeeAmount + previousBalance,
    );
    return {
      academicYear: year,
      settings: this.publicSettings(settings),
      student: {
        id: enrollment.student.id,
        fullName: enrollment.student.fullName,
        admissionNumber: enrollment.student.admissionNumber,
      },
      className: enrollment.section.grade.name,
      sectionName: enrollment.section.name,
      gradeId: enrollment.section.gradeId,
      sectionId: enrollment.section.id,
      enrollmentId: enrollment.id,
      feeMonth,
      monthLabel: monthLabel(feeMonth),
      paid: Boolean(paid),
      payment: paid,
      tuitionAmount: tuition,
      otherAmount: other,
      lateFeeAmount,
      lateApplies,
      previousBalance,
      discountAmount: 0,
      totalAmount,
    };
  }

  private async arrears(
    tenantId: string,
    yearId: string,
    studentId: string,
    feeMonth: string,
    gradeId: string,
    plans: Array<{
      gradeId: string;
      tuitionAmount: number;
      otherAmount: number;
    }>,
  ) {
    const year = await this.prisma.schoolAcademicYear.findFirstOrThrow({
      where: { id: yearId },
    });
    const months = this.monthsBetween(year.startDate, year.endDate).filter(
      (m) => m < feeMonth,
    );
    if (!months.length) return 0;
    const paid = await this.prisma.schoolFeePayment.findMany({
      where: {
        tenantId,
        academicYearId: yearId,
        studentId,
        status: 'PAID',
        feeMonth: { in: months },
      },
      select: { feeMonth: true },
    });
    const paidSet = new Set(paid.map((p) => p.feeMonth));
    const plan = plans.find((p) => p.gradeId === gradeId);
    const monthly = (plan?.tuitionAmount ?? 600) + (plan?.otherAmount ?? 0);
    return months.filter((m) => !paidSet.has(m)).length * monthly;
  }

  private monthsBetween(start: Date, end: Date) {
    const out: string[] = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cursor <= last) {
      out.push(
        `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`,
      );
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return out;
  }

  private async loadMonthlyEnrollment(
    tenantId: string,
    yearId: string,
    studentId: string,
  ) {
    const enrollment = await this.prisma.schoolEnrollment.findFirst({
      where: {
        tenantId,
        academicYearId: yearId,
        studentId,
        deletedAt: null,
        status: 'ACTIVE',
      },
      include: {
        student: true,
        section: { include: { grade: true } },
      },
    });
    if (!enrollment)
      throw new NotFoundException('Student is not enrolled this year');
    if (!isMonthlyFeeGrade(enrollment.section.grade.code)) {
      throw new BadRequestException(
        'This monthly fee book is for Nursery–Class X. Class XI uses the annual structure.',
      );
    }
    return enrollment;
  }

  async ledger(tenantId: string, studentId: string) {
    const { year, settings, plans } = await this.ensureSetup(tenantId);
    const enrollment = await this.loadMonthlyEnrollment(
      tenantId,
      year.id,
      studentId,
    );
    const plan = plans.find((p) => p.gradeId === enrollment.section.gradeId);
    const gradeCode = enrollment.section.grade.code;
    const tuition = plan?.tuitionAmount ?? 600;
    const other = plan?.otherAmount ?? (isMiddleFeeGrade(gradeCode) ? 100 : 0);
    const lateRule = plan?.lateFeeAmount ?? settings.lateFeeAmount;
    const dueDay = dueDayForGrade(gradeCode, settings.dueDay);
    const today = startOfDay(new Date());
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const horizon = today < year.endDate ? today : year.endDate;
    const months = this.monthsBetween(year.startDate, horizon);
    const accounts = await this.prisma.schoolFeeMonthAccount.findMany({
      where: { tenantId, academicYearId: year.id, studentId },
    });
    const accountMap = new Map(accounts.map((a) => [a.feeMonth, a]));
    const history = await this.prisma.schoolFeePayment.findMany({
      where: { tenantId, academicYearId: year.id, studentId },
      include: { lines: { orderBy: { feeMonth: 'asc' } } },
      orderBy: { paidAt: 'desc' },
      take: 40,
    });
    const lastPaid = history.find((p) => p.status === 'PAID');
    const rows = months.map((feeMonth) => {
      const account = accountMap.get(feeMonth);
      const paidAmount = account?.paidAmount ?? 0;
      const lateApplies =
        Boolean(settings.lateFeeEnabled) && today > dueDate(feeMonth, dueDay);
      const lateFeeAmount = lateApplies ? lateRule : 0;
      const dueAmount = tuition + other + lateFeeAmount;
      const remaining = Math.max(0, dueAmount - paidAmount);
      let status: 'PAID' | 'PARTIAL' | 'DUE' | 'OVERDUE' = 'DUE';
      if (paidAmount >= dueAmount && dueAmount > 0) status = 'PAID';
      else if (account?.status === 'PAID') status = 'PAID';
      else if (paidAmount > 0) status = 'PARTIAL';
      else if (lateApplies) status = 'OVERDUE';
      return {
        feeMonth,
        monthLabel: monthLabel(feeMonth),
        tuitionAmount: tuition,
        otherAmount: other,
        lateFeeAmount,
        lateApplies,
        lateReason: lateApplies
          ? `${monthLabel(feeMonth)} — Late Fee ₹${lateRule} (due by the ${dueDay}th)`
          : null,
        previousDue: 0,
        paidAmount,
        totalDue: remaining,
        grossDue: dueAmount,
        status,
        selectable: status !== 'PAID',
      };
    });
    const unpaid = rows.filter((r) => r.status !== 'PAID');
    const current = rows.find((r) => r.feeMonth === currentMonth);
    return {
      academicYear: year,
      settings: {
        ...this.publicSettings(settings),
        dueDay,
        instructionsJson: instructionsForGrade(
          gradeCode,
          this.publicSettings(settings).instructionsJson,
        ),
      },
      student: {
        id: enrollment.student.id,
        fullName: enrollment.student.fullName,
        admissionNumber: enrollment.student.admissionNumber,
        phone: enrollment.student.phone,
      },
      className: enrollment.section.grade.name,
      sectionName: enrollment.section.name,
      gradeCode,
      otherLabel: otherLabelForGrade(gradeCode),
      gradeId: enrollment.section.gradeId,
      sectionId: enrollment.section.id,
      enrollmentId: enrollment.id,
      currentMonth,
      currentMonthStatus: current?.status ?? 'DUE',
      unpaidMonths: unpaid.length,
      totalOutstanding: unpaid.reduce((sum, r) => sum + r.totalDue, 0),
      lastPaymentDate: lastPaid?.paidAt ?? null,
      lastReceiptNumber: lastPaid?.receiptNumber ?? null,
      rows,
      history: history.map((p) => ({
        id: p.id,
        paidAt: p.paidAt,
        receiptNumber: p.receiptNumber,
        months:
          p.lines.length > 0 ? p.lines.map((l) => l.feeMonth) : [p.feeMonth],
        amount: p.totalAmount,
        paymentMode: p.paymentMode,
        collectedById: p.collectedById,
        status: p.status,
      })),
      channelReady: ['OFFICE', 'PARENT', 'GATEWAY'],
    };
  }

  private async buildCollectPlan(
    tenantId: string,
    dto: CollectSchoolFeeDto,
    opts?: { skipReference?: boolean },
  ) {
    const months = [
      ...new Set(
        (dto.months?.length
          ? dto.months
          : dto.feeMonth
            ? [dto.feeMonth]
            : []
        ).filter(isMonth),
      ),
    ].sort();
    if (!months.length) {
      throw new BadRequestException('Select at least one fee month');
    }
    const book = await this.ledger(tenantId, dto.studentId);
    const selected = months.map((m) => {
      const row = book.rows.find((r) => r.feeMonth === m);
      if (!row)
        throw new BadRequestException(`Month ${m} is not on this ledger`);
      if (row.status === 'PAID') {
        throw new ConflictException('Payment already recorded.');
      }
      return row;
    });
    const configured = Array.isArray(book.settings.paymentMethods)
      ? book.settings.paymentMethods
      : DEFAULT_METHODS;
    const allowed = new Set(configured.length ? configured : DEFAULT_METHODS);
    if (!allowed.has(dto.paymentMode)) {
      throw new BadRequestException('That payment mode is not enabled');
    }
    if (dto.paymentMode === 'CHEQUE' && !dto.chequeNumber?.trim()) {
      throw new BadRequestException('Cheque number is required');
    }
    if (dto.paymentMode === 'BANK' && !dto.reference?.trim()) {
      throw new BadRequestException('Bank transaction reference is required');
    }
    if (
      dto.paymentMode === 'UPI' &&
      !dto.reference?.trim() &&
      !opts?.skipReference
    ) {
      throw new BadRequestException('UPI reference number is required');
    }
    if (
      dto.paymentMode === 'ONLINE' &&
      !dto.reference?.trim() &&
      !opts?.skipReference
    ) {
      throw new BadRequestException(
        'Complete the online payment through the gateway, or enter a confirmed transaction reference.',
      );
    }
    if (dto.paymentMode === 'OTHER' && !dto.reference?.trim()) {
      throw new BadRequestException('Payment reference is required');
    }
    const waiverMap = new Map(
      (dto.lateWaivers ?? []).map((w) => [w.month, w.reason.trim()]),
    );
    const lines = selected.map((row) => {
      const reason = waiverMap.get(row.feeMonth);
      const waive =
        Boolean(reason) || Boolean(dto.waiveLateFee && row.lateFeeAmount);
      if (waive && !(reason || dto.notes?.trim())) {
        throw new BadRequestException(
          `Late-fee waiver reason is required for ${row.monthLabel}`,
        );
      }
      const late = waive ? 0 : row.lateFeeAmount;
      return {
        ...row,
        lateFeeAmount: late,
        lateWaived: waive,
        lateWaiveReason: reason || (waive ? dto.notes?.trim() || null : null),
        dueAmount: Math.max(
          0,
          row.tuitionAmount + row.otherAmount + late - row.paidAmount,
        ),
      };
    });
    const gross = lines.reduce((sum, l) => sum + l.dueAmount, 0);
    let discount = dto.discountAmount ?? 0;
    if (dto.discountType === 'PERCENT') {
      discount = Math.round((gross * (dto.discountValue ?? 0)) / 100);
    } else if (dto.discountValue != null && dto.discountAmount == null) {
      discount = Math.round(dto.discountValue);
    }
    discount = Math.min(Math.max(0, discount), gross);
    if (discount > 0 && !dto.discountReason?.trim()) {
      throw new BadRequestException('Concession reason is required');
    }
    if (discount > 0 && !dto.discountApprovedBy?.trim()) {
      throw new BadRequestException(
        'Concession must be approved by a named authority',
      );
    }
    const net = Math.max(0, gross - discount);
    const amountPaying = dto.amountPaying ?? net;
    if (amountPaying <= 0) {
      throw new BadRequestException('Amount paying must be greater than zero');
    }
    if (amountPaying > net) {
      throw new BadRequestException('Amount paying cannot exceed net payable');
    }
    if (months.length > 1 && amountPaying !== net) {
      throw new BadRequestException(
        'Partial payment is only allowed for a single month',
      );
    }
    if (
      dto.paymentMode === 'CASH' &&
      dto.cashReceived != null &&
      dto.cashReceived < amountPaying
    ) {
      throw new BadRequestException('Insufficient cash received.');
    }
    return { months, book, lines, gross, discount, net, amountPaying };
  }

  async previewCollect(tenantId: string, dto: CollectSchoolFeeDto) {
    const plan = await this.buildCollectPlan(tenantId, dto, {
      skipReference: true,
    });
    return {
      academicYearId: plan.book.academicYear.id,
      months: plan.months,
      amountPaying: plan.amountPaying,
      net: plan.net,
    };
  }

  async collect(
    tenantId: string,
    dto: CollectSchoolFeeDto,
    actorUserId?: string,
    opts?: {
      skipReference?: boolean;
      gatewaySnapshot?: Record<string, unknown>;
    },
  ) {
    const { months, book, lines, gross, discount, net, amountPaying } =
      await this.buildCollectPlan(tenantId, dto, opts);
    const year = book.academicYear;
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const already = await tx.schoolFeeMonthAccount.findFirst({
          where: {
            tenantId,
            academicYearId: year.id,
            studentId: dto.studentId,
            feeMonth: { in: months },
            status: 'PAID',
          },
        });
        if (already) {
          throw new ConflictException('Payment already recorded.');
        }
        const seq = await tx.schoolIdSequence.upsert({
          where: {
            tenantId_academicYearId_kind: {
              tenantId,
              academicYearId: year.id,
              kind: 'FEE',
            },
          },
          update: { lastValue: { increment: 1 } },
          create: {
            tenantId,
            academicYearId: year.id,
            kind: 'FEE',
            lastValue: 1,
          },
        });
        const receiptNumber = `${book.settings.receiptPrefix || 'FB'}/${year.code}/${String(seq.lastValue).padStart(4, '0')}`;
        // Cash plus concession must cover billed dues; receipt cash stays amountPaying.
        let leftover = amountPaying + discount;
        const allocated = lines
          .map((line) => {
            const paid = Math.min(line.dueAmount, leftover);
            leftover -= paid;
            return {
              ...line,
              paidAmountThis: paid,
              lineStatus:
                paid >= line.dueAmount && line.dueAmount > 0
                  ? 'PAID'
                  : paid > 0
                    ? 'PARTIAL'
                    : 'DUE',
            };
          })
          .filter((l) => l.paidAmountThis > 0);
        const tuitionAmount = allocated.reduce(
          (s, l) => s + l.tuitionAmount,
          0,
        );
        const lateFeeAmount = allocated.reduce(
          (s, l) => s + l.lateFeeAmount,
          0,
        );
        const otherAmount = allocated.reduce((s, l) => s + l.otherAmount, 0);
        const payment = await tx.schoolFeePayment.create({
          data: {
            tenantId,
            academicYearId: year.id,
            studentId: dto.studentId,
            enrollmentId: book.enrollmentId,
            gradeId: book.gradeId,
            sectionId: book.sectionId,
            feeMonth: allocated[0].feeMonth,
            receiptNumber,
            tuitionAmount,
            lateFeeAmount,
            otherAmount,
            discountAmount: discount,
            previousBalance: 0,
            totalAmount: amountPaying,
            paymentMode: dto.paymentMode,
            reference:
              dto.reference?.trim() || dto.chequeNumber?.trim() || null,
            notes: dto.notes?.trim() || null,
            collectedById: actorUserId ?? null,
            channel: dto.channel || 'OFFICE',
            grossAmount: gross,
            remainingAmount: net - amountPaying,
            discountType: dto.discountType ?? (discount ? 'AMOUNT' : null),
            discountReason: dto.discountReason?.trim() || null,
            discountApprovedBy: dto.discountApprovedBy?.trim() || null,
            chequeNumber: dto.chequeNumber?.trim() || null,
            bankName: dto.bankName?.trim() || null,
            monthsJson: allocated.map((l) => l.feeMonth),
            snapshotJson: {
              feeKind: 'MONTHLY_TUITION',
              studentName: book.student.fullName,
              admissionNumber: book.student.admissionNumber,
              className: book.className,
              sectionName: book.sectionName,
              academicYear: year.name,
              concession: discount
                ? {
                    amount: discount,
                    type: dto.discountType ?? 'AMOUNT',
                    reason: dto.discountReason?.trim() || null,
                    approvedBy: dto.discountApprovedBy?.trim() || null,
                  }
                : null,
              cashCollected: amountPaying,
              tender:
                dto.paymentMode === 'CASH'
                  ? {
                      cashReceived: dto.cashReceived ?? amountPaying,
                      changeReturned: Math.max(
                        0,
                        (dto.cashReceived ?? amountPaying) - amountPaying,
                      ),
                    }
                  : null,
              payer: {
                name: dto.payerName?.trim() || null,
                mobile: dto.payerMobile?.trim() || null,
                instrumentDate: dto.instrumentDate?.trim() || null,
              },
              amounts: {
                tuition: tuitionAmount,
                late: lateFeeAmount,
                other: otherAmount,
                concession: discount,
                gross,
                cash: amountPaying,
              },
              otherLabel: otherLabelForGrade(book.gradeCode ?? ''),
              months: allocated.map((l) => ({
                feeMonth: l.feeMonth,
                monthLabel: l.monthLabel,
                tuitionAmount: l.tuitionAmount,
                otherAmount: l.otherAmount,
                lateFeeAmount: l.lateFeeAmount,
                paidAmount: l.paidAmountThis,
                status: l.lineStatus,
              })),
              settings: {
                schoolName: book.settings.schoolName,
                schoolAddress: book.settings.schoolAddress,
                logoUrl: book.settings.logoUrl,
                signatoryName: book.settings.signatoryName,
                motto: 'Knowledge · Service · Light',
                instructions: book.settings.instructionsJson,
              },
              gateway: opts?.gatewaySnapshot ?? null,
            } as Prisma.InputJsonValue,
            lines: {
              create: allocated.map((l) => ({
                tenantId,
                feeMonth: l.feeMonth,
                tuitionAmount: l.tuitionAmount,
                otherAmount: l.otherAmount,
                lateFeeAmount: l.lateFeeAmount,
                lateWaived: l.lateWaived,
                lateWaiveReason: l.lateWaiveReason,
                dueAmount: l.dueAmount,
                paidAmount: l.paidAmountThis,
                status: l.lineStatus,
              })),
            },
          },
        });
        for (const line of allocated) {
          const prev = await tx.schoolFeeMonthAccount.findUnique({
            where: {
              tenantId_academicYearId_studentId_feeMonth: {
                tenantId,
                academicYearId: year.id,
                studentId: dto.studentId,
                feeMonth: line.feeMonth,
              },
            },
          });
          const nextPaid = (prev?.paidAmount ?? 0) + line.paidAmountThis;
          const due = prev?.dueAmount ?? line.grossDue;
          const nextStatus =
            nextPaid >= due ? 'PAID' : nextPaid > 0 ? 'PARTIAL' : 'DUE';
          await tx.schoolFeeMonthAccount.upsert({
            where: {
              tenantId_academicYearId_studentId_feeMonth: {
                tenantId,
                academicYearId: year.id,
                studentId: dto.studentId,
                feeMonth: line.feeMonth,
              },
            },
            create: {
              tenantId,
              academicYearId: year.id,
              studentId: dto.studentId,
              feeMonth: line.feeMonth,
              dueAmount: line.grossDue,
              paidAmount: nextPaid,
              status: nextStatus,
            },
            update: { paidAmount: nextPaid, status: nextStatus },
          });
        }
        await tx.schoolFeePaymentEvent.create({
          data: {
            tenantId,
            paymentId: payment.id,
            type: 'CREATED',
            actorUserId: actorUserId ?? null,
            afterJson: {
              receiptNumber,
              totalAmount: amountPaying,
              months: allocated.map((l) => l.feeMonth),
              channel: dto.channel || 'OFFICE',
            },
          },
        });
        if (discount > 0) {
          await tx.schoolFeePaymentEvent.create({
            data: {
              tenantId,
              paymentId: payment.id,
              type: 'CONCESSION',
              actorUserId: actorUserId ?? null,
              note: dto.discountReason?.trim(),
              afterJson: {
                discount,
                reason: dto.discountReason?.trim(),
                approvedBy: dto.discountApprovedBy?.trim(),
              },
            },
          });
        }
        return {
          payment: {
            id: payment.id,
            receiptNumber,
            tuitionAmount,
            lateFeeAmount,
            otherAmount,
            discountAmount: discount,
            totalAmount: amountPaying,
            status: 'PAID',
          },
          receiptNumber,
          months: allocated.map((l) => l.monthLabel),
        };
      });
      await this.events.publish({
        event: 'fee.paid',
        tenantId,
        studentId: dto.studentId,
        entityType: 'fee_payment',
        entityId: result.payment.id,
        data: {
          receipt_number: result.receiptNumber,
          paid_amount: result.payment.totalAmount,
          fee_status: 'PAID',
        },
      });
      return result;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Payment already recorded.');
      }
      throw err;
    }
  }

  async voidPayment(
    tenantId: string,
    id: string,
    dto: VoidSchoolFeeDto,
    actorUserId?: string,
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const payment = await this.prisma.schoolFeePayment.findFirst({
      where: { id, tenantId },
      include: { lines: true },
    });
    if (!payment) throw new NotFoundException('Receipt not found');
    if (payment.status !== 'PAID') {
      throw new BadRequestException('Only a paid receipt can be voided');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.schoolFeePayment.update({
        where: { id },
        data: {
          status: 'VOIDED',
          voidedAt: new Date(),
          voidedById: actorUserId ?? null,
          voidReason: dto.reason.trim(),
        },
      });
      const lines = payment.lines.length
        ? payment.lines
        : [{ feeMonth: payment.feeMonth, paidAmount: payment.totalAmount }];
      for (const line of lines) {
        const account = await tx.schoolFeeMonthAccount.findUnique({
          where: {
            tenantId_academicYearId_studentId_feeMonth: {
              tenantId,
              academicYearId: payment.academicYearId,
              studentId: payment.studentId,
              feeMonth: line.feeMonth,
            },
          },
        });
        if (!account) continue;
        const paidAmount = Math.max(0, account.paidAmount - line.paidAmount);
        await tx.schoolFeeMonthAccount.update({
          where: { id: account.id },
          data: {
            paidAmount,
            status:
              paidAmount <= 0
                ? 'DUE'
                : paidAmount >= account.dueAmount
                  ? 'PAID'
                  : 'PARTIAL',
          },
        });
      }
      await tx.schoolFeePaymentEvent.create({
        data: {
          tenantId,
          paymentId: id,
          type: 'VOIDED',
          actorUserId: actorUserId ?? null,
          note: dto.reason.trim(),
          beforeJson: { status: 'PAID' },
          afterJson: { status: 'VOIDED' },
        },
      });
      return next;
    });
    return updated;
  }

  async dashboard(tenantId: string) {
    const { year, plans } = await this.ensureSetup(tenantId);
    const now = new Date();
    const todayStart = startOfDay(now);
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const paidWhere = {
      tenantId,
      academicYearId: year.id,
      status: 'PAID',
    };
    const [today, month, allPaid, enrollments, late] = await Promise.all([
      this.prisma.schoolFeePayment.aggregate({
        where: { ...paidWhere, paidAt: { gte: todayStart } },
        _sum: { totalAmount: true },
        _count: true,
      }),
      this.prisma.schoolFeePayment.aggregate({
        where: { ...paidWhere, feeMonth: monthKey },
        _sum: { totalAmount: true },
        _count: true,
      }),
      this.prisma.schoolFeePayment.findMany({
        where: { ...paidWhere, feeMonth: monthKey },
        select: {
          studentId: true,
          lateFeeAmount: true,
          totalAmount: true,
          gradeId: true,
          feeMonth: true,
        },
      }),
      this.prisma.schoolEnrollment.findMany({
        where: {
          tenantId,
          academicYearId: year.id,
          deletedAt: null,
          status: 'ACTIVE',
          section: { grade: { code: { in: [...MONTHLY_FEE_CODES] } } },
        },
        select: {
          studentId: true,
          section: {
            select: { grade: { select: { id: true, name: true, code: true } } },
          },
        },
      }),
      this.prisma.schoolFeePayment.count({
        where: { ...paidWhere, lateFeeAmount: { gt: 0 } },
      }),
    ]);
    const paidIds = new Set(allPaid.map((p) => p.studentId));
    const pendingStudents = enrollments.filter(
      (e) => !paidIds.has(e.studentId),
    ).length;
    const classMap = new Map<
      string,
      { name: string; amount: number; paid: number }
    >();
    for (const row of allPaid) {
      const grade = enrollments.find((e) => e.studentId === row.studentId)
        ?.section.grade;
      const key = grade?.id ?? row.gradeId;
      const cur = classMap.get(key) ?? {
        name: grade?.name ?? 'Class',
        amount: 0,
        paid: 0,
      };
      cur.amount += row.totalAmount;
      cur.paid += 1;
      classMap.set(key, cur);
    }
    const byMonth = await this.prisma.schoolFeePayment.groupBy({
      by: ['feeMonth'],
      where: paidWhere,
      _sum: { totalAmount: true },
      _count: true,
      orderBy: { feeMonth: 'asc' },
    });
    const pendingAmount = enrollments
      .filter((e) => !paidIds.has(e.studentId))
      .reduce((sum, e) => {
        const plan = plans.find((p) => p.gradeId === e.section.grade.id);
        return sum + (plan?.tuitionAmount ?? 600) + (plan?.otherAmount ?? 0);
      }, 0);
    return {
      academicYear: year,
      todayCollection: today._sum.totalAmount ?? 0,
      todayCount: today._count,
      monthCollection: month._sum.totalAmount ?? 0,
      monthPaid: paidIds.size,
      monthPending: pendingStudents,
      enrolled: enrollments.length,
      latePayments: late,
      pendingFees: pendingAmount,
      byClass: [...classMap.values()],
      byMonth: byMonth.map((row) => ({
        month: row.feeMonth,
        label: monthLabel(row.feeMonth),
        amount: row._sum.totalAmount ?? 0,
        count: row._count,
      })),
    };
  }

  async register(
    tenantId: string,
    query: {
      month?: string;
      gradeId?: string;
      sectionId?: string;
      status?: string;
      paymentMode?: string;
      from?: string;
      to?: string;
      q?: string;
    },
  ) {
    const { year } = await this.ensureSetup(tenantId);
    const rows = await this.prisma.schoolFeePayment.findMany({
      where: {
        tenantId,
        academicYearId: year.id,
        ...(query.month ? { feeMonth: query.month } : {}),
        ...(query.gradeId ? { gradeId: query.gradeId } : {}),
        ...(query.sectionId ? { sectionId: query.sectionId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.paymentMode ? { paymentMode: query.paymentMode } : {}),
        ...(query.from || query.to
          ? {
              paidAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(`${query.to}T23:59:59`) } : {}),
              },
            }
          : {}),
        ...(query.q
          ? {
              OR: [
                {
                  receiptNumber: {
                    contains: query.q,
                    mode: 'insensitive',
                  },
                },
                {
                  student: {
                    OR: [
                      { fullName: { contains: query.q, mode: 'insensitive' } },
                      {
                        admissionNumber: {
                          contains: query.q,
                          mode: 'insensitive',
                        },
                      },
                    ],
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        student: {
          select: { id: true, fullName: true, admissionNumber: true },
        },
      },
      orderBy: { paidAt: 'desc' },
      take: 500,
    });
    const sections = await this.prisma.schoolSection.findMany({
      where: { tenantId, academicYearId: year.id, deletedAt: null },
      include: { grade: true },
    });
    const sectionMap = new Map(sections.map((s) => [s.id, s]));
    return {
      academicYear: year,
      rows: rows.map((row) => {
        const section = sectionMap.get(row.sectionId);
        return {
          ...row,
          monthLabel: monthLabel(row.feeMonth),
          className: section?.grade.name ?? '',
          sectionName: section?.name ?? '',
        };
      }),
    };
  }

  async pending(tenantId: string, feeMonth?: string) {
    const { year, plans } = await this.ensureSetup(tenantId);
    const month =
      feeMonth && isMonth(feeMonth)
        ? feeMonth
        : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const enrollments = await this.prisma.schoolEnrollment.findMany({
      where: {
        tenantId,
        academicYearId: year.id,
        deletedAt: null,
        status: 'ACTIVE',
        section: { grade: { code: { in: [...MONTHLY_FEE_CODES] } } },
      },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            admissionNumber: true,
            phone: true,
          },
        },
        section: { include: { grade: true } },
      },
      orderBy: { student: { fullName: 'asc' } },
    });
    const monthAccounts = await this.prisma.schoolFeeMonthAccount.findMany({
      where: {
        tenantId,
        academicYearId: year.id,
        feeMonth: month,
      },
      select: {
        studentId: true,
        paidAmount: true,
        dueAmount: true,
        status: true,
      },
    });
    const paidThisMonth = new Map(
      monthAccounts.map((a) => [a.studentId, a.paidAmount] as const),
    );
    const paidSet = new Set(
      monthAccounts.filter((a) => a.status === 'PAID').map((a) => a.studentId),
    );
    const paidReceipts = await this.prisma.schoolFeePayment.findMany({
      where: {
        tenantId,
        academicYearId: year.id,
        feeMonth: month,
        status: 'PAID',
      },
      select: { studentId: true },
    });
    for (const p of paidReceipts) paidSet.add(p.studentId);
    const settings = (await this.ensureSetup(tenantId)).settings;
    const today = startOfDay(new Date());
    const priorMonths = this.monthsBetween(year.startDate, year.endDate).filter(
      (m) => m < month,
    );
    const priorPaid = priorMonths.length
      ? await this.prisma.schoolFeePayment.findMany({
          where: {
            tenantId,
            academicYearId: year.id,
            status: 'PAID',
            feeMonth: { in: priorMonths },
          },
          select: { studentId: true, feeMonth: true },
        })
      : [];
    const priorPaidSet = new Set(
      priorPaid.map((p) => `${p.studentId}:${p.feeMonth}`),
    );
    const rows = enrollments
      .filter((e) => !paidSet.has(e.studentId))
      .map((e) => {
        const plan = plans.find((p) => p.gradeId === e.section.gradeId);
        const gradeCode = e.section.grade.code;
        const tuition = plan?.tuitionAmount ?? 600;
        const other =
          plan?.otherAmount ?? (isMiddleFeeGrade(gradeCode) ? 100 : 0);
        const lateApplies =
          Boolean(settings.lateFeeEnabled) &&
          today > dueDate(month, dueDayForGrade(gradeCode, settings.dueDay));
        const late = lateApplies
          ? (plan?.lateFeeAmount ?? settings.lateFeeAmount)
          : 0;
        const previousBalance =
          priorMonths.filter((m) => !priorPaidSet.has(`${e.studentId}:${m}`))
            .length *
          (tuition + other);
        const monthGross = tuition + other + late;
        const paidThis = paidThisMonth.get(e.student.id) ?? 0;
        const monthRemaining = Math.max(0, monthGross - paidThis);
        const totalDue = monthRemaining + previousBalance;
        if (totalDue <= 0) return null;
        return {
          studentId: e.student.id,
          fullName: e.student.fullName,
          admissionNumber: e.student.admissionNumber,
          phone: e.student.phone,
          rollNumber: e.rollNumber,
          gradeId: e.section.gradeId,
          gradeCode: gradeCode,
          sectionId: e.section.id,
          className: e.section.grade.name,
          sectionName: e.section.name,
          feeMonth: month,
          monthLabel: monthLabel(month),
          tuitionAmount: Math.max(0, tuition - Math.min(paidThis, tuition)),
          lateFeeAmount: late,
          otherAmount: other,
          previousBalance,
          totalDue,
          overdue: late > 0 && paidThis === 0,
          status:
            paidThis > 0 && monthRemaining > 0
              ? 'PARTIAL'
              : late > 0
                ? 'OVERDUE'
                : 'PENDING',
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
    const pendingIds = new Set(rows.map((r) => r.studentId));
    const amountByGrade = new Map<string, number>();
    for (const row of rows) {
      amountByGrade.set(
        row.gradeId,
        (amountByGrade.get(row.gradeId) ?? 0) + row.totalDue,
      );
    }
    const byGradeMap = new Map<
      string,
      {
        gradeId: string;
        name: string;
        enrolled: number;
        paid: number;
        pending: number;
        pendingAmount: number;
      }
    >();
    const sectionMap = new Map<
      string,
      { id: string; gradeId: string; name: string; className: string }
    >();
    for (const e of enrollments) {
      const g = byGradeMap.get(e.section.gradeId) ?? {
        gradeId: e.section.gradeId,
        name: e.section.grade.name,
        enrolled: 0,
        paid: 0,
        pending: 0,
        pendingAmount: 0,
      };
      g.enrolled += 1;
      if (pendingIds.has(e.studentId)) g.pending += 1;
      else g.paid += 1;
      g.pendingAmount = amountByGrade.get(e.section.gradeId) ?? 0;
      byGradeMap.set(e.section.gradeId, g);
      sectionMap.set(e.section.id, {
        id: e.section.id,
        gradeId: e.section.gradeId,
        name: e.section.name,
        className: e.section.grade.name,
      });
    }
    const grades = [...byGradeMap.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    return {
      academicYear: year,
      feeMonth: month,
      monthLabel: monthLabel(month),
      summary: {
        enrolled: enrollments.length,
        pending: rows.length,
        paid: Math.max(0, enrollments.length - rows.length),
        pendingAmount: rows.reduce((sum, row) => sum + row.totalDue, 0),
      },
      grades,
      sections: [...sectionMap.values()].sort((a, b) =>
        `${a.className} ${a.name}`.localeCompare(`${b.className} ${b.name}`),
      ),
      rows,
    };
  }

  async sendToParent(tenantId: string, id: string, actorUserId?: string) {
    const payment = await this.getPayment(tenantId, id);
    await this.prisma.schoolFeePaymentEvent.create({
      data: {
        tenantId,
        paymentId: id,
        type: 'SENT_TO_PARENT',
        actorUserId: actorUserId ?? null,
        afterJson: { receiptNumber: payment.receiptNumber, channel: 'PARENT' },
      },
    });
    return {
      ok: true,
      receiptNumber: payment.receiptNumber,
      studentPhone: payment.student.phone,
    };
  }

  async getPayment(tenantId: string, id: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const payment = await this.prisma.schoolFeePayment.findFirst({
      where: { id, tenantId },
      include: {
        student: true,
        events: { orderBy: { createdAt: 'asc' } },
        lines: { orderBy: { feeMonth: 'asc' } },
      },
    });
    if (!payment) throw new NotFoundException('Receipt not found');
    return payment;
  }

  receiptView(payment: {
    receiptNumber: string;
    paidAt: Date;
    feeMonth: string;
    tuitionAmount: number;
    lateFeeAmount: number;
    otherAmount: number;
    discountAmount: number;
    previousBalance: number;
    totalAmount: number;
    paymentMode: string;
    reference: string | null;
    snapshotJson: Prisma.JsonValue;
    monthsJson?: Prisma.JsonValue;
    grossAmount?: number | null;
    lines?: Array<{
      feeMonth: string;
      tuitionAmount: number;
      lateFeeAmount: number;
      otherAmount: number;
      paidAmount: number;
    }>;
  }): MonthlyFeeReceiptView {
    const snap = (payment.snapshotJson ?? {}) as Record<string, any>;
    const settings = (snap.settings ?? {}) as Record<string, any>;
    const amounts = (snap.amounts ?? {}) as Record<string, number>;
    const lineTuition =
      payment.lines?.reduce((sum, line) => sum + line.tuitionAmount, 0) ?? 0;
    const lineLate =
      payment.lines?.reduce((sum, line) => sum + line.lateFeeAmount, 0) ?? 0;
    const lineOther =
      payment.lines?.reduce((sum, line) => sum + line.otherAmount, 0) ?? 0;
    const lateFeeAmount =
      payment.lateFeeAmount || Number(amounts.late || 0) || lineLate;
    const otherAmount =
      payment.otherAmount || Number(amounts.other || 0) || lineOther;
    const tuitionAmount =
      payment.tuitionAmount ||
      Number(amounts.tuition || 0) ||
      lineTuition ||
      Math.max(
        0,
        Number(payment.grossAmount || amounts.gross || 0) -
          lateFeeAmount -
          otherAmount,
      );
    const totalAmount =
      payment.totalAmount || Number(amounts.cash || snap.cashCollected || 0);
    const discountAmount =
      payment.discountAmount ||
      Number(amounts.concession || snap.concession?.amount || 0);
    return {
      schoolName: settings.schoolName || "St. Luke's Secondary School, Tura",
      schoolAddress:
        settings.schoolAddress ||
        'Walbakgre, Tura - 794101, West Garo Hills, Meghalaya',
      logoUrl: settings.logoUrl || '/school-sis/st-lukes-logo.png',
      signatoryName: settings.signatoryName,
      motto: settings.motto || 'Knowledge · Service · Light',
      instructions: Array.isArray(settings.instructions)
        ? settings.instructions
        : DEFAULT_INSTRUCTIONS,
      receiptNumber: payment.receiptNumber,
      paidAt: payment.paidAt.toLocaleString('en-IN'),
      academicYear: String(snap.academicYear ?? ''),
      studentName: String(snap.studentName ?? ''),
      admissionNumber: String(snap.admissionNumber ?? ''),
      className: String(snap.className ?? ''),
      sectionName: String(snap.sectionName ?? ''),
      feeMonth: payment.feeMonth,
      tuitionAmount,
      lateFeeAmount,
      otherAmount,
      otherLabel:
        typeof snap.otherLabel === 'string'
          ? snap.otherLabel
          : otherLabelForGrade(
              String(snap.className ?? '').replace(/^Class\s+/i, ''),
            ),
      discountAmount,
      previousBalance: payment.previousBalance,
      totalAmount,
      paymentMode: snap.gateway?.provider
        ? `ONLINE · ${snap.gateway.gatewayName || snap.gateway.provider}`
        : payment.paymentMode,
      reference: payment.reference,
      gatewayName: snap.gateway?.gatewayName ?? null,
      gatewayPaymentId: snap.gateway?.paymentId ?? payment.reference,
      monthsCovered: (Array.isArray(snap.months)
        ? snap.months.map(
            (m: { monthLabel?: string; feeMonth?: string }) =>
              m.monthLabel || monthLabel(String(m.feeMonth)),
          )
        : payment.lines?.map((l) => monthLabel(l.feeMonth))
      )?.length
        ? Array.isArray(snap.months)
          ? snap.months.map(
              (m: { monthLabel?: string; feeMonth?: string }) =>
                m.monthLabel || monthLabel(String(m.feeMonth)),
            )
          : payment.lines!.map((l) => monthLabel(l.feeMonth))
        : [monthLabel(payment.feeMonth)],
    };
  }

  async receiptHtml(tenantId: string, id: string) {
    const payment = await this.getPayment(tenantId, id);
    return monthlyFeeReceiptHtml(this.receiptView(payment));
  }

  async receiptPdf(tenantId: string, id: string) {
    const html = await this.receiptHtml(tenantId, id);
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load', timeout: 60_000 });
      const pdf = await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  async exportRegister(
    tenantId: string,
    query: Parameters<SchoolSisMonthlyFeesService['register']>[1],
  ) {
    const data = await this.register(tenantId, query);
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Monthly fees');
    sheet.columns = [
      { header: 'Student', key: 'student', width: 28 },
      { header: 'Admission', key: 'adm', width: 16 },
      { header: 'Class', key: 'klass', width: 16 },
      { header: 'Month', key: 'month', width: 14 },
      { header: 'Tuition', key: 'tuition', width: 12 },
      { header: 'Late fee', key: 'late', width: 12 },
      { header: 'Total', key: 'total', width: 12 },
      { header: 'Mode', key: 'mode', width: 12 },
      { header: 'Receipt', key: 'receipt', width: 18 },
      { header: 'Date', key: 'date', width: 20 },
      { header: 'Status', key: 'status', width: 12 },
    ];
    for (const row of data.rows) {
      sheet.addRow({
        student: row.student.fullName,
        adm: row.student.admissionNumber,
        klass: `${row.className} ${row.sectionName}`,
        month: row.monthLabel,
        tuition: row.tuitionAmount,
        late: row.lateFeeAmount,
        total: row.totalAmount,
        mode: row.paymentMode,
        receipt: row.receiptNumber,
        date: row.paidAt,
        status: row.status,
      });
    }
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    return {
      buffer,
      filename: `monthly-fees-${data.academicYear.code}.xlsx`,
    };
  }

  private toReceiptPayload(
    payment: {
      id: string;
      receiptNumber: string;
      totalAmount: number;
      status: string;
    },
    quote: Awaited<ReturnType<SchoolSisMonthlyFeesService['quote']>>,
  ) {
    return {
      payment,
      quote,
      receiptNumber: payment.receiptNumber,
    };
  }
}
