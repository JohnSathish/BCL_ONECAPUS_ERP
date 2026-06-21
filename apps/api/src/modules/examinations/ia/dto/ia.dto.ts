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
import { IA_EXAM_TYPES } from '../ia.constants';

export class IaQueryDto {
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  semesterNo?: number;

  @IsOptional()
  @IsString()
  status?: string;
}

export class IaSettingsDto {
  @IsOptional()
  @IsBoolean()
  legacyUniversityExamMode?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  iaPassMarkPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  attendanceMinPercent?: number;

  @IsOptional()
  @IsBoolean()
  blockAdmitOnDefaulter?: boolean;
}

export class IaComponentDto {
  @IsString()
  code!: string;

  @IsString()
  label!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxMarks!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  weightage?: number;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class IaSchemeDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  programmeId?: string;

  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsUUID()
  offeringId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  semesterNo?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  totalMaxMarks?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  passMark?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IaComponentDto)
  components?: IaComponentDto[];
}

export class IaSessionDto {
  @IsString()
  name!: string;

  @IsIn([...IA_EXAM_TYPES])
  examType!: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  semesterNo?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  instructions?: string;
}

export class IaPaperDto {
  @IsUUID()
  sessionId!: string;

  @IsString()
  paperCode!: string;

  @IsString()
  paperName!: string;

  @IsDateString()
  examDate!: string;

  @IsString()
  startTime!: string;

  @IsString()
  endTime!: string;

  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsUUID()
  offeringId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  semesterNo?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxMarks?: number;
}

export class IaMarkRowDto {
  @IsUUID()
  studentId!: string;

  @IsUUID()
  componentId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  marks?: number;

  @IsOptional()
  @IsBoolean()
  isAbsent?: boolean;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class SaveIaMarksDto {
  @IsUUID()
  schemeId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IaMarkRowDto)
  rows!: IaMarkRowDto[];
}

export class IaConsolidationGenerateDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  semesterNo?: number;

  @IsOptional()
  @IsUUID()
  sessionId?: string;
}

export class IaApprovalActionDto {
  @IsIn(['APPROVE', 'REJECT'])
  action!: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  remarks?: string;
}
