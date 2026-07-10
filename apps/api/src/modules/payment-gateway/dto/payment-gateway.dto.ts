import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class ConfigureGatewayDto {
  @IsOptional()
  @IsString()
  merchantId?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  secretKey?: string;

  @IsOptional()
  @IsString()
  webhookSecret?: string;

  @IsOptional()
  @IsString()
  successUrl?: string;

  @IsOptional()
  @IsString()
  failureUrl?: string;

  @IsOptional()
  @IsIn(['TEST', 'LIVE'])
  mode?: 'TEST' | 'LIVE';

  @IsOptional()
  @IsIn(['ENABLED', 'DISABLED'])
  status?: 'ENABLED' | 'DISABLED';
}

export class UpdatePaymentSettingsDto {
  @IsOptional()
  @IsObject()
  allowedModes?: Record<string, boolean>;

  @IsOptional()
  @IsBoolean()
  autoReceipt?: boolean;

  @IsOptional()
  @IsBoolean()
  autoEmailReceipt?: boolean;

  @IsOptional()
  @IsBoolean()
  autoSmsNotification?: boolean;

  @IsOptional()
  @IsBoolean()
  autoWhatsappNotification?: boolean;

  @IsOptional()
  @IsBoolean()
  retryFailedPayments?: boolean;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  paymentTimeoutMinutes?: number;

  @IsOptional()
  @IsBoolean()
  preventDuplicatePayments?: boolean;
}

export class TransactionLogQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  gateway?: string;

  @IsOptional()
  @IsString()
  feeType?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}

export class WebhookLogQueryDto {
  @IsOptional()
  @IsString()
  gateway?: string;

  @IsOptional()
  @IsString()
  processingStatus?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}

export class ActivateGatewayDto {
  @IsString()
  providerCode!: string;
}

export class ReplayWebhookDto {
  @IsUUID()
  webhookLogId!: string;
}
