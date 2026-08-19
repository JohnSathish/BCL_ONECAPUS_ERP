import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class ElectiveAllocationQueryDto {
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @IsString()
  semesterMode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8)
  semesterSequence?: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  q?: string;
}

export class AssignElectiveStaffDto {
  @IsUUID()
  courseOfferingId!: string;

  @IsUUID()
  shiftId!: string;

  @IsUUID()
  staffProfileId!: string;

  @IsOptional()
  @IsString()
  sectionCode?: string;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUUID()
  teachingDepartmentId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUUID()
  classroomId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  capacity?: number | null;

  @IsOptional()
  workloadHours?: number | string | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek?: number | null;

  /** Repeat the same period on these weekdays (1=Mon … 6=Sat). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  daysOfWeek?: number[];

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  periodNo?: number | null;

  /** Saturday can use a different period (Day Shift VTC: P4 weekdays, P2 Saturday). */
  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  saturdayPeriodNo?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsString()
  startTime?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsString()
  endTime?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUUID()
  planId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUUID()
  timetablePlanEntryId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsString()
  notes?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUUID()
  academicYearId?: string | null;
}
