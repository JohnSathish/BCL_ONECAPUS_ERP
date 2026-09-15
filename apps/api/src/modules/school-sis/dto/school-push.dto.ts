import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  PUSH_AUDIENCES,
  PUSH_CATEGORIES,
  PUSH_DEEP_LINKS,
} from '../school-sis-push.catalog';

export class PushAudienceDto {
  @IsIn(PUSH_AUDIENCES) kind!: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) studentIds?: string[];
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) gradeIds?: string[];
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) sectionIds?: string[];
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) userIds?: string[];
  @IsOptional() @IsBoolean() includeParents?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) personas?: string[];
}

export class SavePushCampaignDto {
  @IsString() @MaxLength(100) title!: string;
  @IsString() @MaxLength(500) body!: string;
  @IsOptional() @IsIn(PUSH_CATEGORIES) category?: string;
  @IsOptional() @IsIn(['NORMAL', 'HIGH', 'URGENT']) priority?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() iconUrl?: string;
  @IsOptional() @IsIn(PUSH_DEEP_LINKS) deepLinkType?: string;
  @IsOptional() @IsString() deepLinkValue?: string;
  @ValidateNested()
  @Type(() => PushAudienceDto)
  audience!: PushAudienceDto;
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @IsBoolean() confirm?: boolean;
  @IsOptional() @IsUUID() templateId?: string;
}

export class SavePushTemplateDto {
  @IsString() name!: string;
  @IsOptional() @IsIn(PUSH_CATEGORIES) category?: string;
  @IsString() @MaxLength(100) title!: string;
  @IsString() @MaxLength(500) body!: string;
  @IsOptional() @IsString() deepLinkType?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class SavePushSettingsDto {
  @IsOptional() @IsString() defaultPriority?: string;
  @IsOptional() @IsString() defaultIconUrl?: string;
  @IsOptional() @IsBoolean() queueEnabled?: boolean;
  @IsOptional() retryAttempts?: number;
  @IsOptional() batchSize?: number;
  @IsOptional() @IsBoolean() quietHoursEnabled?: boolean;
  @IsOptional() @IsString() quietFrom?: string;
  @IsOptional() @IsString() quietTo?: string;
  @IsOptional() @IsBoolean() digestEnabled?: boolean;
  @IsOptional() @IsBoolean() emergencyBypassQuiet?: boolean;
}

export class SavePushPreferenceDto {
  @IsString() category!: string;
  @IsBoolean() enabled!: boolean;
}

export class SavePushRuleDto {
  @IsString() eventType!: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsBoolean() pushEnabled?: boolean;
  @IsOptional() @IsBoolean() smsEnabled?: boolean;
  @IsOptional() @IsBoolean() waEnabled?: boolean;
  @IsOptional() @IsBoolean() emailEnabled?: boolean;
  @IsOptional() @IsBoolean() digestOnly?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class RegisterPushDeviceDto {
  @IsString() token!: string;
  @IsIn(['ANDROID', 'IOS', 'WEB', 'android', 'ios']) platform!: string;
  @IsOptional() @IsString() deviceModel?: string;
  @IsOptional() @IsString() osVersion?: string;
  @IsOptional() @IsString() appVersion?: string;
  @IsOptional() @IsString() deviceId?: string;
  @IsOptional() @IsString() persona?: string;
}
