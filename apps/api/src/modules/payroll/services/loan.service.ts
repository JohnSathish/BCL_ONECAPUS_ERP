import { Injectable } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { CreateStaffLoanDto as LegacyCreateStaffLoanDto } from '../dto/payroll.dto';
import { LoansManagementService } from '../../loans/services/loans-management.service';
import { LoansPayrollBridgeService } from '../../loans/services/loans-payroll-bridge.service';

/** Payroll-facing loan facade — delegates to the Loans module. */
@Injectable()
export class LoanService {
  constructor(
    private readonly management: LoansManagementService,
    private readonly payrollBridge: LoansPayrollBridgeService,
  ) {}

  list(tenantId: string, staffProfileId?: string, status?: string) {
    return this.management.list(tenantId, { staffProfileId, status });
  }

  async create(user: JwtUser, dto: LegacyCreateStaffLoanDto) {
    return this.management.create(user, {
      staffProfileId: dto.staffProfileId,
      loanType: dto.loanType,
      principalAmount: dto.principalAmount,
      repaymentMethod: 'SALARY_DEDUCTION',
      salaryDeductionAmount: dto.monthlyDeduction,
      monthlyInstallment: dto.monthlyDeduction,
      loanDate: dto.startDate,
      repaymentStartDate: dto.startDate,
      notes: dto.notes,
    });
  }

  async getSchedule(tenantId: string, loanId: string) {
    return this.management.getStatement(tenantId, loanId);
  }

  getActiveDeduction(
    tenantId: string,
    staffProfileId: string,
    month: number,
    year: number,
  ) {
    return this.payrollBridge.getActiveDeduction(
      tenantId,
      staffProfileId,
      month,
      year,
    );
  }

  markRecovered(
    tenantId: string,
    staffProfileId: string,
    month: number,
    year: number,
    payrollRunId: string,
    payslipId: string,
  ) {
    return this.payrollBridge.markRecovered(
      tenantId,
      staffProfileId,
      month,
      year,
      payrollRunId,
      payslipId,
    );
  }

  unmarkRecoveredForRun(tenantId: string, payrollRunId: string) {
    return this.payrollBridge.unmarkRecoveredForRun(tenantId, payrollRunId);
  }
}
