import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const AUDIENCE_TYPES = [
  'STUDENTS',
  'PARENTS',
  'FACULTY',
  'TEACHING_STAFF',
  'NON_TEACHING_STAFF',
  'DEPARTMENTS',
  'INDIVIDUAL',
  'COMMITTEE',
  'ALL_USERS',
  'APPLICANTS',
  'ALUMNI',
] as const;
export const CHANNELS = ['EMAIL', 'IN_APP', 'SMS', 'WHATSAPP', 'PUSH'] as const;
export const FEE_STATUS_OPTIONS = [
  'PAID',
  'PARTIAL',
  'PENDING',
  'OVERDUE',
  'DEFAULTERS',
] as const;

export class CommunicationTemplateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  bodyHtml?: string;

  @IsOptional()
  @IsString()
  bodyText?: string;

  @IsOptional()
  @IsArray()
  variables?: string[];

  @IsOptional()
  @IsArray()
  @IsIn(CHANNELS, { each: true })
  channels?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCommunicationTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  bodyHtml?: string;

  @IsOptional()
  @IsString()
  bodyText?: string;

  @IsOptional()
  @IsArray()
  variables?: string[];

  @IsOptional()
  @IsArray()
  @IsIn(CHANNELS, { each: true })
  channels?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AudienceFilterDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  departmentIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  programVersionIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  academicYearIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  userIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  studentIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  excludeStudentIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  staffProfileIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  semesterIds?: string[];

  /** Programme semester sequences (1–8) from active ODD/EVEN cycle. */
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(8, { each: true })
  semesterSequences?: number[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  sectionIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  batchIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  admissionBatchIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  shiftIds?: string[];

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  studentStatus?: string;

  @IsOptional()
  @IsString()
  admissionCategory?: string;

  @IsOptional()
  @IsString()
  residenceType?: string;

  @IsOptional()
  @IsBoolean()
  hosteller?: boolean;

  @IsOptional()
  @IsBoolean()
  dayScholar?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  attendanceBelowPct?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  attendanceAbovePct?: number;

  @IsOptional()
  @IsBoolean()
  feeDue?: boolean;

  @IsOptional()
  @IsBoolean()
  defaulters?: boolean;

  @IsOptional()
  @IsIn(FEE_STATUS_OPTIONS)
  feeStatus?: (typeof FEE_STATUS_OPTIONS)[number];

  @IsOptional()
  @IsString()
  rollNumberFrom?: string;

  @IsOptional()
  @IsString()
  rollNumberTo?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  designationIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  committeeIds?: string[];

  @IsOptional()
  @IsBoolean()
  teaching?: boolean;

  @IsOptional()
  @IsBoolean()
  nonTeaching?: boolean;

  @IsOptional()
  @IsBoolean()
  permanent?: boolean;

  @IsOptional()
  @IsBoolean()
  contract?: boolean;
}

export class CommunicationCampaignDto {
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @IsString()
  @MinLength(2)
  subject!: string;

  @IsOptional()
  @IsString()
  bodyHtml?: string;

  @IsOptional()
  @IsString()
  bodyText?: string;

  @IsIn(AUDIENCE_TYPES)
  audienceType!: (typeof AUDIENCE_TYPES)[number];

  @IsOptional()
  @ValidateNested()
  @Type(() => AudienceFilterDto)
  audienceFilter?: AudienceFilterDto;

  @IsOptional()
  @IsArray()
  @IsIn(CHANNELS, { each: true })
  channels?: string[];

  @IsOptional()
  @IsArray()
  attachments?: Record<string, unknown>[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;
}

export class PreviewAudienceDto {
  @IsIn(AUDIENCE_TYPES)
  audienceType!: (typeof AUDIENCE_TYPES)[number];

  @IsOptional()
  @ValidateNested()
  @Type(() => AudienceFilterDto)
  audienceFilter?: AudienceFilterDto;
}

export class DeliveryLogQueryDto {
  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @IsOptional()
  @IsIn(CHANNELS)
  channel?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @Type(() => Number)
  @IsOptional()
  limit?: number;
}

export class NotificationPreferenceDto {
  @IsIn(CHANNELS)
  channel!: string;

  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
