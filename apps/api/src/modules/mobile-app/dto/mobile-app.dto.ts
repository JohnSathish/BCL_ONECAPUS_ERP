import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateMobileAppSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  studentAppName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  staffAppName?: string;

  @IsOptional()
  @IsString()
  studentMinVersion?: string;

  @IsOptional()
  @IsString()
  studentLatestVersion?: string;

  @IsOptional()
  @IsString()
  staffMinVersion?: string;

  @IsOptional()
  @IsString()
  staffLatestVersion?: string;

  @IsOptional()
  @IsBoolean()
  studentMaintenanceMode?: boolean;

  @IsOptional()
  @IsBoolean()
  staffMaintenanceMode?: boolean;

  @IsOptional()
  @IsString()
  maintenanceMessage?: string;

  @IsOptional()
  @IsBoolean()
  studentForceUpdate?: boolean;

  @IsOptional()
  @IsBoolean()
  staffForceUpdate?: boolean;

  @IsOptional()
  @IsString()
  forceUpdateMessage?: string;

  @IsOptional()
  @IsObject()
  studentDashboardConfig?: Record<string, boolean>;

  @IsOptional()
  @IsObject()
  staffDashboardConfig?: Record<string, boolean>;

  @IsOptional()
  @IsObject()
  brandingOverrides?: Record<string, unknown>;
}

export class RegisterDeviceDto {
  @IsString()
  deviceId!: string;

  @IsIn(['STUDENT', 'STAFF'])
  appType!: 'STUDENT' | 'STAFF';

  @IsIn(['android', 'ios'])
  platform!: 'android' | 'ios';

  @IsOptional()
  @IsString()
  pushToken?: string;

  @IsOptional()
  @IsString()
  appVersion?: string;

  @IsOptional()
  @IsString()
  osVersion?: string;

  @IsOptional()
  @IsString()
  deviceModel?: string;
}

export class UpdateDeviceDto {
  @IsOptional()
  @IsString()
  pushToken?: string;

  @IsOptional()
  @IsString()
  appVersion?: string;

  @IsOptional()
  @IsString()
  osVersion?: string;
}

export class MobileAnalyticsEventDto {
  @IsIn(['LOGIN', 'SCREEN_VIEW', 'CRASH', 'PUSH_DELIVERED', 'PUSH_OPENED'])
  eventType!: string;

  @IsIn(['STUDENT', 'STAFF'])
  appType!: 'STUDENT' | 'STAFF';

  @IsOptional()
  @IsString()
  appVersion?: string;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  occurredAt?: string;
}

export class IngestAnalyticsEventsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MobileAnalyticsEventDto)
  events!: MobileAnalyticsEventDto[];
}
