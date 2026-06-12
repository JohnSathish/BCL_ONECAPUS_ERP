import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../../database/prisma.service';
@Injectable()
export class AccommodationReportsService {
  constructor(private readonly prisma: PrismaService) {}

  occupancyReport(tenantId: string, status?: string) {
    return this.prisma.staffQuarter.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(status ? { status } : {}),
      },
      include: {
        occupancies: {
          where: { status: 'ACTIVE' },
          take: 1,
          include: {
            staffProfile: {
              select: {
                fullName: true,
                employeeCode: true,
                department: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: [{ block: 'asc' }, { quarterNumber: 'asc' }],
    });
  }

  staffRegister(tenantId: string) {
    return this.prisma.quarterOccupancy.findMany({
      where: { tenantId, status: 'ACTIVE' },
      include: {
        quarter: true,
        staffProfile: {
          select: {
            fullName: true,
            employeeCode: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { staffProfile: { fullName: 'asc' } },
    });
  }

  historyReport(tenantId: string, quarterId?: string) {
    return this.prisma.quarterOccupancy.findMany({
      where: {
        tenantId,
        ...(quarterId ? { quarterId } : {}),
      },
      include: {
        quarter: {
          select: {
            code: true,
            quarterNumber: true,
            block: true,
            quarterType: true,
          },
        },
        staffProfile: {
          select: {
            fullName: true,
            employeeCode: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: [{ allottedAt: 'desc' }],
    });
  }

  departmentWise(tenantId: string) {
    return this.prisma.quarterOccupancy.findMany({
      where: { tenantId, status: 'ACTIVE' },
      include: {
        quarter: { select: { code: true, block: true } },
        staffProfile: {
          select: {
            fullName: true,
            employeeCode: true,
            department: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async payrollRecoveryReport(
    tenantId: string,
    month: number,
    year: number,
    componentCode?: string,
  ) {
    const lines = await this.prisma.payslipLine.findMany({
      where: {
        tenantId,
        payslip: { month, year },
        componentCode: componentCode
          ? componentCode
          : {
              in: [
                'QUARTER_RENT',
                'ACCOM_WATER',
                'ACCOM_ELECTRICITY',
                'ACCOM_MAINTENANCE',
                'ACCOM_INTERNET',
                'H_RENT',
              ],
            },
      },
      include: {
        payslip: {
          include: {
            staffProfile: {
              select: {
                fullName: true,
                employeeCode: true,
                department: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { payslip: { staffProfile: { fullName: 'asc' } } },
    });
    return lines.map((l) => ({
      staffName: l.payslip.staffProfile.fullName,
      employeeCode: l.payslip.staffProfile.employeeCode,
      department: l.payslip.staffProfile.department?.name ?? null,
      componentCode: l.componentCode,
      componentName: l.componentName,
      amount: Number(l.amount),
      month,
      year,
    }));
  }

  async exportOccupancyExcel(tenantId: string, status?: string) {
    const rows = await this.occupancyReport(tenantId, status);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Quarter Occupancy');
    ws.addRow([
      'Code',
      'Quarter No',
      'Type',
      'Block',
      'Floor',
      'Status',
      'Rent',
      'Occupant',
      'Employee Code',
      'Department',
    ]);
    for (const q of rows) {
      const occ = q.occupancies[0];
      ws.addRow([
        q.code,
        q.quarterNumber,
        q.quarterType,
        q.block ?? '',
        q.floor ?? '',
        q.status,
        Number(q.monthlyRent),
        occ?.staffProfile.fullName ?? '',
        occ?.staffProfile.employeeCode ?? '',
        occ?.staffProfile.department?.name ?? '',
      ]);
    }
    ws.getRow(1).font = { bold: true };
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async exportPayrollRecoveryExcel(
    tenantId: string,
    month: number,
    year: number,
  ) {
    const rows = await this.payrollRecoveryReport(tenantId, month, year);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Accommodation Recovery');
    ws.addRow([
      'Staff',
      'Code',
      'Department',
      'Component',
      'Amount',
      'Month',
      'Year',
    ]);
    for (const r of rows) {
      ws.addRow([
        r.staffName,
        r.employeeCode,
        r.department ?? '',
        r.componentName,
        r.amount,
        r.month,
        r.year,
      ]);
    }
    ws.getRow(1).font = { bold: true };
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async exportStaffRegisterExcel(tenantId: string) {
    const rows = await this.staffRegister(tenantId);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Staff Register');
    ws.addRow([
      'Staff',
      'Code',
      'Department',
      'Quarter',
      'Block',
      'Type',
      'Monthly Rent',
      'Allotted',
    ]);
    for (const r of rows) {
      ws.addRow([
        r.staffProfile.fullName,
        r.staffProfile.employeeCode,
        r.staffProfile.department?.name ?? '',
        r.quarter.code,
        r.quarter.block ?? '',
        r.quarter.quarterType,
        Number(r.monthlyRent),
        r.allottedAt,
      ]);
    }
    ws.getRow(1).font = { bold: true };
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}
