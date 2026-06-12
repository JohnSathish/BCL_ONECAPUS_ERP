import { Controller, Get, Param, Query, Res } from '@nestjs/common';

import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import type { Response } from 'express';

import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';

import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';

import { PrismaService } from '../../database/prisma.service';

import { PayslipDocumentService } from './services/payslip-document.service';

import { PfCpfService } from './services/pf-cpf.service';

import { LoanService } from './services/loan.service';

import { StaffPortalPayrollService } from './services/staff-portal-payroll.service';
import { PayslipsService } from './services/payslips.service';

@ApiBearerAuth()
@ApiTags('staff-portal-payroll')
@Controller({ path: 'staff/me/payroll', version: '1' })
export class StaffPortalPayrollController {
  constructor(
    private readonly prisma: PrismaService,

    private readonly payslipDocs: PayslipDocumentService,

    private readonly pfCpf: PfCpfService,

    private readonly loans: LoanService,

    private readonly staffPayroll: StaffPortalPayrollService,

    private readonly payslips: PayslipsService,
  ) {}

  private async staffProfileId(user: JwtUser) {
    const profile = await this.prisma.staffProfile.findFirst({
      where: { portalUserId: user.sub, tenantId: user.tid },
    });

    return profile?.id;
  }

  @Get('payslips')
  @RequireAnyPermission('staff:portal:self', 'payroll:portal:self')
  async myPayslips(@CurrentUser() user: JwtUser) {
    const staffProfileId = await this.staffProfileId(user);

    if (!staffProfileId) return [];

    return this.prisma.payslip.findMany({
      where: { tenantId: user.tid, staffProfileId, status: 'PUBLISHED' },

      orderBy: [{ year: 'desc' }, { month: 'desc' }],

      select: {
        id: true,

        month: true,

        year: true,

        grossSalary: true,

        totalDeductions: true,

        netSalary: true,

        pdfPath: true,

        emailSentAt: true,
      },
    });
  }

  @Get('salary-history')
  @RequireAnyPermission('staff:portal:self', 'payroll:portal:self')
  async salaryHistory(@CurrentUser() user: JwtUser) {
    const staffProfileId = await this.staffProfileId(user);

    if (!staffProfileId) {
      return { currentAssignment: null, revisions: [], payslipTimeline: [] };
    }

    return this.staffPayroll.getSalaryHistory(user.tid, staffProfileId);
  }

  @Get('payslips/merged-pdf')
  @RequireAnyPermission('staff:portal:self', 'payroll:portal:self')
  async myMergedPayslipPdf(
    @CurrentUser() user: JwtUser,
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ) {
    const staffProfileId = await this.staffProfileId(user);

    if (!staffProfileId)
      return res.status(404).json({ message: 'Staff profile not found' });

    const buf = await this.payslips.mergedPdfBuffer(
      user.tid,
      {
        ...query,
        staffProfileId,
        periodPreset: query.periodPreset,
        fromMonth: query.fromMonth ? Number(query.fromMonth) : undefined,
        fromYear: query.fromYear ? Number(query.fromYear) : undefined,
        toMonth: query.toMonth ? Number(query.toMonth) : undefined,
        toYear: query.toYear ? Number(query.toYear) : undefined,
        financialYear: query.financialYear
          ? Number(query.financialYear)
          : undefined,
        month: query.month ? Number(query.month) : undefined,
        year: query.year ? Number(query.year) : undefined,
      },
      true,
    );

    res.setHeader('Content-Type', 'application/pdf');

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="my-payslips.pdf"',
    );

    return res.send(buf);
  }

  @Get('payslips/download-zip')
  @RequireAnyPermission('staff:portal:self', 'payroll:portal:self')
  async myPayslipsZip(
    @CurrentUser() user: JwtUser,
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ) {
    const staffProfileId = await this.staffProfileId(user);

    if (!staffProfileId)
      return res.status(404).json({ message: 'Staff profile not found' });

    const buf = await this.payslips.downloadZip(
      user.tid,
      {
        ...query,
        staffProfileId,
        periodPreset: query.periodPreset,
        fromMonth: query.fromMonth ? Number(query.fromMonth) : undefined,
        fromYear: query.fromYear ? Number(query.fromYear) : undefined,
        toMonth: query.toMonth ? Number(query.toMonth) : undefined,
        toYear: query.toYear ? Number(query.toYear) : undefined,
        financialYear: query.financialYear
          ? Number(query.financialYear)
          : undefined,
        month: query.month ? Number(query.month) : undefined,
        year: query.year ? Number(query.year) : undefined,
      },
      true,
    );

    res.setHeader('Content-Type', 'application/zip');

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="my-payslips.zip"',
    );

    return res.send(buf);
  }

  @Get('salary-certificate/pdf')
  @RequireAnyPermission('staff:portal:self', 'payroll:portal:self')
  async mySalaryCertificate(
    @CurrentUser() user: JwtUser,
    @Query('financialYear') financialYear: string | undefined,
    @Res() res: Response,
  ) {
    const staffProfileId = await this.staffProfileId(user);

    if (!staffProfileId)
      return res.status(404).json({ message: 'Staff profile not found' });

    const buf = await this.payslips.salaryCertificateBuffer(
      user.tid,
      staffProfileId,
      financialYear ? Number(financialYear) : undefined,
    );

    res.setHeader('Content-Type', 'application/pdf');

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="salary-certificate.pdf"',
    );

    return res.send(buf);
  }

  @Get('payslips/:id/pdf')
  @RequireAnyPermission('staff:portal:self', 'payroll:portal:self')
  async myPayslipPdf(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const staffProfileId = await this.staffProfileId(user);

    const payslip = await this.prisma.payslip.findFirst({
      where: { id, tenantId: user.tid, staffProfileId, status: 'PUBLISHED' },
    });

    if (!payslip) return res.status(404).json({ message: 'Payslip not found' });

    const buffer = await this.payslipDocs.readPdfBuffer(user.tid, id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="payslip-${payslip.month}-${payslip.year}.pdf"`,
    );
    return res.send(buffer);
  }

  @Get('loans')
  @RequireAnyPermission('staff:portal:self', 'payroll:portal:self')
  async myLoans(@CurrentUser() user: JwtUser) {
    const staffProfileId = await this.staffProfileId(user);

    if (!staffProfileId) return [];

    return this.loans.list(user.tid, staffProfileId);
  }

  @Get('pf-summary')
  @RequireAnyPermission('staff:portal:self', 'payroll:portal:self')
  async myPfSummary(@CurrentUser() user: JwtUser) {
    const staffProfileId = await this.staffProfileId(user);

    if (!staffProfileId) return null;

    return this.pfCpf.staffSummary(
      user.tid,
      staffProfileId,
      new Date().getFullYear(),
    );
  }

  @Get('tax-summary')
  @RequireAnyPermission('staff:portal:self', 'payroll:portal:self')
  async taxSummary(@CurrentUser() user: JwtUser, @Query('year') year?: string) {
    const staffProfileId = await this.staffProfileId(user);

    if (!staffProfileId) {
      return {
        year: new Date().getFullYear(),

        ytdGross: 0,

        ytdNet: 0,

        ytdTds: 0,

        ytdProfessionalTax: 0,

        monthsWithPayslips: 0,

        monthlyBreakdown: [],

        form16Available: false,

        note: 'Staff profile not linked to portal account.',
      };
    }

    return this.staffPayroll.getTaxSummary(
      user.tid,

      staffProfileId,

      year ? Number(year) : undefined,
    );
  }
}
