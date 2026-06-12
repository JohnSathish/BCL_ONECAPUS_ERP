import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class PfCpfService {
  constructor(private readonly prisma: PrismaService) {}

  async recordFromPayslip(
    tenantId: string,
    payslipId: string,
    staffProfileId: string,
    month: number,
    year: number,
    lines: Array<{ code: string; amount: number }>,
  ) {
    const pfEmployerLine = lines.find(
      (l) => l.code === 'PF_EMPLOYER' || l.code === 'PF_EARNING',
    );
    const pfEmployeeLine = lines.find((l) => l.code === 'PF_EMPLOYEE');
    const pfDeductionLine = lines.find((l) => l.code === 'PF');
    const ppfLine = lines.find((l) => l.code === 'PPF');
    const cpfLine = lines.find((l) => l.code === 'CPF');
    const npsLine = lines.find((l) => l.code === 'NPS');

    if (pfEmployerLine && pfEmployerLine.amount > 0) {
      const employeeShare =
        pfEmployeeLine?.amount ??
        (ppfLine && ppfLine.amount > pfEmployerLine.amount
          ? ppfLine.amount - pfEmployerLine.amount
          : pfEmployerLine.amount);
      await this.prisma.pfCpfLedgerEntry.create({
        data: {
          tenantId,
          payslipId,
          staffProfileId,
          month,
          year,
          contributionType: 'PF',
          employeeContribution: employeeShare,
          employerContribution: pfEmployerLine.amount,
        },
      });
    } else if (pfDeductionLine && pfDeductionLine.amount > 0) {
      await this.prisma.pfCpfLedgerEntry.create({
        data: {
          tenantId,
          payslipId,
          staffProfileId,
          month,
          year,
          contributionType: 'PF',
          employeeContribution: pfDeductionLine.amount,
          employerContribution: pfDeductionLine.amount,
        },
      });
    }
    if (cpfLine && cpfLine.amount > 0) {
      await this.prisma.pfCpfLedgerEntry.create({
        data: {
          tenantId,
          payslipId,
          staffProfileId,
          month,
          year,
          contributionType: 'CPF',
          employeeContribution: cpfLine.amount,
          employerContribution: cpfLine.amount,
        },
      });
    }
    if (npsLine && npsLine.amount > 0) {
      await this.prisma.pfCpfLedgerEntry.create({
        data: {
          tenantId,
          payslipId,
          staffProfileId,
          month,
          year,
          contributionType: 'NPS',
          employeeContribution: npsLine.amount,
          employerContribution: 0,
        },
      });
    }
  }

  list(
    tenantId: string,
    query: {
      staffProfileId?: string;
      month?: number;
      year?: number;
      type?: string;
    },
  ) {
    return this.prisma.pfCpfLedgerEntry.findMany({
      where: {
        tenantId,
        ...(query.staffProfileId
          ? { staffProfileId: query.staffProfileId }
          : {}),
        ...(query.month ? { month: query.month } : {}),
        ...(query.year ? { year: query.year } : {}),
        ...(query.type ? { contributionType: query.type } : {}),
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  async staffSummary(tenantId: string, staffProfileId: string, year: number) {
    const entries = await this.prisma.pfCpfLedgerEntry.findMany({
      where: { tenantId, staffProfileId, year },
    });
    const pf = entries.filter((e) => e.contributionType === 'PF');
    const cpf = entries.filter((e) => e.contributionType === 'CPF');
    const nps = entries.filter((e) => e.contributionType === 'NPS');
    const sum = (
      rows: typeof entries,
      field: 'employeeContribution' | 'employerContribution',
    ) => rows.reduce((s, r) => s + Number(r[field]), 0);

    return {
      year,
      pfEmployee: sum(pf, 'employeeContribution'),
      pfEmployer: sum(pf, 'employerContribution'),
      cpfEmployee: sum(cpf, 'employeeContribution'),
      cpfEmployer: sum(cpf, 'employerContribution'),
      npsEmployee: sum(nps, 'employeeContribution'),
      npsEmployer: sum(nps, 'employerContribution'),
      monthly: entries,
    };
  }
}
