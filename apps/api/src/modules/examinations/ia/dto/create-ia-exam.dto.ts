import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IA_EXAM_TYPES } from '../ia.constants';

export class CreateIaExamDto {
  @IsString()
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  semesterNo!: number;

  @IsUUID()
  programVersionId!: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsIn([...IA_EXAM_TYPES])
  examType!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  maxMarks!: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class GenerateIaTimetableDto {
  @IsUUID()
  sessionId!: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(480)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  defaultStartTime?: string;
}
