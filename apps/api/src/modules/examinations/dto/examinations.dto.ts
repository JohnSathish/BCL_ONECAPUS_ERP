import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class ExamQueryDto {
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class ExamSessionDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @IsString()
  examType?: string;

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
  status?: string;

  @IsOptional()
  @IsString()
  instructions?: string;
}

export class ExamPaperDto {
  @IsUUID()
  sessionId!: string;

  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsUUID()
  offeringId?: string;

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
  @Type(() => Number)
  @IsInt()
  semesterNo?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedCount?: number;

  @IsOptional()
  @IsString()
  status?: string;
}

export class AllocateRoomsDto {
  @IsOptional()
  @IsArray()
  roomIds?: string[];
}

export class GenerateSeatingDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  count?: number;
}

export class InvigilatorDto {
  @IsUUID()
  classroomId!: string;

  @IsUUID()
  staffProfileId!: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class ExamMarkEntryDto {
  @IsUUID()
  studentId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  internalMarks?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  externalMarks?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  practicalMarks?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  graceMarks?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxMarks?: number;

  @IsOptional()
  @IsString()
  resultStatus?: string;

  @IsOptional()
  @IsString()
  entryStatus?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class SaveExamMarksDto {
  @IsArray()
  entries!: ExamMarkEntryDto[];
}
