import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class SaveWhatsappAccountDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() wabaId?: string;
  @IsOptional() @IsString() businessPortfolioId?: string;
  @IsOptional() @IsString() appId?: string;
  @IsOptional() @IsString() apiVersion?: string;
  @IsOptional() @IsString() accessToken?: string;
  @IsOptional() @IsString() appSecret?: string;
  @IsOptional() @IsString() webhookVerifyToken?: string;
}

export class SaveWhatsappNumberDto {
  @IsUUID() accountId!: string;
  @IsString() name!: string;
  @IsString() displayPhone!: string;
  @IsString() phoneNumberId!: string;
  @IsOptional() @IsString() purpose?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsString() status?: string;
}

export class EmbeddedSignupDto {
  @IsString() code!: string;
  @IsOptional() @IsString() wabaId?: string;
  @IsOptional() @IsString() phoneNumberId?: string;
  @IsOptional() @IsString() businessId?: string;
  @IsOptional() @IsString() displayPhone?: string;
  @IsOptional() @IsString() verifiedName?: string;
}

export class SaveWhatsappSettingsDto {
  @IsOptional() @IsString() defaultLanguage?: string;
  @IsOptional() @IsUUID() defaultPhoneNumberId?: string;
  @IsOptional() retryAttempts?: number;
  @IsOptional() rateLimitPerMinute?: number;
  @IsOptional() @IsBoolean() requireCampaignConfirm?: boolean;
  @IsOptional() @IsBoolean() allowDuplicateSend?: boolean;
  @IsOptional() @IsBoolean() campaignApproval?: boolean;
  @IsOptional() @IsBoolean() optInRequired?: boolean;
}

export class SaveTemplateDto {
  @IsString() name!: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional()
  @IsIn(['UTILITY', 'MARKETING', 'AUTHENTICATION'])
  category?: string;
  @IsString() body!: string;
  @IsOptional() @IsString() headerType?: string;
  @IsOptional() @IsString() headerText?: string;
  @IsOptional() @IsString() footerText?: string;
  @IsOptional() buttonsJson?: unknown;
  @IsOptional()
  variables?: Array<{
    position: number;
    token: string;
    erpField: string;
    sample?: string;
  }>;
}

export class SendTemplateMessageDto {
  @IsString() to!: string;
  @IsUUID() templateId!: string;
  @IsOptional() @IsUUID() contactId?: string;
  @IsOptional() @IsUUID() studentId?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsObject() variables?: Record<string, string>;
  @IsOptional() @IsUUID() phoneNumberId?: string;
}

export class SendTextMessageDto {
  @IsString() to!: string;
  @IsString() @MaxLength(4096) body!: string;
  @IsOptional() @IsUUID() contactId?: string;
  @IsOptional() @IsUUID() conversationId?: string;
  @IsOptional() @IsUUID() phoneNumberId?: string;
}

export class AudienceFilterDto {
  @IsOptional() @IsString() kind?: string;
  @IsOptional() @IsUUID() academicYearId?: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) gradeIds?: string[];
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) sectionIds?: string[];
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsString() feeStatus?: string;
  @IsOptional() @IsString() transportStatus?: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) studentIds?: string[];
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) staffIds?: string[];
  @IsOptional() @IsBoolean() allowDuplicates?: boolean;
}

export class SaveCampaignDto {
  @IsString() name!: string;
  @IsUUID() templateId!: string;
  @IsOptional() @IsUUID() phoneNumberId?: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsDateString() scheduledAt?: string;
  @ValidateNested()
  @Type(() => AudienceFilterDto)
  audience!: AudienceFilterDto;
}

export class ConfirmCampaignDto {
  @IsOptional() @IsBoolean() confirm?: boolean;
}

export class SaveOptInDto {
  @IsUUID() contactId!: string;
  @IsString() category!: string;
  @IsIn(['OPTED_IN', 'OPTED_OUT', 'UNKNOWN']) status!: string;
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsString() notes?: string;
}

export class SaveAutomationDto {
  @IsString() name!: string;
  @IsString() trigger!: string;
  @IsOptional() @IsString() matchValue?: string;
  @IsString() action!: string;
  @IsOptional() @IsUUID() templateId?: string;
  @IsOptional() @IsString() replyText?: string;
  @IsOptional() @IsString() escalateTo?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class AssignConversationDto {
  @IsOptional() @IsUUID() assignedTo?: string;
  @IsOptional() @IsString() status?: string;
}

export class ConversationNoteDto {
  @IsString() @MaxLength(4000) body!: string;
}

export class SaveFlowDto {
  @IsString() name!: string;
  @IsString() kind!: string;
  @IsOptional() schemaJson?: unknown;
}
