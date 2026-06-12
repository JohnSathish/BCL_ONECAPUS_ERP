import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreatePaySalaryComponentDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsString()
  componentType!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsBoolean()
  isStatutory?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdatePaySalaryComponentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsBoolean()
  isStatutory?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class PayStructureComponentDto {
  @IsUUID()
  paySalaryComponentId!: string;

  @IsObject()
  formulaJson!: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  fixedOverride?: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class CreatePayStructureDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsString()
  structureType!: string;

  @IsOptional()
  @IsArray()
  payScaleTypes?: string[];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayStructureComponentDto)
  components?: PayStructureComponentDto[];
}

export class UpdatePayStructureDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayStructureComponentDto)
  components?: PayStructureComponentDto[];
}

export class CreateStaffPayAssignmentDto {
  @IsUUID()
  staffProfileId!: string;

  @IsUUID()
  payStructureTemplateId!: string;

  @IsString()
  payScaleType!: string;

  @IsNumber()
  basicPay!: number;

  @IsString()
  effectiveFrom!: string;

  @IsOptional()
  @IsString()
  effectiveTo?: string;

  @IsOptional()
  @IsObject()
  componentOverrides?: Record<string, unknown>;

  @IsOptional()
  pfExempt?: boolean;

  @IsOptional()
  @IsNumber()
  houseRent?: number;

  @IsOptional()
  @IsNumber()
  cpfRate?: number;

  @IsOptional()
  @IsNumber()
  fixedAllowance?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePayAssignmentStatutoryDto {
  @IsOptional()
  pfExempt?: boolean;

  @IsOptional()
  @IsNumber()
  houseRent?: number;

  @IsOptional()
  @IsNumber()
  cpfRate?: number;

  @IsOptional()
  @IsNumber()
  fixedAllowance?: number;
}

export class CreateSalaryRevisionDto {
  @IsUUID()
  staffPayAssignmentId!: string;

  @IsString()
  revisionType!: string;

  @IsString()
  effectiveFrom!: string;

  @IsNumber()
  newBasicPay!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateIncrementBatchDto {
  @IsString()
  name!: string;

  @IsString()
  incrementType!: string;

  @IsNumber()
  incrementValue!: number;

  @IsString()
  effectiveFrom!: string;

  @IsOptional()
  @IsObject()
  filterJson?: Record<string, unknown>;
}

export class CreateStaffLoanDto {
  @IsUUID()
  staffProfileId!: string;

  @IsString()
  loanType!: string;

  @IsNumber()
  principalAmount!: number;

  @IsNumber()
  monthlyDeduction!: number;

  @IsString()
  startDate!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreatePayrollRunDto {
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @IsInt()
  @Min(2000)
  year!: number;

  @IsOptional()
  @IsString()
  payScaleType?: string;

  @IsOptional()
  @IsUUID()
  payStructureTemplateId?: string;

  @IsOptional()
  @IsString()
  label?: string;
}

export class CreateArrearBatchDto {
  @IsString()
  name!: string;

  @IsString()
  effectiveFrom!: string;

  @IsInt()
  appliedInMonth!: number;

  @IsInt()
  appliedInYear!: number;

  @IsOptional()
  @IsUUID()
  payrollRunId?: string;
}

export class PayrollSettingsDto {
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  payslipFooter?: string;

  @IsOptional()
  @IsNumber()
  defaultPfRate?: number;

  @IsOptional()
  @IsNumber()
  defaultCpfRate?: number;

  @IsOptional()
  @IsObject()
  professionalTaxSlabs?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  tdsSlabs?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  qrVerifyBaseUrl?: string;

  @IsOptional()
  @IsObject()
  exportLayouts?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  bankFileFormats?: Record<string, unknown>;
}

export class PayrollQueryDto {
  @IsOptional()
  @IsString()
  payScaleType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  month?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  staffProfileId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  staffType?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  payrollRunId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  fromMonth?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  fromYear?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  toMonth?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  toYear?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  financialYear?: number;

  @IsOptional()
  @IsString()
  periodPreset?: string;
}

export class ListPayAssignmentsQueryDto {
  @IsOptional()
  @IsUUID()
  staffProfileId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  staffType?: string;

  @IsOptional()
  @IsUUID()
  designationId?: string;

  @IsOptional()
  @IsString()
  payScaleType?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

export class BulkStaffPayAssignmentDto {
  @IsUUID()
  payStructureTemplateId!: string;

  @IsString()
  payScaleType!: string;

  @IsString()
  effectiveFrom!: string;

  @IsOptional()
  @IsNumber()
  basicPay?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  staffType?: string;

  @IsOptional()
  @IsArray()
  staffProfileIds?: string[];
}

export class FormulaPreviewDto {
  @IsObject()
  formulaJson!: Record<string, unknown>;

  @IsNumber()
  basicPay!: number;

  @IsOptional()
  @IsObject()
  context?: Record<string, number>;
}

export class UpsertStaffPfConfigDto {
  @IsBoolean()
  pfEnabled!: boolean;

  @IsOptional()
  @IsBoolean()
  employeePfApplicable?: boolean;

  @IsOptional()
  @IsBoolean()
  employerPfApplicable?: boolean;

  @IsOptional()
  @IsString()
  pfScheme?: string;

  @IsOptional()
  @IsNumber()
  employeePfAmount?: number | null;

  @IsOptional()
  @IsNumber()
  employerPfAmount?: number | null;

  @IsOptional()
  @IsString()
  pfAccountNumber?: string | null;

  @IsOptional()
  @IsString()
  uanNumber?: string | null;

  @IsString()
  effectiveFrom!: string;

  @IsOptional()
  @IsString()
  remarks?: string | null;
}

export class BulkStaffPfConfigDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  staffProfileIds!: string[];

  @IsOptional()
  @IsBoolean()
  pfEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  employeePfApplicable?: boolean;

  @IsOptional()
  @IsBoolean()
  employerPfApplicable?: boolean;

  @IsOptional()
  @IsString()
  pfScheme?: string;

  @IsOptional()
  @IsNumber()
  employeePfAmount?: number | null;

  @IsOptional()
  @IsNumber()
  employerPfAmount?: number | null;

  @IsOptional()
  @IsString()
  effectiveFrom?: string;

  @IsOptional()
  @IsString()
  remarks?: string | null;
}

export class CreatePayslipAdjustmentDto {
  @IsUUID()
  staffProfileId!: string;

  @IsString()
  label!: string;

  @IsString()
  adjustmentType!: 'EARNING' | 'DEDUCTION';

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ExcludeStaffFromRunDto {
  @IsUUID()
  staffProfileId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
