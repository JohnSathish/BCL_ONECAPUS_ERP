import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
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
}
