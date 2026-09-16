import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class ActivateSchoolLicenseDto {
  @IsString()
  @MinLength(8)
  licenseKey!: string;
  @IsString()
  @MinLength(2)
  institutionName!: string;
  @IsString()
  @MinLength(2)
  institutionCode!: string;
  @IsEmail()
  adminEmail!: string;
}

export class RenewSchoolLicenseDto {
  @IsString()
  @MinLength(8)
  licenseKey!: string;
}

export class IssueSchoolLicenseDto {
  @IsString()
  institutionName!: string;
  @IsString()
  institutionCode!: string;
  @IsOptional()
  @IsString()
  tenantId?: string;
  @IsOptional()
  @IsString()
  licenseType?: string;
  @IsOptional()
  @IsInt()
  @Min(1)
  termDays?: number;
  @IsOptional()
  @IsInt()
  @Min(1)
  maxStudents?: number;
  @IsOptional()
  @IsInt()
  @Min(1)
  maxStaff?: number;
  @IsOptional()
  @IsInt()
  @Min(1)
  installationLimit?: number;
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  modules?: string[];
  @IsOptional()
  @IsString()
  validFrom?: string;
  @IsOptional()
  @IsString()
  notes?: string;
}

export class SchoolLicenseActionDto {
  @IsOptional()
  @IsString()
  reason?: string;
  @IsOptional()
  @IsInt()
  @Min(1)
  days?: number;
  @IsOptional()
  @IsInt()
  @Min(1)
  maxStudents?: number;
  @IsOptional()
  @IsInt()
  @Min(1)
  maxStaff?: number;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modules?: string[];
}
