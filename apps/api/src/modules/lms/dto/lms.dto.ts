import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  LMS_ANNOUNCEMENT_TYPES,
  LMS_ASSIGNMENT_SUBMISSION_TYPES,
  LMS_LESSON_PLAN_STATUS,
  LMS_MATERIAL_CATEGORIES,
  LMS_MATERIAL_STATUS,
  LMS_MATERIAL_VISIBILITY,
} from '../constants/lms.constants';

export class LmsWorkspaceListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  semesterNo?: number;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  workspaceType?: string;

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

export class UpdateLmsSettingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxUploadMb?: number;

  @IsOptional()
  allowedMimeTypes?: string[];

  @IsOptional()
  @IsBoolean()
  poolWorkspacesEnabled?: boolean;

  @IsOptional()
  @IsIn([...LMS_MATERIAL_VISIBILITY])
  defaultVisibility?: string;

  @IsOptional()
  featureFlags?: Record<string, boolean>;
}

export class CreateLmsMaterialDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn([...LMS_MATERIAL_CATEGORIES])
  category?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsIn([...LMS_MATERIAL_VISIBILITY])
  visibility?: string;

  @IsOptional()
  @IsString()
  externalUrl?: string;
}

export class UpdateLmsMaterialDto extends CreateLmsMaterialDto {
  @IsOptional()
  @IsIn([...LMS_MATERIAL_STATUS])
  status?: string;
}

export class LmsMaterialListQueryDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateLmsAnnouncementDto {
  @IsString()
  title!: string;

  @IsString()
  body!: string;

  @IsOptional()
  @IsIn([...LMS_ANNOUNCEMENT_TYPES])
  type?: string;

  @IsOptional()
  @IsString()
  audience?: string;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @IsOptional()
  @IsUUID()
  workspaceId?: string;
}

export class CreateLmsLessonPlanDto {
  @IsString()
  unit!: string;

  @IsString()
  topic!: string;

  @IsOptional()
  @IsString()
  subtopic?: string;

  @IsOptional()
  @IsString()
  learningOutcomes?: string;

  @IsOptional()
  @Type(() => Number)
  expectedHours?: number;

  @IsOptional()
  @IsString()
  teachingMethod?: string;

  @IsOptional()
  resources?: Record<string, unknown>;

  @IsOptional()
  @IsIn([...LMS_LESSON_PLAN_STATUS])
  status?: string;

  @IsOptional()
  @IsString()
  scheduledDate?: string;

  @IsOptional()
  @IsUUID()
  timetableEntryId?: string;
}

export class UpdateLmsLessonPlanDto extends CreateLmsLessonPlanDto {}

export class LmsSearchQueryDto {
  @IsString()
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class CreateLmsAssignmentDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsIn([...LMS_ASSIGNMENT_SUBMISSION_TYPES])
  submissionType!: string;

  @IsOptional()
  @Type(() => Number)
  maxMarks?: number;

  @IsOptional()
  @IsString()
  dueAt?: string;

  @IsOptional()
  @IsBoolean()
  allowLateSubmission?: boolean;
}

export class UpdateLmsAssignmentDto extends CreateLmsAssignmentDto {}

export class SubmitLmsAssignmentDto {
  @IsOptional()
  @IsString()
  textContent?: string;

  @IsOptional()
  @IsString()
  linkUrl?: string;
}

export class EvaluateLmsSubmissionDto {
  @IsOptional()
  @Type(() => Number)
  marksAwarded?: number;

  @IsOptional()
  @IsString()
  feedbackText?: string;
}

export class ReturnLmsSubmissionDto {
  @IsString()
  feedbackText!: string;
}

export class CreateLmsQuizDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  timeLimitMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxAttempts?: number;

  @IsOptional()
  @Type(() => Number)
  maxMarks?: number;

  @IsOptional()
  @IsBoolean()
  shuffleQuestions?: boolean;

  @IsOptional()
  @IsString()
  dueAt?: string;
}

export class UpdateLmsQuizDto extends CreateLmsQuizDto {}

export class CreateLmsQuizQuestionDto {
  @IsString()
  prompt!: string;

  @IsOptional()
  @IsString()
  questionType?: string;

  @IsOptional()
  options?: string[];

  @IsOptional()
  @IsString()
  correctAnswer?: string;

  @IsOptional()
  @Type(() => Number)
  marks?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class SubmitLmsQuizAttemptDto {
  @IsArray()
  answers!: Array<{ questionId: string; answer: string }>;
}

export class CreateLmsDiscussionDto {
  @IsString()
  title!: string;

  @IsString()
  body!: string;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;
}

export class CreateLmsDiscussionReplyDto {
  @IsString()
  body!: string;
}
