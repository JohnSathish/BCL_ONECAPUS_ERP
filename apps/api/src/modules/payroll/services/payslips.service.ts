import { Injectable, NotFoundException } from '@nestjs/common';
import JSZip from 'jszip';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { PayslipDocumentService } from './payslip-document.service';

const TEACHING_SCALES = ['COLLEGE_TEACHING', 'UGC', 'STATE'];
const NON_TEACHING_SCALES = [
  'COLLEGE_NON_TEACHING',
  'CONTRACT',
  'DAILY_WAGE',
  'GUEST',
  'VISITING',
];
const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export type PayslipListQuery = {
  month?: number;
  year?: number;
  status?: string;
  staffProfileId?: string;
  payScaleType?: string;
  departmentId?: string;
  staffType?: string;
  search?: string;
  payrollRunId?: string;
  fromMonth?: number;
  fromYear?: number;
  toMonth?: number;
  toYear?: number;
  financialYear?: number;
  periodPreset?: string;
};

type PeriodBounds = {
  fromMonth: number;
  fromYear: number;
  toMonth: number;
  toYear: number;
};

@Injectable()
export class PayslipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payslipDocs: PayslipDocumentService,
  ) {}

  /** Indian FY: April (startYear) → March (startYear + 1). */
  static financialYearBounds(startYear: number): PeriodBounds {
    return {
      fromMonth: 4,
      fromYear: startYear,
      toMonth: 3,
      toYear: startYear + 1,
    };
  }

  static currentFinancialYearStart(ref = new Date()): number {
    const m = ref.getMonth() + 1;
    const y = ref.getFullYear();
    return m >= 4 ? y : y - 1;
  }

  static periodKey(year: number, month: number) {
    return year * 100 + month;
  }

  resolvePeriodBounds(
    query: PayslipListQuery,
    ref = new Date(),
  ): PeriodBounds | null {
    const nowMonth = ref.getMonth() + 1;
    const nowYear = ref.getFullYear();

    if (
      query.periodPreset === 'current' ||
      (!query.periodPreset && query.month && query.year && !query.fromMonth)
    ) {
      return {
        fromMonth: query.month ?? nowMonth,
        fromYear: query.year ?? nowYear,
        toMonth: query.month ?? nowMonth,
        toYear: query.year ?? nowYear,
      };
    }

    if (query.periodPreset === '3m')
      return this.lastNMonths(3, {
        month: query.month ?? nowMonth,
        year: query.year ?? nowYear,
      });
    if (query.periodPreset === '6m')
      return this.lastNMonths(6, {
        month: query.month ?? nowMonth,
        year: query.year ?? nowYear,
      });
    if (query.periodPreset === '12m')
      return this.lastNMonths(12, {
        month: query.month ?? nowMonth,
        year: query.year ?? nowYear,
      });
    if (query.periodPreset === 'fy' || query.financialYear) {
      const fy =
        query.financialYear ?? PayslipsService.currentFinancialYearStart(ref);
      return PayslipsService.financialYearBounds(fy);
    }
    if (query.fromMonth && query.fromYear && query.toMonth && query.toYear) {
      return {
        fromMonth: query.fromMonth,
        fromYear: query.fromYear,
        toMonth: query.toMonth,
        toYear: query.toYear,
      };
    }
    if (query.month && query.year) {
      return {
        fromMonth: query.month,
        fromYear: query.year,
        toMonth: query.month,
        toYear: query.year,
      };
    }
    return null;
  }

  private lastNMonths(
    n: number,
    end: { month: number; year: number },
  ): PeriodBounds {
    let m = end.month;
    let y = end.year;
    const toMonth = m;
    const toYear = y;
    for (let i = 1; i < n; i++) {
      m -= 1;
      if (m < 1) {
        m = 12;
        y -= 1;
      }
    }
    return { fromMonth: m, fromYear: y, toMonth, toYear };
  }

  private enumerateMonths(bounds: PeriodBounds) {
    const keys: Array<{ month: number; year: number }> = [];
    let y = bounds.fromYear;
    let m = bounds.fromMonth;
    const endKey = PayslipsService.periodKey(bounds.toYear, bounds.toMonth);
    while (PayslipsService.periodKey(y, m) <= endKey) {
      keys.push({ month: m, year: y });
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    return keys;
  }

  private buildWhere(
    tenantId: string,
    query: PayslipListQuery,
  ): Prisma.PayslipWhereInput {
    const staffFilter: Prisma.StaffProfileWhereInput = {};
    if (query.departmentId) staffFilter.departmentId = query.departmentId;
    if (query.search?.trim()) {
      const q = query.search.trim();
      staffFilter.OR = [
        { fullName: { contains: q, mode: 'insensitive' } },
        { employeeCode: { contains: q, mode: 'insensitive' } },
        { department: { name: { contains: q, mode: 'insensitive' } } },
        { designation: { label: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const bounds = this.resolvePeriodBounds(query);
    const where: Prisma.PayslipWhereInput = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.staffProfileId ? { staffProfileId: query.staffProfileId } : {}),
      ...(query.payrollRunId ? { payrollRunId: query.payrollRunId } : {}),
      ...(Object.keys(staffFilter).length ? { staffProfile: staffFilter } : {}),
    };

    if (bounds) {
      const months = this.enumerateMonths(bounds);
      where.OR = months.map((k) => ({ month: k.month, year: k.year }));
    } else {
      if (query.month) where.month = query.month;
      if (query.year) where.year = query.year;
    }

    if (query.payScaleType) {
      where.payScaleType = query.payScaleType;
    } else if (query.staffType === 'TEACHING') {
      where.payScaleType = { in: TEACHING_SCALES };
    } else if (query.staffType === 'NON_TEACHING') {
      where.payScaleType = { in: NON_TEACHING_SCALES };
    }

    return where;
  }

  async list(tenantId: string, query: PayslipListQuery) {
    const rows = await this.prisma.payslip.findMany({
      where: this.buildWhere(tenantId, query),
      include: {
        payrollRun: {
          select: { id: true, status: true, paidAt: true, payScaleType: true },
        },
        staffProfile: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            photoUrl: true,
            staffType: true,
            mobile: true,
            email: true,
            department: { select: { id: true, name: true } },
            designation: { select: { id: true, label: true } },
          },
        },
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' },
        { staffProfile: { fullName: 'asc' } },
      ],
    });

    return rows.map((p) => ({
      ...p,
      grossSalary: Number(p.grossSalary),
      totalDeductions: Number(p.totalDeductions),
      netSalary: Number(p.netSalary),
      prorationFactor:
        p.prorationFactor != null ? Number(p.prorationFactor) : null,
    }));
  }

  async employeeHistory(tenantId: string, staffProfileId: string) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { id: staffProfileId, tenantId },
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        photoUrl: true,
        department: { select: { name: true } },
        designation: { select: { label: true } },
      },
    });
    if (!staff) throw new NotFoundException('Staff not found');

    const payslips = await this.prisma.payslip.findMany({
      where: { tenantId, staffProfileId },
      include: { payrollRun: { select: { paidAt: true, status: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    const timeline = payslips.map((p) => ({
      id: p.id,
      month: p.month,
      year: p.year,
      label: `${MONTH_LABELS[p.month - 1]} ${p.year}`,
      grossSalary: Number(p.grossSalary),
      totalDeductions: Number(p.totalDeductions),
      netSalary: Number(p.netSalary),
      status: p.status,
      paidAt: p.payrollRun?.paidAt ?? null,
      pdfPath: p.pdfPath,
    }));

    const totals = timeline.reduce(
      (acc, p) => {
        acc.gross += p.grossSalary;
        acc.net += p.netSalary;
        acc.deductions += p.totalDeductions;
        return acc;
      },
      { gross: 0, net: 0, deductions: 0 },
    );

    return { staff, payslips: timeline, totals, periodCount: timeline.length };
  }

  async stats(tenantId: string, query: PayslipListQuery) {
    const rows = await this.prisma.payslip.findMany({
      where: this.buildWhere(tenantId, query),
      select: {
        grossSalary: true,
        totalDeductions: true,
        netSalary: true,
        status: true,
        payScaleType: true,
        payrollRun: { select: { paidAt: true } },
      },
    });

    let teachingGross = 0;
    let teachingNet = 0;
    let teachingCount = 0;
    let nonTeachingGross = 0;
    let nonTeachingNet = 0;
    let nonTeachingCount = 0;
    let grossTotal = 0;
    let deductionsTotal = 0;
    let netTotal = 0;
    let pendingCount = 0;
    let publishedCount = 0;
    let paidCount = 0;
    let cancelledCount = 0;

    for (const row of rows) {
      const gross = Number(row.grossSalary);
      const ded = Number(row.totalDeductions);
      const net = Number(row.netSalary);
      grossTotal += gross;
      deductionsTotal += ded;
      netTotal += net;

      if (TEACHING_SCALES.includes(row.payScaleType)) {
        teachingCount += 1;
        teachingGross += gross;
        teachingNet += net;
      } else {
        nonTeachingCount += 1;
        nonTeachingGross += gross;
        nonTeachingNet += net;
      }

      if (row.status === 'DRAFT') pendingCount += 1;
      else if (row.status === 'CANCELLED') cancelledCount += 1;
      else if (row.payrollRun?.paidAt) paidCount += 1;
      else if (row.status === 'PUBLISHED') publishedCount += 1;
    }

    return {
      totalCount: rows.length,
      teachingCount,
      teachingGross,
      teachingNet,
      nonTeachingCount,
      nonTeachingGross,
      nonTeachingNet,
      grossTotal,
      deductionsTotal,
      netTotal,
      pendingCount,
      publishedCount,
      paidCount,
      cancelledCount,
    };
  }

  async analytics(tenantId: string, query: PayslipListQuery) {
    const where = this.buildWhere(tenantId, query);
    const payslips = await this.prisma.payslip.findMany({
      where,
      select: {
        month: true,
        year: true,
        netSalary: true,
        grossSalary: true,
        payScaleType: true,
        staffProfile: { select: { department: { select: { name: true } } } },
        lines: {
          select: { componentCode: true, componentType: true, amount: true },
        },
        loanInstallments: { select: { recoveredAmount: true } },
      },
    });

    const monthMap = new Map<
      string,
      {
        label: string;
        month: number;
        year: number;
        value: number;
        employeeCount: number;
      }
    >();
    const deptMap = new Map<string, number>();
    let teachingNet = 0;
    let nonTeachingNet = 0;
    let loanRecovery = 0;
    let pfEmployer = 0;
    let pfEmployee = 0;

    for (const ps of payslips) {
      const key = `${ps.year}-${ps.month}`;
      const label = `${MONTH_LABELS[ps.month - 1]} ${ps.year}`;
      const bucket = monthMap.get(key) ?? {
        label,
        month: ps.month,
        year: ps.year,
        value: 0,
        employeeCount: 0,
      };
      bucket.value += Number(ps.netSalary);
      bucket.employeeCount += 1;
      monthMap.set(key, bucket);

      const dept = ps.staffProfile.department?.name ?? 'Unassigned';
      deptMap.set(dept, (deptMap.get(dept) ?? 0) + Number(ps.netSalary));

      if (TEACHING_SCALES.includes(ps.payScaleType))
        teachingNet += Number(ps.netSalary);
      else nonTeachingNet += Number(ps.netSalary);

      for (const inst of ps.loanInstallments) {
        loanRecovery += Number(inst.recoveredAmount);
      }

      for (const line of ps.lines) {
        if (line.componentCode === 'PF_EMPLOYER')
          pfEmployer += Number(line.amount);
        if (line.componentCode === 'PF_EMPLOYEE')
          pfEmployee += Number(line.amount);
      }
    }

    const monthlyPayrollTrend = [...monthMap.values()]
      .sort((a, b) => a.year - b.year || a.month - b.month)
      .slice(-12);
    const departmentWise = [...deptMap.entries()]
      .map(([label, value]) => ({ label, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);

    return {
      monthlyPayrollTrend,
      departmentWise,
      teachingVsNonTeaching: [
        { label: 'Teaching', value: Math.round(teachingNet) },
        { label: 'Non-Teaching', value: Math.round(nonTeachingNet) },
      ],
      loanRecovery: Math.round(loanRecovery),
      pfContribution: {
        employer: Math.round(pfEmployer),
        employee: Math.round(pfEmployee),
        total: Math.round(pfEmployer + pfEmployee),
      },
    };
  }

  private async payslipIdsForQuery(
    tenantId: string,
    query: PayslipListQuery,
    publishedOnly = false,
  ) {
    const rows = await this.prisma.payslip.findMany({
      where: {
        ...this.buildWhere(tenantId, query),
        ...(publishedOnly ? { status: 'PUBLISHED' } : {}),
      },
      select: { id: true },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });
    return rows.map((r) => r.id);
  }

  async mergedPdfBuffer(
    tenantId: string,
    query: PayslipListQuery,
    publishedOnly = false,
  ) {
    const ids = await this.payslipIdsForQuery(tenantId, query, publishedOnly);
    if (!ids.length)
      throw new NotFoundException('No payslips found for the selected period');
    return this.payslipDocs.generateMergedPdf(tenantId, ids);
  }

  async salaryCertificateBuffer(
    tenantId: string,
    staffProfileId: string,
    financialYear?: number,
  ) {
    const fy = financialYear ?? PayslipsService.currentFinancialYearStart();
    const bounds = PayslipsService.financialYearBounds(fy);
    return this.payslipDocs.generateSalaryCertificatePdf(
      tenantId,
      staffProfileId,
      bounds,
    );
  }

  async regenerate(tenantId: string, payslipId: string) {
    const exists = await this.prisma.payslip.findFirst({
      where: { id: payslipId, tenantId },
    });
    if (!exists) throw new NotFoundException('Payslip not found');
    return this.payslipDocs.generatePdf(tenantId, payslipId);
  }

  async regenerateBulk(tenantId: string, query: PayslipListQuery) {
    const rows = await this.prisma.payslip.findMany({
      where: this.buildWhere(tenantId, query),
      select: { id: true },
    });
    let generated = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        await this.payslipDocs.generatePdf(tenantId, row.id);
        generated += 1;
      } catch {
        failed += 1;
      }
    }
    return { generated, failed, total: rows.length };
  }

  async downloadZip(
    tenantId: string,
    query: PayslipListQuery,
    publishedOnly = false,
  ): Promise<Buffer> {
    const rows = await this.prisma.payslip.findMany({
      where: {
        ...this.buildWhere(tenantId, query),
        ...(publishedOnly ? { status: 'PUBLISHED' } : {}),
      },
      include: {
        staffProfile: { select: { fullName: true, employeeCode: true } },
      },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });
    const zip = new JSZip();
    const { readFile } = await import('fs/promises');
    const { join } = await import('path');

    for (const ps of rows) {
      try {
        const pdfPath =
          ps.pdfPath ?? (await this.payslipDocs.generatePdf(tenantId, ps.id));
        const abs = join(process.cwd(), pdfPath.replace(/^\//, ''));
        const buf = await readFile(abs);
        const safeName = `${ps.year}-${String(ps.month).padStart(2, '0')}_${ps.staffProfile.employeeCode}.pdf`;
        zip.file(safeName, buf);
      } catch {
        // skip failed PDFs
      }
    }

    return zip.generateAsync({ type: 'nodebuffer' });
  }
}
