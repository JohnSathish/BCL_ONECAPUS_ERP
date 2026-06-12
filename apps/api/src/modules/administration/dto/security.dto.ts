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
