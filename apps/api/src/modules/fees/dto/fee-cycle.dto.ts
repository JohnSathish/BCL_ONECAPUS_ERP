import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class FeeHeadQueryDto {
  @IsOptional()
  @IsBoolean()
  activeOnly?: boolean;
}

export class CreateFeeHeadDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateFeeHeadDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ReorderFeeHeadsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  orderedIds!: string[];
}

export class FeeCycleLineDto {
  @IsUUID()
  feeHeadId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class FeeCycleQueryDto {
  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'INACTIVE'])
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  startSemester?: number;

  @IsOptional()
  @IsUUID()
  programId?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;
}

export class CreateFeeCycleDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsUUID()
  programId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  fyugpYear?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  startSemester!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  endSemester!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalAmount!: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'INACTIVE'])
  status?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeeCycleLineDto)
  lines?: FeeCycleLineDto[];
}

export class UpdateFeeCycleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsUUID()
  programId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  fyugpYear?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  startSemester?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  endSemester?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  totalAmount?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'INACTIVE'])
  status?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeeCycleLineDto)
  lines?: FeeCycleLineDto[];
}

export class GenerateCycleDemandDto {
  @IsUUID()
  studentId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  semesterNumber?: number;

  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}

export class BulkGenerateCycleDemandDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  studentIds?: string[];

  @Type(() => Number)
  @IsInt()
  semesterNumber!: number;

  @IsOptional()
  @IsUUID()
  programId?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}
