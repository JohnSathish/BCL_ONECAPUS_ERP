import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateDemoAccountDto {
  @IsIn(['STUDENT', 'STAFF'])
  kind!: 'STUDENT' | 'STAFF';

  @IsOptional()
  @IsString()
  @MaxLength(40)
  loginId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(80)
  password?: string;
}

export class ResetDemoPasswordDto {
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(80)
  password?: string;
}

export class SetDemoActiveDto {
  @IsBoolean()
  active!: boolean;
}

export class SendDemoNotificationDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  body?: string;
}
