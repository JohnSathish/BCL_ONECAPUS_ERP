import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class QuestionPaperQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  programVersionId?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  semesterNo?: number;

  @IsOptional()
  @IsString()
  paperType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  examYear?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  examMonth?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  uploadedById?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class CreateQuestionPaperDto {
  @IsString()
  paperCode!: string;

  @IsString()
  paperName!: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsUUID()
  programVersionId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  semesterNo?: number;

  @IsOptional()
  @IsString()
  examinationSession?: string;

  @IsString()
  paperType!: string;

  @IsOptional()
  @IsString()
  paperCategory?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  examMonth?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  examYear?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  durationMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxMarks?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];
}

export class UpdateQuestionPaperDto {
  @IsOptional()
  @IsString()
  paperCode?: string;

  @IsOptional()
  @IsString()
  paperName?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsUUID()
  programVersionId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  semesterNo?: number;

  @IsOptional()
  @IsString()
  examinationSession?: string;

  @IsOptional()
  @IsString()
  paperType?: string;

  @IsOptional()
  @IsString()
  paperCategory?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  examMonth?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  examYear?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  durationMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxMarks?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];
}

export class QuestionPaperApprovalDto {
  @IsIn(['APPROVE', 'REJECT'])
  action!: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  comments?: string;
}

export class QuestionBankSettingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  maxUploadMb?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedMimeTypes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedPaperTypes?: string[];

  @IsOptional()
  studentAccessEnabled?: boolean;
}

export class BulkCommitDto {
  @IsArray()
  rows!: Record<string, unknown>[];
}
