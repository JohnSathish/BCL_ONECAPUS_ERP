import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ACADEMIC_CALENDAR_EVENT_TYPES } from '../academic-calendar.types';

export class EnsureCalendarDto {
  @IsUUID()
  academicYearId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsArray()
  weekendDays?: number[];
}

export class UpdateCalendarDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsArray()
  weekendDays?: number[];
}

export class CreateCalendarEventDto {
  @IsIn([...ACADEMIC_CALENDAR_EVENT_TYPES])
  type!: string;

  @IsString()
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsOptional()
  @IsBoolean()
  isWorkingDay?: boolean | null;

  @IsOptional()
  @IsBoolean()
  createsAttendanceSession?: boolean;

  @IsOptional()
  @IsString()
  scopeType?: string;

  @IsOptional()
  @IsUUID()
  campusId?: string;

  @IsOptional()
  @IsArray()
  departmentIds?: string[];

  @IsOptional()
  @IsIn(['INTERNAL', 'PUBLIC'])
  visibility?: string;

  @IsOptional()
  @IsBoolean()
  publishedToWebsite?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateCalendarEventDto {
  @IsOptional()
  @IsIn([...ACADEMIC_CALENDAR_EVENT_TYPES])
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  startTime?: string | null;

  @IsOptional()
  @IsString()
  endTime?: string | null;

  @IsOptional()
  @IsBoolean()
  isWorkingDay?: boolean | null;

  @IsOptional()
  @IsBoolean()
  createsAttendanceSession?: boolean;

  @IsOptional()
  @IsString()
  scopeType?: string;

  @IsOptional()
  @IsUUID()
  campusId?: string | null;

  @IsOptional()
  @IsArray()
  departmentIds?: string[] | null;

  @IsOptional()
  @IsIn(['INTERNAL', 'PUBLIC'])
  visibility?: string;

  @IsOptional()
  @IsBoolean()
  publishedToWebsite?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class BulkHolidayItemDto {
  @IsString()
  @MaxLength(300)
  title!: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsIn([...ACADEMIC_CALENDAR_EVENT_TYPES])
  type?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsIn(['INTERNAL', 'PUBLIC'])
  visibility?: string;

  @IsOptional()
  @IsBoolean()
  publishedToWebsite?: boolean;

  @IsOptional()
  @IsString()
  scopeType?: string;

  @IsOptional()
  @IsUUID()
  campusId?: string;

  @IsOptional()
  @IsArray()
  departmentIds?: string[];
}

export class BulkHolidaysDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkHolidayItemDto)
  items!: BulkHolidayItemDto[];
}

export class ResolveQueryDto {
  @IsDateString()
  date!: string;

  @IsOptional()
  @IsUUID()
  campusId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  calendarId?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;
}

export class RangeQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsUUID()
  campusId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  calendarId?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;
}
