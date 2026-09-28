import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  QUESTION_BANK_DOWNLOAD_MODES,
  QUESTION_BANK_MASTER_KINDS,
  QUESTION_PAPER_MAX_PAGE_SIZE,
  QUESTION_PAPER_SORTS,
  QUESTION_PAPER_STATUSES,
} from './website-question-bank.constants';

const emptyToNull = ({ value }: { value: unknown }) =>
  value === '' || value === 'null' ? null : value;

const toOptionalInt = ({ value }: { value: unknown }) => {
  if (value === undefined) return undefined;
  if (value === '' || value === null || value === 'null') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : value;
};

const toOptionalBool = ({ value }: { value: unknown }) => {
  if (value === 'true' || value === true || value === '1') return true;
  if (value === 'false' || value === false || value === '0') return false;
  return value;
};

class QuestionPaperFilterFields {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  @Max(12)
  semester?: number;

  @IsOptional()
  @IsUUID()
  programmeId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  majorId?: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  subjectCode?: string;

  @IsOptional()
  @IsUUID()
  examTypeId?: string;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1990)
  @Max(2100)
  examYear?: number;

  @IsOptional()
  @IsIn([...QUESTION_PAPER_SORTS])
  sort?: string;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  @Max(QUESTION_PAPER_MAX_PAGE_SIZE)
  limit?: number;
}

export class PublicQuestionPaperQueryDto extends QuestionPaperFilterFields {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  tenant?: string;
}

export class AdminQuestionPaperQueryDto extends QuestionPaperFilterFields {
  @IsOptional()
  @IsIn([...QUESTION_PAPER_STATUSES])
  status?: string;
}

export class PublicTenantQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  tenant?: string;
}

export class QuestionPaperFileQueryDto extends PublicTenantQueryDto {
  @IsOptional()
  @IsIn(['1', '0', 'true', 'false'])
  download?: string;
}

export class UpsertQuestionPaperDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, v) => v != null)
  @IsUUID()
  academicYearId?: string | null;

  @IsOptional()
  @Transform(toOptionalInt)
  @ValidateIf((_, v) => v != null)
  @IsInt()
  @Min(1)
  @Max(12)
  semester?: number | null;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, v) => v != null)
  @IsUUID()
  programmeId?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, v) => v != null)
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, v) => v != null)
  @IsUUID()
  majorId?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, v) => v != null)
  @IsUUID()
  subjectId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  subjectName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  subjectCode?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, v) => v != null)
  @IsUUID()
  examTypeId?: string | null;

  @IsOptional()
  @Transform(toOptionalInt)
  @ValidateIf((_, v) => v != null)
  @IsInt()
  @Min(1990)
  @Max(2100)
  examYear?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, v) => v != null)
  @IsISO8601()
  publishedAt?: string | null;

  @IsOptional()
  @IsIn([...QUESTION_PAPER_STATUSES])
  status?: string;
}

export class UpdateQuestionPaperStatusDto {
  @IsIn([...QUESTION_PAPER_STATUSES])
  status!: string;
}

export class QuestionBankMasterQueryDto {
  @IsOptional()
  @IsIn([...QUESTION_BANK_MASTER_KINDS])
  kind?: string;
}

export class CreateQuestionBankMasterDto {
  @IsIn([...QUESTION_BANK_MASTER_KINDS])
  kind!: string;

  @IsString()
  @MaxLength(160)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, v) => v != null)
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;

  @IsOptional()
  @Transform(toOptionalBool)
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateQuestionBankMasterDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, v) => v != null)
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;

  @IsOptional()
  @Transform(toOptionalBool)
  @IsBoolean()
  isActive?: boolean;
}

export class QuestionBankSettingsDto {
  @IsOptional()
  @IsIn([...QUESTION_BANK_DOWNLOAD_MODES])
  downloadMode?: string;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  @Max(500)
  maxUploadMb?: number;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(5)
  @Max(QUESTION_PAPER_MAX_PAGE_SIZE)
  pageSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  intro?: string;
}
