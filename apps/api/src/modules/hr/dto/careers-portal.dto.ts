import {
  IsDateString,
  IsEmail,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class CareersApplicationStatusDto {
  @IsString()
  @MinLength(5)
  applicationNo!: string;

  @IsString()
  @MinLength(10)
  mobile!: string;
}

export class CareersDocumentUploadDto {
  @IsString()
  @MinLength(5)
  applicationNo!: string;

  @IsString()
  @MinLength(10)
  mobile!: string;

  @IsOptional()
  @IsString()
  kind?: string;
}

export class SubmitCareersApplicationDto {
  @IsUUID()
  vacancyId!: string;

  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsOptional()
  @IsString()
  fatherName?: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(10)
  mobile!: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsObject()
  addressJson?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  qualification?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  experienceYears?: number;

  @IsOptional()
  @IsObject()
  applicationDetailsJson?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  resumeUrl?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  certificatesJson?: unknown;

  /** Honeypot — must remain empty (bots fill hidden fields). */
  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  turnstileToken?: string;
}
