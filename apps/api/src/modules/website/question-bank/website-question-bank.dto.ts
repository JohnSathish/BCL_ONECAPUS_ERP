import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ENUM_FILTER_PATTERN,
  QUESTION_BANK_DOWNLOAD_MODES,
  QUESTION_PAPER_MAX_PAGE_SIZE,
  QUESTION_PAPER_SORTS,
} from './website-question-bank.constants';

const toOptionalInt = ({ value }: { value: unknown }) => {
  if (value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : value;
};

export class PublicTenantQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  tenant?: string;
}

export class PublicQuestionPaperQueryDto extends PublicTenantQueryDto {
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
  @Matches(ENUM_FILTER_PATTERN)
  category?: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  subjectCode?: string;

  @IsOptional()
  @Matches(ENUM_FILTER_PATTERN)
  examType?: string;

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

export class QuestionPaperFileQueryDto extends PublicTenantQueryDto {
  @IsOptional()
  @IsIn(['1', '0', 'true', 'false'])
  download?: string;
}

export class QuestionBankSettingsDto {
  @IsOptional()
  @IsIn([...QUESTION_BANK_DOWNLOAD_MODES])
  downloadMode?: string;

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
