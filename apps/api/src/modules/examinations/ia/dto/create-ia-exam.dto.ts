import {
  ArrayMinSize,
  IsArray,
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

  /** @deprecated Use semesterNos — kept for backward compatibility */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  semesterNo?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(12, { each: true })
  semesterNos?: number[];

  @IsOptional()
  @IsUUID()
  programVersionId?: string;

  /** Omit or null = all streams */
  @IsOptional()
  @IsUUID()
  streamId?: string;

  /** Empty = all departments in selected stream */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  departmentIds?: string[];

  /** @deprecated Use departmentIds */
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

export class PreviewIaExamDto extends CreateIaExamDto {}

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
