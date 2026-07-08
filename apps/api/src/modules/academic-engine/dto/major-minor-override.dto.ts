import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

const OVERRIDE_STATUS = ['DRAFT', 'APPROVED', 'REVOKED'] as const;
const APPROVAL_AUTHORITIES = ['PRINCIPAL', 'SUPER_ADMIN'] as const;

export class CreateStudentMajorMinorOverrideDto {
  @IsUUID()
  majorSubjectId!: string;

  @IsUUID()
  minorSubjectId!: string;

  @IsOptional()
  @IsUUID()
  programVersionId?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  effectiveFromSemester?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  effectiveToSemester?: number;

  @IsString()
  @MinLength(5)
  reason!: string;

  @IsIn(APPROVAL_AUTHORITIES)
  approvalAuthority!: (typeof APPROVAL_AUTHORITIES)[number];

  @IsOptional()
  @IsString()
  approvalRef?: string;

  @IsOptional()
  @IsString()
  supportingDocumentUrl?: string;

  @IsOptional()
  @IsIn(OVERRIDE_STATUS)
  status?: (typeof OVERRIDE_STATUS)[number];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ListStudentMajorMinorOverridesQueryDto {
  @IsOptional()
  @IsIn(OVERRIDE_STATUS)
  status?: (typeof OVERRIDE_STATUS)[number];
}

export class ResolveStudentMajorMinorOverrideQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  semesterSequence!: number;

  @IsOptional()
  @IsUUID()
  programVersionId?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;
}

export class RevokeStudentMajorMinorOverrideDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}
