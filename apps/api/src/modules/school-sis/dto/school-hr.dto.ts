import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class SaveHrDepartmentDto {
  @IsString() @MaxLength(20) code!: string;
  @IsString() @MaxLength(80) name!: string;
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUUID() headStaffId?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class SaveHrDesignationDto {
  @IsString() @MaxLength(20) code!: string;
  @IsString() @MaxLength(80) name!: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsString() grade?: string;
  @IsOptional() @IsString() jobDescription?: string;
  @IsOptional() @IsInt() salaryMinPaise?: number;
  @IsOptional() @IsInt() salaryMaxPaise?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class SaveHrEmployeeTypeDto {
  @IsString() @MaxLength(20) code!: string;
  @IsString() @MaxLength(80) name!: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CreateHrEmployeeDto {
  @IsOptional() @IsString() employeeCode?: string;
  @IsString() @MaxLength(120) fullName!: string;
  @IsOptional() @IsString() staffType?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsDateString() joiningDate?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsUUID() designationId?: string;
  @IsOptional() @IsUUID() employeeTypeId?: string;
}

export class SaveHrEmploymentDto {
  @IsOptional() @IsUUID() employeeTypeId?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsUUID() designationId?: string;
  @IsOptional() @IsUUID() reportingStaffId?: string;
  @IsOptional() @IsString() workLocation?: string;
  @IsOptional() @IsString() shift?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() grade?: string;
  @IsOptional() @IsString() campus?: string;
  @IsOptional() @IsDateString() probationStart?: string;
  @IsOptional() @IsDateString() probationEnd?: string;
  @IsOptional() @IsDateString() confirmationDate?: string;
  @IsOptional() @IsDateString() retirementDate?: string;
  @IsOptional() @IsDateString() contractStart?: string;
  @IsOptional() @IsDateString() contractEnd?: string;
  @IsOptional() @IsString() panFull?: string;
  @IsOptional() @IsString() uan?: string;
  @IsOptional() @IsString() pfNumber?: string;
  @IsOptional() @IsString() esiNumber?: string;
  @IsOptional() @IsString() taxRegime?: string;
}

export class SaveHrBankDto {
  @IsString() holderName!: string;
  @IsString() bankName!: string;
  @IsOptional() @IsString() branch?: string;
  @IsString() accountFull!: string;
  @IsString() ifsc!: string;
  @IsOptional() @IsString() accountType?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}

export class SaveHrComponentDto {
  @IsString() code!: string;
  @IsString() name!: string;
  @IsString() kind!: string;
  @IsString() calcType!: string;
  @IsOptional() @IsString() formula?: string;
  @IsOptional() @IsInt() defaultPaise?: number;
  @IsOptional() @IsBoolean() taxable?: boolean;
  @IsOptional() @IsBoolean() recurring?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class StructureLineDto {
  @IsUUID() componentId!: string;
  @IsOptional() @IsString() formula?: string;
  @IsOptional() @IsInt() amountPaise?: number;
}

export class SaveHrStructureDto {
  @IsString() code!: string;
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StructureLineDto)
  lines!: StructureLineDto[];
}

export class AssignSalaryDto {
  @IsUUID() staffId!: string;
  @IsUUID() structureId!: string;
  @IsInt() basicPaise!: number;
  @IsDateString() effectiveFrom!: string;
  @IsOptional() @IsString() remarks?: string;
}

export class SalaryRevisionDto {
  @IsUUID() staffId!: string;
  @IsInt() newPaise!: number;
  @IsDateString() effectiveDate!: string;
  @IsOptional() @IsString() reason?: string;
}

export class LeaveRequestDto {
  @IsUUID() staffId!: string;
  @IsUUID() leaveTypeId!: string;
  @IsDateString() fromDate!: string;
  @IsDateString() toDate!: string;
  @IsOptional() @IsNumber() days?: number;
  @IsOptional() @IsString() reason?: string;
}

export class SaveLeaveTypeDto {
  @IsString() code!: string;
  @IsString() name!: string;
  @IsOptional() @IsBoolean() paid?: boolean;
  @IsOptional() @IsBoolean() isLop?: boolean;
  @IsOptional() @IsBoolean() requiresDocument?: boolean;
}

export class SaveLeavePolicyDto {
  @IsUUID() leaveTypeId!: string;
  @IsOptional() @IsUUID() employeeTypeId?: string;
  @IsOptional() @IsNumber() annualEntitlement?: number;
  @IsOptional() @IsNumber() monthlyAccrual?: number;
  @IsOptional() @IsBoolean() carryForward?: boolean;
  @IsOptional() @IsBoolean() requiresApproval?: boolean;
}

export class MarkStaffAttendanceDto {
  @IsDateString() date!: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StaffAttRowDto)
  rows!: StaffAttRowDto[];
}

export class StaffAttRowDto {
  @IsUUID() staffId!: string;
  @IsString() status!: string;
  @IsOptional() @IsString() remark?: string;
}

export class CreatePayrollDto {
  @IsString() periodMonth!: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsUUID() employeeTypeId?: string;
}

export class PayLineDto {
  @IsArray() @IsUUID('4', { each: true }) lineIds!: string[];
  @IsString() paymentMode!: string;
  @IsOptional() @IsString() paymentRef?: string;
}

export class LoanDto {
  @IsUUID() staffId!: string;
  @IsString() loanType!: string;
  @IsInt() principalPaise!: number;
  @IsDateString() startDate!: string;
  @IsInt() tenureMonths!: number;
  @IsInt() installmentPaise!: number;
}

export class ReimbursementDto {
  @IsUUID() staffId!: string;
  @IsString() category!: string;
  @IsInt() amountPaise!: number;
  @IsDateString() expenseDate!: string;
  @IsOptional() @IsString() description?: string;
}

export class ExitDto {
  @IsUUID() staffId!: string;
  @IsString() kind!: string;
  @IsOptional() @IsDateString() resignationDate?: string;
  @IsOptional() @IsDateString() lastWorkingDate?: string;
  @IsOptional() @IsString() reason?: string;
}

export class ImportEmployeeRowDto {
  @IsString() fullName!: string;
  @IsOptional() @IsString() employeeCode?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsString() staffType?: string;
  @IsOptional() @IsString() departmentCode?: string;
  @IsOptional() @IsString() designationCode?: string;
  @IsOptional() @IsString() employeeTypeCode?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsDateString() joiningDate?: string;
}

export class ImportEmployeesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportEmployeeRowDto)
  rows!: ImportEmployeeRowDto[];
}

export class SaveHrSettingsDto {
  @IsOptional() @IsString() employeeCodePrefix?: string;
  @IsOptional() @IsString() lopDivisor?: string;
  @IsOptional() @IsInt() customDivisor?: number;
  @IsOptional() @IsString() periodMode?: string;
  @IsOptional() @IsBoolean() requireAttendance?: boolean;
}

export class StatutoryRuleDto {
  @IsString() code!: string;
  @IsString() name!: string;
  @IsInt() rateBps!: number;
  @IsOptional() @IsInt() ceilingPaise?: number;
  @IsDateString() effectiveFrom!: string;
  @IsOptional() @IsString() formula?: string;
}
