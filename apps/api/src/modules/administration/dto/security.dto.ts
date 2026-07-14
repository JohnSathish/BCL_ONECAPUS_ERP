import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateSecuritySettingsDto {
  @IsOptional()
  @IsInt()
  @Min(6)
  minPasswordLength?: number;

  @IsOptional()
  @IsInt()
  passwordExpiryDays?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  passwordHistoryCount?: number;

  @IsOptional()
  @IsBoolean()
  forceResetOnFirstLogin?: boolean;

  @IsOptional()
  @IsInt()
  @Min(5)
  sessionTimeoutMinutes?: number;

  @IsOptional()
  @IsBoolean()
  mfaEnforced?: boolean;

  @IsOptional()
  @IsBoolean()
  allowBiometricLogin?: boolean;

  @IsOptional()
  @IsBoolean()
  allowQrLogin?: boolean;

  @IsOptional()
  @IsBoolean()
  allowRfidLogin?: boolean;

  @IsOptional()
  @IsBoolean()
  requireUppercase?: boolean;

  @IsOptional()
  @IsBoolean()
  requireLowercase?: boolean;

  @IsOptional()
  @IsBoolean()
  requireNumber?: boolean;

  @IsOptional()
  @IsBoolean()
  requireSpecial?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxConcurrentSessions?: number | null;

  @IsOptional()
  @IsBoolean()
  alertOnNewDevice?: boolean;

  @IsOptional()
  @IsBoolean()
  alertOnNewCountry?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxFailedBeforeFlag?: number;

  @IsOptional()
  @IsBoolean()
  blockOnExcessiveFails?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyEmailOnSecurity?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyPushOnSecurity?: boolean;

  @IsOptional()
  @IsBoolean()
  allowRememberMe?: boolean;

  @IsOptional()
  @IsBoolean()
  geoLookupEnabled?: boolean;
}

export class ListSessionsQueryDto {
  @IsOptional()
  search?: string;

  @IsOptional()
  page?: string;

  @IsOptional()
  limit?: string;
}

export class ListLoginHistoryQueryDto {
  @IsOptional()
  search?: string;

  @IsOptional()
  from?: string;

  @IsOptional()
  to?: string;

  @IsOptional()
  page?: string;

  @IsOptional()
  limit?: string;
}
