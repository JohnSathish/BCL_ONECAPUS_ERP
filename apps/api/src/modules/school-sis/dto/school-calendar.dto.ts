import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class SaveWeeklyOffDto {
  @IsOptional() @IsArray() weekdays?: number[];
  @IsOptional() @IsString() saturdayRule?: string;
  @IsOptional() customWeeks?: number[];
  @IsOptional() @IsUUID() academicYearId?: string;
}

export class SaveAcademicTermDto {
  @IsString() @MaxLength(80) name!: string;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
}

export class SaveTermsDto {
  @IsOptional() @IsUUID() academicYearId?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveAcademicTermDto)
  terms!: SaveAcademicTermDto[];
}

export class SaveHolidayTypeDto {
  @IsString() @MaxLength(80) name!: string;
  @IsString() @MaxLength(20) code!: string;
  @IsOptional() @IsString() kind?: string;
}

export class SaveHolidayDto {
  @IsString() @MaxLength(160) name!: string;
  @IsUUID() typeId!: string;
  @IsDateString() startDate!: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsString() appliesTo?: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) gradeIds?: string[];
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) sectionIds?: string[];
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() recurring?: boolean;
  @IsOptional() @IsString() recurringRule?: string;
  @IsOptional() @IsBoolean() overrideConflict?: boolean;
  @IsOptional() @IsUUID() academicYearId?: string;
}

export class ImportHolidayRowDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() startDate?: string;
  @IsOptional() @IsString() endDate?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() appliesTo?: string;
  @IsOptional() @IsString() description?: string;
}

export class ImportHolidaysDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportHolidayRowDto)
  rows!: ImportHolidayRowDto[];
  @IsOptional() @IsBoolean() confirm?: boolean;
  @IsOptional() @IsUUID() academicYearId?: string;
}

export class SaveOverrideDto {
  @IsDateString() date!: string;
  @IsOptional() @IsString() kind?: string;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsUUID() academicYearId?: string;
}

export class SaveCalendarEventDto {
  @IsString() @MaxLength(200) title!: string;
  @IsUUID() categoryId!: string;
  @IsDateString() startDate!: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsString() startTime?: string;
  @IsOptional() @IsString() endTime?: string;
  @IsOptional() @IsBoolean() allDay?: boolean;
  @IsOptional() @IsString() description?: string;
  @IsOptional() audience?: string[];
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) gradeIds?: string[];
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) sectionIds?: string[];
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() organizerType?: string;
  @IsOptional() @IsUUID() organizerStaffId?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsBoolean() importantParents?: boolean;
  @IsOptional() @IsBoolean() importantStudents?: boolean;
  @IsOptional() @IsBoolean() importantTeachers?: boolean;
  @IsOptional() @IsBoolean() notifyParents?: boolean;
  @IsOptional() @IsBoolean() notifyStudents?: boolean;
  @IsOptional() @IsBoolean() notifyTeachers?: boolean;
  @IsOptional() ptm?: Record<string, unknown>;
  @IsOptional() @IsBoolean() overrideConflict?: boolean;
  @IsOptional() @IsUUID() academicYearId?: string;
}
