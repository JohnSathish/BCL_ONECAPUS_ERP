import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const INSTALL_SHIFTS = ['MORNING', 'DAY', 'EVENING'] as const;
export const INSTALL_CATEGORIES = [
  'TEACHING',
  'NON_TEACHING',
  'STUDENTS',
  'ALL',
] as const;
export const INSTALL_STATUSES = [
  'INSTALLED',
  'NOT_INSTALLED',
  'UNVERIFIED',
  'ALL',
] as const;
export const INSTALL_PRESENTATIONS = ['screen', 'pending'] as const;
export const INSTALL_SCOPES = [
  'summary',
  'detailed',
  'pending',
  'department',
] as const;
export const INSTALL_FORMATS = ['pdf', 'xlsx'] as const;

export class AppInstallationReportQueryDto {
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  departmentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  semester?: number;

  @IsOptional()
  @IsIn(INSTALL_SHIFTS)
  shift?: (typeof INSTALL_SHIFTS)[number];

  @IsOptional()
  @IsIn(INSTALL_CATEGORIES)
  category?: (typeof INSTALL_CATEGORIES)[number];

  @IsOptional()
  @IsIn(INSTALL_STATUSES)
  status?: (typeof INSTALL_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsIn(INSTALL_PRESENTATIONS)
  presentation?: (typeof INSTALL_PRESENTATIONS)[number];
}

export class AppInstallationExportQueryDto extends AppInstallationReportQueryDto {
  @IsIn(INSTALL_FORMATS)
  format!: (typeof INSTALL_FORMATS)[number];

  @IsIn(INSTALL_SCOPES)
  scope!: (typeof INSTALL_SCOPES)[number];
}
