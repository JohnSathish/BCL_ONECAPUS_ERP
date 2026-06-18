import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAccessPointDto {
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'code must be lowercase letters, numbers, and hyphens',
  })
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(32)
  accessType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsBoolean()
  blockOnFine?: boolean;

  @IsOptional()
  @IsBoolean()
  blockInactive?: boolean;

  @IsOptional()
  @IsBoolean()
  attendanceMode?: boolean;

  @IsOptional()
  @IsBoolean()
  voiceEnabled?: boolean;
}

export class UpdateAccessPointDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  blockOnFine?: boolean;

  @IsOptional()
  @IsBoolean()
  blockInactive?: boolean;

  @IsOptional()
  @IsBoolean()
  attendanceMode?: boolean;

  @IsOptional()
  @IsBoolean()
  voiceEnabled?: boolean;
}

export class CreateKioskDeviceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;
}

export class KioskScanDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  scanCode!: string;
}
