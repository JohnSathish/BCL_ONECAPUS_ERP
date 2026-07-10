import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ProposalSectionToggleDto {
  @IsString()
  key!: string;

  @IsBoolean()
  enabled!: boolean;
}

export class ProposalPricingLineDto {
  @IsString()
  @MaxLength(160)
  label!: string;

  @Type(() => Number)
  @IsNumber()
  amount!: number;
}

export class ProposalCustomizationDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  institutionName?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  proposalVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  proposalDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  studentStrength?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  perStudentSubscriptionRate?: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  contactPerson?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  addressLine?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  primaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  secondaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  proposalTheme?: string;

  @IsOptional()
  @IsString()
  backgroundImageUrl?: string;

  @IsOptional()
  @IsString()
  dashboardScreenshotUrl?: string;

  @IsOptional()
  @IsString()
  mobileScreenshotUrl?: string;

  @IsOptional()
  @IsString()
  signatureUrl?: string;

  @IsOptional()
  @IsString()
  qrCodeUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProposalPricingLineDto)
  pricingLines?: ProposalPricingLineDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProposalSectionToggleDto)
  sectionToggles?: ProposalSectionToggleDto[];

  @IsOptional()
  @IsObject()
  copyOverrides?: Record<string, string>;
}

export class ProposalExportQueryDto {
  @IsOptional()
  @IsString()
  format?: 'html' | 'pdf' | 'docx';
}

export class CreateProposalPresetDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @ValidateNested()
  @Type(() => ProposalCustomizationDto)
  data!: ProposalCustomizationDto;
}

export class UpdateProposalPresetDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProposalCustomizationDto)
  data?: ProposalCustomizationDto;
}
