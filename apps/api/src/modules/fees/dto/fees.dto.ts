import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FeeComponentDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsString()
  category!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  billingFrequency?: string;

  @IsOptional()
  @IsArray()
  semesterNumbers?: number[];

  @IsOptional()
  @IsArray()
  subjectCategories?: string[];

  @IsOptional()
  @IsBoolean()
  practicalDependency?: boolean;

  @IsOptional()
  @IsNumber()
  priority?: number;
}

export class CreateFeeStructureDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  billingFrequency?: string;

  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsUUID()
  semesterId?: string;

  @IsOptional()
  @IsUUID()
  streamId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  programVersionId?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FeeComponentDto)
  components?: FeeComponentDto[];
}

export class FeeStructureQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsUUID()
  programVersionId?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;
}

export class DemandScopeDto {
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsArray()
  studentIds?: string[];

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsUUID()
  semesterId?: string;

  @IsOptional()
  @IsNumber()
  semesterNumber?: number;

  @IsOptional()
  @IsUUID()
  programVersionId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  streamId?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @IsString()
  billingLayer?: string;

  @IsOptional()
  @IsString()
  billingPeriod?: string;

  @IsOptional()
  @IsString()
  demandType?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class GenerateDemandDto extends DemandScopeDto {
  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}

export class PublishDemandDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CollectionDto {
  @IsUUID()
  studentId!: string;

  @IsOptional()
  @IsArray()
  demandIds?: string[];

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsString()
  paymentMode!: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class GatewayPaymentDto {
  @IsUUID()
  studentId!: string;

  @IsOptional()
  @IsArray()
  demandIds?: string[];

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsIn(['RAZORPAY', 'CASHFREE', 'PAYU', 'CUSTOM'])
  provider!: string;
}

export class ConcessionDto {
  @IsUUID()
  studentId!: string;

  @IsOptional()
  @IsUUID()
  demandId?: string;

  @IsString()
  concessionType!: string;

  @IsIn(['FIXED', 'PERCENTAGE', 'FULL_WAIVER'])
  calculationType!: string;

  @IsNumber()
  @Min(0)
  value!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class FineRuleDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsString()
  ruleType!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsNumber()
  graceDays?: number;
}

export class ReportsQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsUUID()
  programVersionId?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;
}
