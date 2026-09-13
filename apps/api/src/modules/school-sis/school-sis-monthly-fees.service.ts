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

const DEFAULT_INSTRUCTIONS = [
  'Fees are to be paid before the 15th of every month.',
  'Annual Fees and Jan. & Feb. Tuition Fees to be paid at the time of Admission.',
  'Pupils with dues may be barred from sitting for the Examinations.',
  'Fees once paid are not refundable.',
];

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
      where: { tenantId, deletedAt: null, code: { in: [...JUNIOR_FEE_CODES] } },
      orderBy: { sortOrder: 'asc' },
    });
    const existing = await this.prisma.schoolMonthlyFeePlan.findMany({
      where: { tenantId, academicYearId },
    });
    const byGrade = new Map(existing.map((row) => [row.gradeId, row]));
    for (const grade of grades) {
      if (byGrade.has(grade.id)) continue;
      const tuition = await this.defaultTuition(
        tenantId,
        academicYearId,
        grade.id,
      );
      const created = await this.prisma.schoolMonthlyFeePlan.create({
        data: {
          tenantId,
          academicYearId,
          gradeId: grade.id,
          tuitionAmount: tuition,
          otherAmount: 0,
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
    return {
      academicYear: year,
      settings: this.publicSettings(settings),
      plans,
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

  async saveSettings(tenantId: string, dto: SaveSchoolFeeSettingsDto) {
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
    const enrollment = await this.loadJuniorEnrollment(
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
    const tuition = plan?.tuitionAmount ?? 600;
    const other = plan?.otherAmount ?? 0;
    const lateRule = plan?.lateFeeAmount ?? settings.lateFeeAmount;
    const lateApplies =
      Boolean(settings.lateFeeEnabled) &&
      startOfDay(new Date()) > dueDate(feeMonth, settings.dueDay);
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

  private async loadJuniorEnrollment(
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
    if (
      !JUNIOR_FEE_CODES.includes(
        enrollment.section.grade.code as (typeof JUNIOR_FEE_CODES)[number],
      )
    ) {
      throw new BadRequestException(
        'This monthly fee book is for Nursery–Class IV. Other classes will use the same engine later.',
      );
    }
    return enrollment;
  }

  async ledger(tenantId: string, studentId: string) {
    const { year, settings, plans } = await this.ensureSetup(tenantId);
    const enrollment = await this.loadJuniorEnrollment(
      tenantId,
      year.id,
      studentId,
    );
    const plan = plans.find((p) => p.gradeId === enrollment.section.gradeId);
    const tuition = plan?.tuitionAmount ?? 600;
    const other = plan?.otherAmount ?? 0;
    const lateRule = plan?.lateFeeAmount ?? settings.lateFeeAmount;
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
        Boolean(settings.lateFeeEnabled) &&
        today > dueDate(feeMonth, settings.dueDay);
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
          ? `${monthLabel(feeMonth)} — Late Fee ₹${lateRule} (due by the ${settings.dueDay}th)`
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
      settings: this.publicSettings(settings),
      student: {
        id: enrollment.student.id,
        fullName: enrollment.student.fullName,
        admissionNumber: enrollment.student.admissionNumber,
        phone: enrollment.student.phone,
      },
      className: enrollment.section.grade.name,
      sectionName: enrollment.section.name,
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

  async collect(
    tenantId: string,
    dto: CollectSchoolFeeDto,
    actorUserId?: string,
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
        throw new ConflictException(`${row.monthLabel} is already paid`);
      }
      return row;
    });
    const allowed = new Set([
      ...(book.settings.paymentMethods ?? []),
      ...DEFAULT_METHODS,
    ]);
    if (!allowed.has(dto.paymentMode)) {
      throw new BadRequestException('That payment mode is not enabled');
    }
    if (dto.paymentMode === 'CHEQUE' && !dto.chequeNumber?.trim()) {
      throw new BadRequestException('Cheque number is required');
    }
    if (
      ['UPI', 'BANK', 'ONLINE'].includes(dto.paymentMode) &&
      !dto.reference?.trim()
    ) {
      throw new BadRequestException(
        'Transaction / reference number is required',
      );
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
    if (discount > 0 && !dto.discountReason?.trim()) {
      throw new BadRequestException('Concession reason is required');
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
    const year = book.academicYear;
    try {
      return await this.prisma.$transaction(async (tx) => {
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
        let leftover = amountPaying;
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
            tuitionAmount: allocated.reduce((s, l) => s + l.tuitionAmount, 0),
            lateFeeAmount: allocated.reduce((s, l) => s + l.lateFeeAmount, 0),
            otherAmount: allocated.reduce((s, l) => s + l.otherAmount, 0),
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
              afterJson: { discount, approvedBy: dto.discountApprovedBy },
            },
          });
        }
        return {
          payment: {
            id: payment.id,
            receiptNumber,
            totalAmount: amountPaying,
            status: 'PAID',
          },
          receiptNumber,
          months: allocated.map((l) => l.monthLabel),
        };
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'This month is already paid for the student',
        );
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
          section: { grade: { code: { in: [...JUNIOR_FEE_CODES] } } },
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
              student: {
                OR: [
                  { fullName: { contains: query.q, mode: 'insensitive' } },
                  {
                    admissionNumber: { contains: query.q, mode: 'insensitive' },
                  },
                ],
              },
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
        section: { grade: { code: { in: [...JUNIOR_FEE_CODES] } } },
      },
      include: {
        student: {
          select: { id: true, fullName: true, admissionNumber: true },
        },
        section: { include: { grade: true } },
      },
      orderBy: { student: { fullName: 'asc' } },
    });
    const paid = await this.prisma.schoolFeePayment.findMany({
      where: {
        tenantId,
        academicYearId: year.id,
        feeMonth: month,
        status: 'PAID',
      },
      select: { studentId: true },
    });
    const accountsPaid = await this.prisma.schoolFeeMonthAccount.findMany({
      where: {
        tenantId,
        academicYearId: year.id,
        feeMonth: month,
        status: 'PAID',
      },
      select: { studentId: true },
    });
    const paidSet = new Set([
      ...paid.map((p) => p.studentId),
      ...accountsPaid.map((p) => p.studentId),
    ]);
    const settings = (await this.ensureSetup(tenantId)).settings;
    const lateApplies =
      Boolean(settings.lateFeeEnabled) &&
      startOfDay(new Date()) > dueDate(month, settings.dueDay);
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
        const tuition = plan?.tuitionAmount ?? 600;
        const other = plan?.otherAmount ?? 0;
        const late = lateApplies
          ? (plan?.lateFeeAmount ?? settings.lateFeeAmount)
          : 0;
        const previousBalance =
          priorMonths.filter((m) => !priorPaidSet.has(`${e.studentId}:${m}`))
            .length *
          (tuition + other);
        return {
          studentId: e.student.id,
          fullName: e.student.fullName,
          admissionNumber: e.student.admissionNumber,
          className: e.section.grade.name,
          sectionName: e.section.name,
          feeMonth: month,
          monthLabel: monthLabel(month),
          tuitionAmount: tuition,
          lateFeeAmount: late,
          otherAmount: other,
          previousBalance,
          totalDue: tuition + other + late + previousBalance,
        };
      });
    return {
      academicYear: year,
      feeMonth: month,
      monthLabel: monthLabel(month),
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
      tuitionAmount: payment.tuitionAmount,
      lateFeeAmount: payment.lateFeeAmount,
      otherAmount: payment.otherAmount,
      discountAmount: payment.discountAmount,
      previousBalance: payment.previousBalance,
      totalAmount: payment.totalAmount,
      paymentMode: payment.paymentMode,
      reference: payment.reference,
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
