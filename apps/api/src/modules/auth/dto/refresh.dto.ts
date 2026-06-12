import { IsOptional, IsString, MinLength } from 'class-validator';

export class RefreshDto {
  /** Legacy body token; prefer HttpOnly cookie */
  @IsOptional()
  @IsString()
  @MinLength(10)
  refreshToken?: string;
}
