import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

function toStringArray(value: unknown): string[] | undefined {
  if (value == null || value === '') return undefined;
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      /* comma-separated */
    }
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return undefined;
}

export const EXAMINATION_TYPES = [
  'UNIVERSITY_EXAM',
  'INTERNAL',
  'MID_SEM',
  'MODEL',
  'PRACTICAL',
  'SUPPLEMENTARY',
  'REVALUATION',
] as const;

export const EXAM_CYCLES = ['ODD', 'EVEN'] as const;

export const SUBJECT_CATEGORIES = [
  'MAJOR',
  'MINOR',
  'MDC',
  'AEC',
  'SEC',
  'VAC',
  'VTC',
  'PRACTICAL',
] as const;

export const LANGUAGES = ['EN', 'HI', 'GARO', 'KHASI', 'BILINGUAL'] as const;

export const PAPER_TYPES = [
  'THEORY',
  'THEORY_PRACTICAL',
  'PRACTICAL',
  'UNIVERSITY_EXAM',
  'END_SEMESTER',
  'MID_SEMESTER',
  'INTERNAL',
  'SUPPLEMENTARY',
] as const;

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
  @IsString()
  examinationType?: string;

  @IsOptional()
  @IsString()
  examCycle?: string;

  @IsOptional()
  @IsString()
  subjectCategory?: string;

  @IsOptional()
  @IsString()
  language?: string;

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
  @IsIn([...EXAMINATION_TYPES])
  examinationType?: string;

  @IsOptional()
  @IsIn([...EXAM_CYCLES])
  examCycle?: string;

  @IsOptional()
  @IsIn([...SUBJECT_CATEGORIES])
  subjectCategory?: string;

  @IsOptional()
  @IsIn([...LANGUAGES])
  language?: string;

  @IsOptional()
  @IsString()
  universityName?: string;

  @IsOptional()
  @IsUUID()
  preparedById?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === 'null' || value == null ? null : value,
  )
  @ValidateIf((_, v) => v != null)
  @IsUUID()
  verifiedById?: string | null;

  @IsOptional()
  @IsString()
  notes?: string;

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
  @Transform(({ value }) => toStringArray(value))
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
  @IsIn([...EXAMINATION_TYPES])
  examinationType?: string;

  @IsOptional()
  @IsIn([...EXAM_CYCLES])
  examCycle?: string;

  @IsOptional()
  @IsIn([...SUBJECT_CATEGORIES])
  subjectCategory?: string;

  @IsOptional()
  @IsIn([...LANGUAGES])
  language?: string;

  @IsOptional()
  @IsString()
  universityName?: string;

  @IsOptional()
  @IsUUID()
  preparedById?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === 'null' || value == null ? null : value,
  )
  @ValidateIf((_, v) => v != null)
  @IsUUID()
  verifiedById?: string | null;

  @IsOptional()
  @IsString()
  notes?: string;

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
  @Transform(({ value }) => toStringArray(value))
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

export class CreateShareLinkDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  expiresInDays?: number;
}

export class AddPaperVersionDto {
  @IsOptional()
  @IsString()
  changeNote?: string;
}

export class CurriculumCoursesQueryDto {
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  programVersionId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  semesterNo?: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  q?: string;
}
