import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class AttendanceSessionQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  offeringSectionId?: string;

  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsUUID()
  staffProfileId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  semesterNo?: number;

  @IsOptional()
  @IsString()
  status?: string;
}

export class GenerateAttendanceSessionsDto {
  @IsDateString()
  date!: string;

  @IsOptional()
  @IsUUID()
  timetablePlanId?: string;

  @IsOptional()
  @IsUUID()
  offeringSectionId?: string;

  @IsOptional()
  @IsUUID()
  staffProfileId?: string;
}

export class AttendanceEntryDto {
  @IsUUID()
  studentId!: string;

  @IsIn(['P', 'A', 'L', 'OD', 'ML', 'SPORTS', 'NSS', 'NCC', 'EXEMPTED'])
  status!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minutesPresent?: number;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class MarkAttendanceDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceEntryDto)
  entries!: AttendanceEntryDto[];

  @IsOptional()
  @IsString()
  mode?: 'QUICK_PRESENT' | 'ABSENTEES_ONLY' | 'MANUAL';

  @IsOptional()
  @IsBoolean()
  lockAfterSave?: boolean;
}

export class CreateExtraAttendanceSessionDto {
  @IsDateString()
  sessionDate!: string;

  @IsUUID()
  offeringSectionId!: string;

  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsString()
  sessionType?: string;

  @IsOptional()
  @IsString()
  labBatch?: string;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;
}

export class AttendanceCorrectionDto {
  @IsString()
  reason!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceEntryDto)
  entries!: AttendanceEntryDto[];
}

export class AttendanceEligibilityQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  semesterNo?: number;

  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;
}
