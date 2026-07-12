import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class RefreshDto {
  /** Legacy body token; prefer HttpOnly cookie */
  @IsOptional()
  @IsString()
  @MinLength(10)
  refreshToken?: string;

  /** Hint for refresh TTL; server also reads rememberMe from session metadata. */
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;

  /** When set (e.g. mobile biometric unlock), enrich login audit for this refresh. */
  @IsOptional()
  @IsIn(['biometric_unlock'])
  unlockMethod?: 'biometric_unlock';
}
