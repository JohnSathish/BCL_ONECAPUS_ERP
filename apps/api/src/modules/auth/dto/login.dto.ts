import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class LoginDto {
  @ValidateIf((o) => !o.identifier)
  @IsEmail()
  email?: string;

  @ValidateIf((o) => !o.email)
  @IsString()
  @MinLength(2)
  identifier?: string;

  /** May be a short college roll number on first login. */
  @IsString()
  @MinLength(1)
  password!: string;

  @IsString()
  challengeToken!: string;

  @Transform(({ value }) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : value;
  })
  @Type(() => Number)
  @IsInt()
  challengeAnswer!: number;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;

  /** Stable browser fingerprint UUID from localStorage */
  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  clientType?: string;

  @IsOptional()
  @IsString()
  deviceLabel?: string;

  @IsOptional()
  @IsString()
  deviceModel?: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsString()
  osVersion?: string;

  @IsOptional()
  @IsString()
  appVersion?: string;

  @IsOptional()
  @IsString()
  screenResolution?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  timeZone?: string;

  @IsOptional()
  @IsString()
  browserName?: string;

  @IsOptional()
  @IsString()
  browserVersion?: string;

  @IsOptional()
  @IsString()
  country?: string;
}
