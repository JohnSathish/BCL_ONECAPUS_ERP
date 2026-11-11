import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const AUDIENCE = ['STUDENT', 'STAFF'] as const;
const WINDOWS = ['today', 'tomorrow', 'next7', 'next30', 'month'] as const;
const STAFF_TYPES = ['ALL', 'TEACHING', 'NON_TEACHING'] as const;
const CHANNELS = ['EMAIL', 'IN_APP', 'SMS', 'WHATSAPP', 'PUSH'] as const;

export class BirthdayListQueryDto {
  @IsOptional()
  @IsIn(AUDIENCE)
  audience?: (typeof AUDIENCE)[number];

  @IsOptional()
  @IsIn(WINDOWS)
  window?: (typeof WINDOWS)[number];

  @IsOptional()
  @IsString()
  month?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  day?: number;

  @IsOptional()
  @IsIn(STAFF_TYPES)
  staffType?: (typeof STAFF_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(50)
  pageSize?: number;
}

export class BirthdayHistoryQueryDto {
  @IsOptional()
  @IsIn(AUDIENCE)
  audience?: (typeof AUDIENCE)[number];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsIn(['xlsx', 'pdf'])
  format?: 'xlsx' | 'pdf';
}

export class SendBirthdayWishesDto {
  @IsIn(AUDIENCE)
  audience!: (typeof AUDIENCE)[number];

  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  ids!: string[];

  @IsArray()
  @ArrayMaxSize(5)
  @IsIn(CHANNELS, { each: true })
  channels!: string[];

  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  body?: string;

  @IsOptional()
  @IsBoolean()
  retry?: boolean;
}

export class PreviewBirthdayWishDto {
  @IsIn(AUDIENCE)
  audience!: (typeof AUDIENCE)[number];

  @IsOptional()
  @IsUUID()
  id?: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  body?: string;
}

export class SaveBirthdayTemplateDto {
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  name!: string;

  @IsIn([...AUDIENCE, 'BOTH'])
  audience!: 'STUDENT' | 'STAFF' | 'BOTH';

  @IsString()
  @MinLength(3)
  @MaxLength(180)
  subject!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  body!: string;
}

export class SaveBirthdaySettingsDto {
  @IsBoolean()
  enabled!: boolean;

  @IsBoolean()
  studentsEnabled!: boolean;

  @IsBoolean()
  staffEnabled!: boolean;

  @IsString()
  sendTime!: string;

  @IsArray()
  @IsIn(CHANNELS, { each: true })
  channels!: string[];

  @IsString()
  studentTemplateCode!: string;

  @IsString()
  staffTemplateCode!: string;

  @IsBoolean()
  upcomingReminders!: boolean;

  @IsBoolean()
  preventDuplicates!: boolean;

  @IsBoolean()
  notifyPeers!: boolean;
}
