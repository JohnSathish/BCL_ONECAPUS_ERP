import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export const AUDIENCE_TYPES = [
  'STUDENTS',
  'PARENTS',
  'FACULTY',
  'DEPARTMENTS',
  'INDIVIDUAL',
  'COMMITTEE',
] as const;
export const CHANNELS = ['EMAIL', 'IN_APP', 'SMS', 'WHATSAPP', 'PUSH'] as const;

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
  userIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  studentIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  staffProfileIds?: string[];
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
  @IsObject()
  audienceFilter?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsIn(CHANNELS, { each: true })
  channels?: string[];

  @IsOptional()
  @IsArray()
  attachments?: Record<string, unknown>[];

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;
}

export class PreviewAudienceDto {
  @IsIn(AUDIENCE_TYPES)
  audienceType!: (typeof AUDIENCE_TYPES)[number];

  @IsOptional()
  @IsObject()
  audienceFilter?: Record<string, unknown>;
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
