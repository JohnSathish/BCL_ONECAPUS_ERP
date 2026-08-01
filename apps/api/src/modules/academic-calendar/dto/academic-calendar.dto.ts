import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
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

export class VisibilityFlagsDto {
  @IsOptional()
  @IsBoolean()
  students?: boolean;

  @IsOptional()
  @IsBoolean()
  staff?: boolean;

  @IsOptional()
  @IsBoolean()
  parents?: boolean;

  @IsOptional()
  @IsBoolean()
  public?: boolean;
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

  @IsOptional()
  @IsString()
  @MaxLength(32)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  icon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  venue?: string;

  @IsOptional()
  @IsBoolean()
  isAllDay?: boolean;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  recurrenceRule?: string;

  @IsOptional()
  @IsUUID()
  programmeId?: string;

  @IsOptional()
  @IsUUID()
  semesterId?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => VisibilityFlagsDto)
  visibilityFlags?: VisibilityFlagsDto;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  organizerName?: string;
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

  @IsOptional()
  @IsString()
  @MaxLength(32)
  color?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  icon?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  venue?: string | null;

  @IsOptional()
  @IsBoolean()
  isAllDay?: boolean;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  recurrenceRule?: string | null;

  @IsOptional()
  @IsUUID()
  programmeId?: string | null;

  @IsOptional()
  @IsUUID()
  semesterId?: string | null;

  @IsOptional()
  @IsUUID()
  shiftId?: string | null;

  @IsOptional()
  @IsObject()
  visibilityFlags?: VisibilityFlagsDto | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  organizerName?: string | null;
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

export class MonthSummaryQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;
}

export class ListEventsQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  type?: string;

  /** Comma-separated event types */
  @IsOptional()
  @IsString()
  types?: string;

  @IsOptional()
  @IsString()
  visibility?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  expandRecurrence?: boolean;
}
