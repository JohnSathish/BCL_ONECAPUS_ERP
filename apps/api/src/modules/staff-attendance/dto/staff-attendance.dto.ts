import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsObject,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class DeviceConfigDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsString()
  serialNumber!: string;

  @IsOptional()
  @IsString()
  deviceCode?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsUUID()
  campusId?: string;

  @IsOptional()
  @IsString()
  building?: string;

  @IsOptional()
  @IsString()
  floor?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  departmentScope?: unknown;

  @IsOptional()
  @IsIn([
    'TCP_IP',
    'MIDDLEWARE',
    'SQL_SYNC',
    'PUSH_API',
    'SQL_CONNECTOR',
    'PUSH_CONNECTOR',
    'DIRECT_TCP',
    'ETIMETRACKLITE_WEB',
  ])
  connectionType?: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  port?: number;

  @IsOptional()
  @IsString()
  protocol?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  timeoutSec?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  retryCount?: number;

  @IsOptional()
  @IsBoolean()
  sslEnabled?: boolean;

  @IsOptional()
  @IsString()
  devicePassword?: string;

  @IsOptional()
  @IsString()
  deviceKey?: string;

  @IsOptional()
  @IsString()
  machineNumber?: string;

  @IsOptional()
  @IsString()
  communicationKey?: string;

  @IsOptional()
  @IsString()
  firmwareVersion?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsInt()
  @Min(10)
  heartbeatIntervalSec?: number;

  @IsOptional()
  @IsBoolean()
  autoSyncEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  syncFrequencyMin?: number;

  @IsOptional()
  @IsIn(['DEVICE_TO_ERP', 'ERP_TO_DEVICE', 'BIDIRECTIONAL'])
  syncDirection?: string;

  @IsOptional()
  @IsString()
  punchMode?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  duplicatePunchThresholdMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  timeDriftToleranceSec?: number;

  @IsOptional()
  @IsString()
  processingStrategy?: string;

  @IsOptional()
  settings?: unknown;
}

export class SyncDeviceDto {
  @IsOptional()
  @IsIn(['INCREMENTAL', 'FULL', 'DATE_RANGE', 'DEVICE'])
  mode?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class MiddlewarePunchDto {
  @IsString()
  deviceUserId!: string;

  @IsOptional()
  @IsString()
  biometricId?: string;

  @IsDateString()
  punchTimestamp!: string;

  @IsOptional()
  @IsString()
  verificationMode?: string;

  @IsOptional()
  @IsString()
  punchDirection?: string;

  @IsOptional()
  rawPayload?: unknown;
}

export class MiddlewareIngestDto {
  @IsOptional()
  @IsUUID()
  deviceId?: string;

  @IsArray()
  punches!: MiddlewarePunchDto[];
}

export class MappingDto {
  @IsUUID()
  staffProfileId!: string;

  @IsOptional()
  @IsUUID()
  deviceId?: string;

  @IsString()
  biometricId!: string;

  @IsString()
  deviceUserId!: string;
}

export class PushUsersDto {
  @IsOptional()
  @IsArray()
  staffProfileIds?: string[];

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

export class AttendanceQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsUUID()
  deviceId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  staffProfileId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @IsString()
  month?: string;

  @IsOptional()
  @IsIn(['json', 'csv', 'excel', 'pdf', 'print'])
  format?: string;
}

export class AttendanceRuleDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  scopeType?: string;

  @IsOptional()
  @IsUUID()
  scopeId?: string;

  @IsOptional()
  @IsInt()
  duplicateToleranceMin?: number;

  @IsOptional()
  @IsInt()
  graceLateMin?: number;

  @IsOptional()
  @IsInt()
  graceEarlyMin?: number;

  @IsOptional()
  @IsInt()
  minWorkMinutes?: number;

  @IsOptional()
  @IsInt()
  halfDayMinutes?: number;

  @IsOptional()
  @IsInt()
  overtimeAfterMinutes?: number;

  @IsOptional()
  @IsBoolean()
  autoProcess?: boolean;
}

export class CorrectionDto {
  @IsUUID()
  staffProfileId!: string;

  @IsDateString()
  attendanceDate!: string;

  @IsString()
  correctionType!: string;

  @IsOptional()
  @IsDateString()
  requestedInAt?: string;

  @IsOptional()
  @IsDateString()
  requestedOutAt?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class AttendanceMasterSettingsDto {
  @IsOptional()
  @IsInt()
  attendanceYearStartMonth?: number;

  @IsOptional()
  @IsInt()
  attendanceYearStartDay?: number;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsIn(['12H', '24H'])
  timeFormat?: string;

  @IsOptional()
  workingWeek?: unknown;

  @IsOptional()
  weekendConfiguration?: unknown;

  @IsOptional()
  @IsString()
  academicSessionLinking?: string;

  @IsOptional()
  @IsString()
  multiCampusMode?: string;

  @IsOptional()
  @IsString()
  shiftCalculationMode?: string;

  @IsOptional()
  @IsString()
  punchProcessingMode?: string;

  @IsOptional()
  @IsInt()
  minPunchDifferenceMin?: number;

  @IsOptional()
  @IsInt()
  duplicateSuppressionMin?: number;

  @IsOptional()
  @IsInt()
  punchMergeWindowMin?: number;

  @IsOptional()
  @IsString()
  missingInHandling?: string;

  @IsOptional()
  @IsString()
  missingOutHandling?: string;

  @IsOptional()
  @IsBoolean()
  autoCloseOpenSessions?: boolean;

  @IsOptional()
  roundingConfiguration?: unknown;

  @IsOptional()
  @IsString()
  noShiftAssignedHandling?: string;

  @IsOptional()
  @IsIn(['STAFF_CODE', 'BIOMETRIC_ID', 'RFID_NUMBER', 'CUSTOM_DEVICE_USER_ID'])
  deviceIdentityStrategy?: string;

  @IsOptional()
  @IsBoolean()
  backupEnabled?: boolean;

  @IsOptional()
  @IsString()
  backupFrequency?: string;

  @IsOptional()
  @IsString()
  archivePolicy?: string;

  @IsOptional()
  @IsInt()
  rawLogRetentionDays?: number;

  @IsOptional()
  @IsInt()
  failedSyncRetentionDays?: number;

  @IsOptional()
  @IsBoolean()
  autoCleanupEnabled?: boolean;
}

export class AttendanceSettingsRecordDto {
  @IsObject()
  data!: Record<string, unknown>;
}

export class AttendanceReprocessDto {
  @IsOptional()
  @IsUUID()
  staffProfileId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsIn(['REALTIME', 'HOURLY', 'DAILY_BATCH', 'MANUAL'])
  mode?: string;
}
