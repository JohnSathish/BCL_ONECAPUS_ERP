import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TdsService } from './tds.service';

const MONTHS = [
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

@Injectable()
export class StaffPortalPayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tds: TdsService,
  ) {}

  async getSalaryHistory(tenantId: string, staffProfileId: string) {
    const assignment = await this.prisma.staffPayAssignment.findFirst({
      where: { tenantId, staffProfileId, status: 'ACTIVE' },
      include: {
        payStructureTemplate: { select: { name: true, code: true } },
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    const revisions = await this.prisma.salaryRevision.findMany({
      where: { tenantId, staffPayAssignment: { staffProfileId } },
      orderBy: { effectiveFrom: 'desc' },
      take: 50,
      select: {
        id: true,
        revisionType: true,
        effectiveFrom: true,
        beforeSnapshot: true,
        afterSnapshot: true,
        notes: true,
        createdAt: true,
      },
    });

    const payslips = await this.prisma.payslip.findMany({
      where: { tenantId, staffProfileId, status: 'PUBLISHED' },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 36,
      select: {
        id: true,
        month: true,
        year: true,
        grossSalary: true,
        totalDeductions: true,
        netSalary: true,
        pdfPath: true,
        emailSentAt: true,
        payrollRun: { select: { paidAt: true } },
      },
    });

    const revisionRows = revisions.map((r) => {
      const before = r.beforeSnapshot as { basicPay?: number };
      const after = r.afterSnapshot as { basicPay?: number };
      return {
        id: r.id,
        revisionType: r.revisionType,
        effectiveFrom: r.effectiveFrom,
        previousBasicPay: before.basicPay ?? null,
        newBasicPay: after.basicPay ?? null,
        notes: r.notes,
        createdAt: r.createdAt,
      };
    });

    const payslipTimeline = payslips.map((p) => ({
      id: p.id,
      label: `${MONTHS[p.month - 1]} ${p.year}`,
      month: p.month,
      year: p.year,
      grossSalary: Number(p.grossSalary),
      totalDeductions: Number(p.totalDeductions),
      netSalary: Number(p.netSalary),
      pdfPath: p.pdfPath,
      emailSentAt: p.emailSentAt,
      paidAt: p.payrollRun.paidAt,
    }));

    return {
      currentAssignment: assignment
        ? {
            basicPay: Number(assignment.basicPay),
            payScaleType: assignment.payScaleType,
            effectiveFrom: assignment.effectiveFrom,
            structureName: assignment.payStructureTemplate?.name ?? null,
          }
        : null,
      revisions: revisionRows,
      payslipTimeline,
    };
  }

  async getTaxSummary(tenantId: string, staffProfileId: string, year?: number) {
    const y = year ?? new Date().getFullYear();
    const settings = await this.prisma.payrollSettings.findUnique({
      where: { tenantId },
    });

    const payslips = await this.prisma.payslip.findMany({
      where: { tenantId, staffProfileId, year: y, status: 'PUBLISHED' },
      include: { lines: true },
      orderBy: { month: 'asc' },
    });

    let ytdGross = 0;
    let ytdNet = 0;
    let ytdTds = 0;
    let ytdPt = 0;
    const monthlyBreakdown: Array<{
      month: number;
      label: string;
      gross: number;
      net: number;
      tds: number;
      professionalTax: number;
    }> = [];

    for (const ps of payslips) {
      const gross = Number(ps.grossSalary);
      const net = Number(ps.netSalary);
      const tdsLine = ps.lines.find((l) => l.componentCode === 'TDS');
      const ptLine = ps.lines.find(
        (l) => l.componentCode === 'PROFESSIONAL_TAX',
      );
      const tdsAmt = tdsLine ? Number(tdsLine.amount) : 0;
      const ptAmt = ptLine ? Number(ptLine.amount) : 0;

      ytdGross += gross;
      ytdNet += net;
      ytdTds += tdsAmt;
      ytdPt += ptAmt;

      monthlyBreakdown.push({
        month: ps.month,
        label: MONTHS[ps.month - 1],
        gross,
        net,
        tds: tdsAmt,
        professionalTax: ptAmt,
      });
    }

    const projectedAnnualTax = this.tds.computeAnnualTax(
      ytdGross,
      settings?.tdsSlabs,
    );
    const avgMonthlyGross = payslips.length ? ytdGross / payslips.length : 0;
    const projectedMonthlyTds = this.tds.computeMonthlyTds(
      avgMonthlyGross,
      settings?.tdsSlabs,
    );

    return {
      year: y,
      ytdGross,
      ytdNet,
      ytdTds,
      ytdProfessionalTax: ytdPt,
      monthsWithPayslips: payslips.length,
      monthlyBreakdown,
      form16Available: ytdTds > 0 && payslips.length >= 1,
      projectedAnnualTax,
      projectedMonthlyTds,
      note:
        payslips.length === 0
          ? 'No published payslips for this financial year yet.'
          : 'Form 16 certificate generation will be available in a future release.',
    };
  }
}
