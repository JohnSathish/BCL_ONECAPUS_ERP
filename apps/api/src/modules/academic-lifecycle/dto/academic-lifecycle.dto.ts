import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class UpsertInstitutionAcademicConfigDto {
  @IsOptional()
  @IsString()
  programmeModel?: string;

  @IsOptional()
  @IsString()
  structureType?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  maxActiveSemesters?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  operationalYears?: number;

  @IsOptional()
  @IsString()
  semesterPattern?: string;

  @IsOptional()
  @IsString()
  promotionTrigger?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  terminalSemesterNumber?: number;

  @IsOptional()
  @IsBoolean()
  allowPostgraduateContinuation?: boolean;
}

export class ProvisionFyugpDto {
  @IsOptional()
  @IsString()
  baseYearName?: string;

  @IsOptional()
  @Type(() => Date)
  startDate?: Date;
}

export class ActivateSemesterDto {
  @IsUUID()
  campusId!: string;

  @IsUUID()
  shiftId!: string;

  @IsOptional()
  @IsBoolean()
  runPromotion?: boolean;
}

export class PromotionPreviewQueryDto {
  @IsUUID()
  institutionId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  fromSequence!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  toSequence!: number;

  @IsOptional()
  @IsUUID()
  campusId?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  programVersionId?: string;

  @IsOptional()
  @IsUUID()
  admissionBatchId?: string;
}

export class PromotionMappingPreviewQueryDto extends PromotionPreviewQueryDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  studentIds?: string[];
}

export class PromotionValidateQueryDto extends PromotionPreviewQueryDto {}

export class CreatePromotionRunDto {
  @IsUUID()
  institutionId!: string;

  @IsInt()
  fromSequence!: number;

  @IsInt()
  toSequence!: number;

  @IsOptional()
  @IsUUID()
  campusId?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @IsUUID()
  fromSemesterId?: string;

  @IsOptional()
  @IsString()
  trigger?: string;

  @IsOptional()
  @IsUUID()
  admissionBatchId?: string;

  @IsOptional()
  @IsUUID()
  cycleRolloverGroupId?: string;
}

export class ActivateCycleDto {
  @IsOptional()
  @IsUUID()
  campusId?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;
}

export class CreateAcademicSessionDto {
  @IsString()
  name!: string;

  @Type(() => Date)
  startDate!: Date;

  @Type(() => Date)
  endDate!: Date;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsInt()
  academicYearIndex?: number;

  @IsOptional()
  @IsBoolean()
  isPrimarySession?: boolean;
}

export class UpdateAcademicSessionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Type(() => Date)
  startDate?: Date;

  @IsOptional()
  @Type(() => Date)
  endDate?: Date;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsInt()
  academicYearIndex?: number;

  @IsOptional()
  @IsBoolean()
  isPrimarySession?: boolean;
}

export class CreateAdmissionBatchDto {
  @IsString()
  batchCode!: string;

  @IsInt()
  admissionYear!: number;

  @IsUUID()
  entrySessionId!: string;

  @IsInt()
  @Min(1)
  @Max(6)
  currentSemester!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateAdmissionBatchDto {
  @IsOptional()
  @IsString()
  batchCode?: string;

  @IsOptional()
  @IsInt()
  admissionYear?: number;

  @IsOptional()
  @IsUUID()
  entrySessionId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  currentSemester?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  promotionStatus?: string;
}

export class CycleRolloverRollbackDto {
  @IsOptional()
  @IsUUID()
  cycleRolloverGroupId?: string;
}

export class IndividualPromotionDto {
  @IsString()
  action!: 'promote' | 'detain';

  @IsOptional()
  @IsInt()
  toSequence?: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
