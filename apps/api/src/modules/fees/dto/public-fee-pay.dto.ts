import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class PublicFeeLookupDto {
  @IsString()
  @MinLength(2)
  identifier!: string;

  @IsOptional()
  @IsString()
  challengeToken?: string;

  @IsOptional()
  @IsString()
  challengeAnswer?: string;

  @IsOptional()
  @IsString()
  turnstileToken?: string;
}

export class PublicFeeInitiateDto {
  @IsString()
  @MinLength(10)
  paymentSessionToken!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  demandIds!: string[];

  @IsOptional()
  @IsString()
  payerEmail?: string;

  @IsOptional()
  @IsString()
  payerMobile?: string;
}

export class PublicFeeVerifyRazorpayDto {
  @IsString()
  razorpay_order_id!: string;

  @IsString()
  razorpay_payment_id!: string;

  @IsString()
  razorpay_signature!: string;

  @IsOptional()
  @IsString()
  paymentSessionToken?: string;
}

export class PublicFeeSimulateDto {
  @IsString()
  @MinLength(10)
  paymentSessionToken!: string;

  @IsUUID()
  paymentId!: string;
}

export class PublicFeeReceiptAccessDto {
  @ValidateIf((o) => !o.receiptAccessToken)
  @IsString()
  paymentSessionToken?: string;

  @ValidateIf((o) => !o.paymentSessionToken)
  @IsString()
  receiptAccessToken?: string;
}
