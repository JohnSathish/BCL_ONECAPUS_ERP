import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

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
  @IsUUID()
  teachingDepartmentId?: string | null;

  @IsOptional()
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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  periodNo?: number | null;

  @IsOptional()
  @IsString()
  startTime?: string | null;

  @IsOptional()
  @IsString()
  endTime?: string | null;

  @IsOptional()
  @IsUUID()
  planId?: string | null;

  @IsOptional()
  @IsUUID()
  timetablePlanEntryId?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsUUID()
  academicYearId?: string | null;
}
