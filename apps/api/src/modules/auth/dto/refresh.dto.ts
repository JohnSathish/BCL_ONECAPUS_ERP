import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

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
}
