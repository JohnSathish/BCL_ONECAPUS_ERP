import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { LOAN_REPAYMENT_METHODS } from '../constants';

export class CreateLoanTypeDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  maxAmount?: number;

  @IsOptional()
  @IsNumber()
  defaultInstallment?: number;

  @IsOptional()
  @IsBoolean()
  interestApplicable?: boolean;

  @IsOptional()
  @IsNumber()
  interestRate?: number;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class UpdateLoanTypeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  maxAmount?: number;

  @IsOptional()
  @IsNumber()
  defaultInstallment?: number;

  @IsOptional()
  @IsBoolean()
  interestApplicable?: boolean;

  @IsOptional()
  @IsNumber()
  interestRate?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class CreateStaffLoanDto {
  @IsUUID()
  staffProfileId!: string;

  @IsOptional()
  @IsUUID()
  loanTypeConfigId?: string;

  @IsString()
  loanType!: string;

  @IsNumber()
  @Min(1)
  principalAmount!: number;

  @IsString()
  @IsIn([...LOAN_REPAYMENT_METHODS])
  repaymentMethod!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salaryDeductionAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyInstallment?: number;

  @IsString()
  loanDate!: string;

  @IsOptional()
  @IsString()
  repaymentStartDate?: string;

  @IsOptional()
  @IsString()
  expectedCloseDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RecordLoanPaymentDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  @IsIn(['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE'])
  paymentMode!: string;

  @IsString()
  paymentDate!: string;

  @IsOptional()
  @IsString()
  transactionReference?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class CancelLoanReceiptDto {
  @IsString()
  reason!: string;
}

export class EmailLoanReceiptDto {
  @IsOptional()
  @IsString()
  email?: string;
}

export class RestructureLoanDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  salaryDeductionAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyInstallment?: number;

  @IsOptional()
  @IsString()
  @IsIn([...LOAN_REPAYMENT_METHODS])
  repaymentMethod?: string;

  @IsOptional()
  @IsBoolean()
  paused?: boolean;

  @IsOptional()
  @IsString()
  expectedCloseDate?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class ListLoansQueryDto {
  @IsOptional()
  @IsUUID()
  staffProfileId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  repaymentMethod?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

export class StaffSearchQueryDto {
  @IsOptional()
  @IsString()
  q?: string;
}
