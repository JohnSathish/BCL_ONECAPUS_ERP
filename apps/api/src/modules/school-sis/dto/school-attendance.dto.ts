import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class SaveAttendanceSettingsDto {
  @IsOptional() @IsString() academicYearId?: string;
  @IsOptional() @IsString() mode?: string;
  @IsOptional() @IsString() defaultStatus?: string;
  @IsOptional() @IsString() defaultMarking?: string;
  @IsOptional() @IsBoolean() lockEnabled?: boolean;
  @IsOptional() @IsInt() lockAfterHours?: number;
  @IsOptional() @IsBoolean() correctionRequired?: boolean;
  @IsOptional() @IsInt() minPercent?: number;
  @IsOptional() @IsInt() warnPercent?: number;
  @IsOptional() @IsBoolean() lateCountsPresent?: boolean;
  @IsOptional() @IsNumber() halfDayValue?: number;
  @IsOptional() @IsBoolean() leaveCountsPresent?: boolean;
  @IsOptional() @IsBoolean() excusedCountsPresent?: boolean;
  @IsOptional() @IsBoolean() absentNotify?: boolean;
  @IsOptional() @IsBoolean() lateNotify?: boolean;
  @IsOptional() @IsBoolean() lowAttendanceNotify?: boolean;
  @IsOptional() @IsInt() consecutiveAbsentAlert?: number;
  @IsOptional() @IsInt() reminderHour?: number;
  @IsOptional() @IsInt() reminderMinute?: number;
  @IsOptional() @IsInt() lateThresholdMin?: number;
  @IsOptional() @IsInt() gracePeriodMin?: number;
  @IsOptional() @IsBoolean() qrEnabled?: boolean;
  @IsOptional() @IsBoolean() geoEnabled?: boolean;
  @IsOptional() @IsInt() geoRadiusM?: number;
  @IsOptional() @IsObject() policy?: Record<string, unknown>;
}

export class SaveAttendanceStatusDto {
  @IsOptional() @IsUUID() id?: string;
  @IsString() @MaxLength(20) code!: string;
  @IsOptional() @IsString() @MaxLength(8) shortCode?: string;
  @IsString() @MaxLength(80) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() countsPresent?: boolean;
  @IsOptional() @IsBoolean() countsAbsent?: boolean;
  @IsOptional() @IsBoolean() countsTowardPct?: boolean;
  @IsOptional() @IsNumber() attendanceValue?: number;
  @IsOptional() @IsBoolean() requiresApproval?: boolean;
  @IsOptional() @IsBoolean() requiresRemark?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
}

export class AttendanceMarkRowDto {
  @IsUUID() studentId!: string;
  @IsString() statusCode!: string;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsString() clientRecordId?: string;
}

export class SaveAttendanceRosterDto {
  @IsUUID() academicYearId!: string;
  @IsDateString() date!: string;
  @IsUUID() sectionId!: string;
  @IsOptional() @IsString() mode?: string;
  @IsOptional() @IsString() periodKey?: string;
  @IsOptional() @IsUUID() subjectId?: string;
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsString() clientSessionId?: string;
  @IsOptional() @IsInt() baseVersion?: number;
  @IsOptional() @IsString() deviceId?: string;
  @IsOptional() @IsNumber() geoLat?: number;
  @IsOptional() @IsNumber() geoLng?: number;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceMarkRowDto)
  records!: AttendanceMarkRowDto[];
}

export class SubmitAttendanceDto extends SaveAttendanceRosterDto {
  @IsOptional() @IsBoolean() asDraft?: boolean;
}

export class AttendanceCorrectionDto {
  @IsUUID() recordId!: string;
  @IsString() toStatus!: string;
  @IsString() @MaxLength(500) reason!: string;
}

export class ReviewCorrectionDto {
  @IsOptional() @IsString() note?: string;
}

export class CreateLeaveDto {
  @IsUUID() studentId!: string;
  @IsUUID() leaveTypeId!: string;
  @IsDateString() fromDate!: string;
  @IsDateString() toDate!: string;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsString() documentUrl?: string;
}

export class ReviewLeaveDto {
  @IsOptional() @IsString() note?: string;
}

export class UnlockAttendanceDto {
  @IsOptional() @IsUUID() sessionId?: string;
  @IsString() @MaxLength(400) reason!: string;
}

export class SubstituteDto {
  @IsUUID() sectionId!: string;
  @IsDateString() date!: string;
  @IsUUID() staffId!: string;
  @IsOptional() @IsUUID() originalStaffId?: string;
  @IsOptional() @IsString() reason?: string;
}

export class AttendanceSyncDto {
  @IsString() deviceId!: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitAttendanceDto)
  sessions!: SubmitAttendanceDto[];
}

export class BulkNotifyDto {
  @IsArray() @IsUUID('4', { each: true }) studentIds!: string[];
  @IsOptional() @IsString() channel?: string;
  @IsOptional() @IsString() message?: string;
}

export class SaveLeaveTypeDto {
  @IsString() @MaxLength(20) code!: string;
  @IsString() @MaxLength(80) name!: string;
  @IsOptional() @IsBoolean() countsAsPresent?: boolean;
  @IsOptional() @IsBoolean() requiresDocument?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class QrScanDto {
  @IsString() token!: string;
  @IsUUID() studentId!: string;
}

export class SaveAttendanceClassRuleDto {
  @IsOptional() @IsUUID() id?: string;
  @IsUUID() academicYearId!: string;
  @IsUUID() gradeId!: string;
  @IsOptional() @IsUUID() sectionId?: string;
  @IsOptional() @IsString() mode?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
