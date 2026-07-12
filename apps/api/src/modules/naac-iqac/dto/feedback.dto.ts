import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  FEEDBACK_AUDIENCES,
  FEEDBACK_CATEGORIES,
  FEEDBACK_QUESTION_TYPES,
} from '../constants/feedback.constants';

export class CreateFeedbackCampaignDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instructions?: string;

  @IsOptional()
  @IsIn([...FEEDBACK_AUDIENCES])
  audience?: string;

  @IsString()
  @MinLength(4)
  @MaxLength(20)
  academicYear!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;
}

export class UpdateFeedbackCampaignDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instructions?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  academicYear?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED', 'CLOSED'])
  status?: string;

  @IsOptional()
  @IsIn([...FEEDBACK_AUDIENCES])
  audience?: string;
}

export class FeedbackOptionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  value!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  label!: string;
}

export class UpsertFeedbackQuestionDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  prompt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  helpText?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  placeholder?: string | null;

  @IsOptional()
  defaultValue?: unknown;

  @IsOptional()
  @IsIn([...FEEDBACK_CATEGORIES])
  category?: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsIn([...FEEDBACK_QUESTION_TYPES])
  questionType?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeedbackOptionDto)
  options?: FeedbackOptionDto[];

  @IsOptional()
  @IsObject()
  validation?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  conditionalLogic?: Record<string, unknown>;
}

export class ReplaceFeedbackQuestionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpsertFeedbackQuestionDto)
  questions!: UpsertFeedbackQuestionDto[];
}

export class FeedbackAnswerInputDto {
  @IsUUID()
  questionId!: string;

  /** Likert / rating (1–N) */
  @IsOptional()
  @IsInt()
  @Min(1)
  rating?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  valueText?: string;

  @IsOptional()
  @IsNumber()
  valueNumber?: number;

  @IsOptional()
  @IsBoolean()
  valueBool?: boolean;

  @IsOptional()
  @IsString()
  valueDate?: string;

  /** multi_choice array, file metadata, or single choice value wrapper */
  @IsOptional()
  valueJson?: unknown;
}

export class SubmitFeedbackResponseDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FeedbackAnswerInputDto)
  answers!: FeedbackAnswerInputDto[];
}
