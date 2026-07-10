import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class ListQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class CreateFinancialYearDto {
  @IsInt()
  startYear!: number;
}

export class ActivateFinancialYearDto {
  @IsUUID()
  id!: string;
}

export class CreateAccountGroupDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsIn(['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE'])
  nature!: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class UpdateAccountGroupDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class CreateLedgerAccountDto {
  @IsUUID()
  groupId!: string;

  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsIn(['GENERAL', 'CASH', 'BANK'])
  ledgerType?: string;

  @IsOptional()
  @IsBoolean()
  isCash?: boolean;

  @IsOptional()
  @IsBoolean()
  isBank?: boolean;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  openingBalance?: number;
}

export class UpdateLedgerAccountDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;
}

export class VoucherLineDto {
  @IsUUID()
  ledgerAccountId!: string;

  @IsIn(['DEBIT', 'CREDIT'])
  entryType!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  narration?: string;
}

export class CreateVoucherDto {
  @IsUUID()
  voucherTypeId!: string;

  @IsDateString()
  voucherDate!: string;

  @IsOptional()
  @IsString()
  narration?: string;

  @IsOptional()
  @IsString()
  referenceNo?: string;

  @IsOptional()
  @IsString()
  chequeNo?: string;

  @IsOptional()
  @IsString()
  paymentMode?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VoucherLineDto)
  lines!: VoucherLineDto[];
}

export class UpdateVoucherDto {
  @IsOptional()
  @IsDateString()
  voucherDate?: string;

  @IsOptional()
  @IsString()
  narration?: string;

  @IsOptional()
  @IsString()
  referenceNo?: string;

  @IsOptional()
  @IsString()
  chequeNo?: string;

  @IsOptional()
  @IsString()
  paymentMode?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VoucherLineDto)
  lines?: VoucherLineDto[];
}

export class BooksQueryDto extends ListQueryDto {
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsUUID()
  ledgerAccountId?: string;

  @IsOptional()
  @IsUUID()
  financialYearId?: string;
}

export class LedgerQueryDto extends BooksQueryDto {}

export class VoucherListQueryDto extends BooksQueryDto {
  @IsOptional()
  @IsUUID()
  voucherTypeId?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'POSTED', 'CANCELLED'])
  status?: string;
}

export class UpdateAccountingSettingsDto {
  @IsOptional()
  @IsBoolean()
  autoPostFees?: boolean;

  @IsOptional()
  @IsBoolean()
  autoPostPayroll?: boolean;

  @IsOptional()
  @IsUUID()
  defaultCashLedgerId?: string | null;

  @IsOptional()
  @IsUUID()
  defaultBankLedgerId?: string | null;

  @IsOptional()
  @IsUUID()
  defaultIncomeLedgerId?: string | null;

  @IsOptional()
  @IsUUID()
  salaryExpenseLedgerId?: string | null;

  @IsOptional()
  @IsUUID()
  salaryPayableLedgerId?: string | null;

  @IsOptional()
  @IsUUID()
  payrollDeductionsLedgerId?: string | null;
}

export class UpsertFeeHeadMappingDto {
  @IsString()
  sourceKey!: string;

  @IsOptional()
  @IsUUID()
  feeHeadId?: string;

  @IsUUID()
  incomeLedgerId!: string;
}

export class UpsertPaymentModeMappingDto {
  @IsString()
  paymentMode!: string;

  @IsUUID()
  debitLedgerId!: string;
}

export class UpsertPayrollComponentMappingDto {
  @IsString()
  componentCode!: string;

  @IsUUID()
  ledgerAccountId!: string;
}

export class CreateFixedAssetDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsString()
  category!: string;

  @IsDateString()
  acquisitionDate!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  cost!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salvageValue?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  usefulLifeMonths!: number;

  @IsUUID()
  assetLedgerId!: string;

  @IsUUID()
  accumDepreciationLedgerId!: string;

  @IsUUID()
  expenseLedgerId!: string;

  @IsOptional()
  @IsString()
  location?: string;
}

export class UpdateFixedAssetDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsDateString()
  acquisitionDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  cost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salvageValue?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usefulLifeMonths?: number;

  @IsOptional()
  @IsUUID()
  assetLedgerId?: string;

  @IsOptional()
  @IsUUID()
  accumDepreciationLedgerId?: string;

  @IsOptional()
  @IsUUID()
  expenseLedgerId?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class RunDepreciationDto {
  @Type(() => Number)
  @IsInt()
  periodYear!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  periodMonth!: number;
}

export class CreateBankReconciliationDto {
  @IsUUID()
  ledgerAccountId!: string;

  @IsDateString()
  statementStartDate!: string;

  @IsDateString()
  statementEndDate!: string;

  @Type(() => Number)
  @IsNumber()
  statementOpeningBalance!: number;

  @Type(() => Number)
  @IsNumber()
  statementClosingBalance!: number;
}

export class BankStatementLineDto {
  @IsDateString()
  lineDate!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  referenceNo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  debitAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  creditAmount?: number;
}

export class ImportBankStatementDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BankStatementLineDto)
  lines!: BankStatementLineDto[];
}

export class CreateVendorDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  gstin?: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;
}

export class UpdateVendorDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  gstin?: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateExpenseDto {
  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @IsUUID()
  ledgerAccountId!: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsDateString()
  expenseDate!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  gstAmount?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  billNo?: string;
}

export class UpdateExpenseDto {
  @IsOptional()
  @IsUUID()
  vendorId?: string | null;

  @IsOptional()
  @IsUUID()
  ledgerAccountId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsDateString()
  expenseDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  gstAmount?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  billNo?: string;
}

export class ExpenseListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(['DRAFT', 'POSTED'])
  status?: string;

  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

export class CreateBudgetDto {
  @IsUUID()
  financialYearId!: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsUUID()
  ledgerAccountId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  allocatedAmount!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateBudgetDto {
  @IsOptional()
  @IsUUID()
  financialYearId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsUUID()
  ledgerAccountId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  allocatedAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
