import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class StartOAuthDto {
  @IsOptional()
  @IsIn(['PERSONAL', 'PRINCIPAL_OFFICE'])
  accountLabel?: 'PERSONAL' | 'PRINCIPAL_OFFICE';
}

export class SyncMailboxDto {
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  full?: boolean;
}

export class ListMessagesQueryDto {
  @IsOptional()
  @IsString()
  folder?: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  unreadOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  starredOnly?: boolean;
}

export class MessageActionDto {
  @IsIn(['star', 'unstar', 'archive', 'trash', 'markRead', 'markUnread'])
  action!: 'star' | 'unstar' | 'archive' | 'trash' | 'markRead' | 'markUnread';
}

export class SaveDraftDto {
  @IsUUID()
  accountId!: string;

  @IsOptional()
  @IsUUID()
  draftId?: string;

  @IsArray()
  @IsString({ each: true })
  toAddresses!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ccAddresses?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  bccAddresses?: string[];

  @IsString()
  subject!: string;

  @IsString()
  bodyHtml!: string;

  @IsOptional()
  @IsString()
  bodyText?: string;

  @IsOptional()
  @IsUUID()
  replyToMessageId?: string;

  @IsOptional()
  @IsString()
  priority?: string;
}

export class SendMailDto {
  @IsUUID()
  accountId!: string;

  @IsArray()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  toAddresses!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ccAddresses?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  bccAddresses?: string[];

  @IsString()
  subject!: string;

  @IsString()
  bodyHtml!: string;

  @IsOptional()
  @IsUUID()
  replyToMessageId?: string;

  @IsOptional()
  @IsUUID()
  draftId?: string;
}
