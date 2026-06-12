import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('payroll-verify')
@Controller({ path: 'verify/payslip', version: '1' })
export class PayrollVerifyController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get(':token')
  async verify(@Param('token') token: string) {
    const payslip = await this.prisma.payslip.findFirst({
      where: { verifyToken: token, status: 'PUBLISHED' },
      include: {
        staffProfile: {
          select: {
            fullName: true,
            employeeCode: true,
            department: { select: { name: true } },
          },
        },
      },
    });
    if (!payslip) return { valid: false };
    return {
      valid: true,
      employee: payslip.staffProfile.fullName,
      employeeCode: payslip.staffProfile.employeeCode,
      department: payslip.staffProfile.department?.name,
      month: payslip.month,
      year: payslip.year,
      netSalary: Number(payslip.netSalary),
    };
  }
}
