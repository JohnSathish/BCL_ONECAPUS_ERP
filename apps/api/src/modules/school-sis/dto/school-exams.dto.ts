import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class SaveSchoolExamSettingsDto {
  @IsOptional() @IsNumber() passPercent?: number;
  @IsOptional() @IsBoolean() rankingEnabled?: boolean;
  @IsOptional() @IsString() rankingMethod?: string;
  @IsOptional() @IsString() rankingTie?: string;
  @IsOptional() @IsBoolean() graceEnabled?: boolean;
  @IsOptional() @IsInt() graceMax?: number;
  @IsOptional() @IsInt() decimalPlaces?: number;
  @IsOptional() @IsString() rounding?: string;
  @IsOptional() @IsString() absentCode?: string;
  @IsOptional() @IsString() medicalCode?: string;
  @IsOptional() @IsString() notAppearedCode?: string;
  @IsOptional() @IsNumber() attendanceMinPercent?: number;
  @IsOptional() @IsBoolean() attendanceAffectsResult?: boolean;
  @IsOptional() @IsBoolean() requirePassEverySubject?: boolean;
  @IsOptional() @IsInt() maxFailedSubjects?: number;
  @IsOptional() @IsBoolean() requireTheoryPass?: boolean;
  @IsOptional() @IsBoolean() approvalWorkflow?: boolean;
  @IsOptional() @IsBoolean() allowNegativeMarks?: boolean;
  @IsOptional() @IsUUID() defaultGradeSystemId?: string;
  @IsOptional() @IsString() reportTemplate?: string;
  @IsOptional() @IsBoolean() showRankOnCard?: boolean;
  @IsOptional() @IsBoolean() showPhotoOnCard?: boolean;
  @IsOptional() remarkBands?: unknown;
}

export class SaveSchoolExamTypeDto {
  @IsString() @MaxLength(80) name!: string;
  @IsString() @MaxLength(20) code!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() defaultWeight?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class SaveSchoolExamDto {
  @IsString() @MaxLength(160) name!: string;
  @IsUUID() typeId!: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) gradeIds?: string[];
  @IsOptional() settingsOverride?: Record<string, unknown>;
  @IsOptional() @IsDateString() marksDeadline?: string;
}

export class SaveExamSubjectDto {
  @IsUUID() gradeId!: string;
  @IsUUID() subjectId!: string;
  @IsOptional() @IsNumber() maxTotal?: number;
  @IsOptional() @IsNumber() passTotal?: number;
  @IsOptional() @IsNumber() weightage?: number;
  @IsOptional() @IsBoolean() requireTheoryPass?: boolean;
  @IsOptional() @IsNumber() theoryMax?: number;
  @IsOptional() @IsNumber() theoryPass?: number;
}

export class SaveExamComponentDto {
  @IsString() name!: string;
  @IsString() code!: string;
  @IsNumber() @Min(0) maxMarks!: number;
  @IsOptional() @IsNumber() passMarks?: number;
  @IsOptional() @IsNumber() weightage?: number;
  @IsOptional() @IsInt() sortOrder?: number;
}

export class SaveExamScheduleDto {
  @IsUUID() examId!: string;
  @IsUUID() sectionId!: string;
  @IsUUID() subjectId!: string;
  @IsDateString() examDate!: string;
  @IsString() startTime!: string;
  @IsString() endTime!: string;
  @IsOptional() @IsInt() durationMin?: number;
  @IsOptional() @IsString() room?: string;
  @IsOptional() @IsNumber() maxMarks?: number;
  @IsOptional() @IsString() instructions?: string;
  @IsOptional() @IsUUID() invigilatorId?: string;
  @IsOptional() @IsBoolean() overrideConflict?: boolean;
}

export class ExamMarkRowDto {
  @IsUUID() studentId!: string;
  @IsOptional() @IsNumber() marks?: number | null;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() remarks?: string;
}

export class SaveExamMarksDto {
  @IsUUID() examId!: string;
  @IsUUID() componentId!: string;
  @IsOptional() @IsBoolean() submit?: boolean;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExamMarkRowDto)
  rows!: ExamMarkRowDto[];
}

export class ReopenMarksDto {
  @IsUUID() examId!: string;
  @IsUUID() componentId!: string;
  @IsOptional() @IsString() reason?: string;
}

export class SaveGradeSystemDto {
  @IsString() name!: string;
  @IsOptional() @IsString() kind?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsArray() bands?: Array<{
    code: string;
    label: string;
    minPercent: number;
    maxPercent: number;
    gradePoint?: number;
    description?: string;
  }>;
}

export class GenerateResultsDto {
  @IsUUID() examId!: string;
  @IsOptional() @IsUUID() sectionId?: string;
}

export class PublishResultDto {
  @IsUUID() examId!: string;
  @IsOptional() @IsString() reason?: string;
}
