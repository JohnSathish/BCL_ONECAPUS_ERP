import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  FEEDBACK_AUDIENCES,
  FEEDBACK_CATEGORIES,
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

export class UpsertFeedbackQuestionDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  prompt!: string;

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

  /** Currently LIKERT_5 only (Excellent … Poor). */
  @IsOptional()
  @IsIn(['LIKERT_5'])
  questionType?: string;
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

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;
}

export class SubmitFeedbackResponseDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FeedbackAnswerInputDto)
  answers!: FeedbackAnswerInputDto[];
}
