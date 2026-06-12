import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { LICENSE_TYPES } from '../licensing.types';

export class CreateLicenseDto {
  @IsUUID()
  tenantId!: string;

  @IsIn([...LICENSE_TYPES])
  licenseType!: string;

  @IsOptional()
  @IsString()
  subscriptionPlan?: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  gracePeriodDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxStudents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxStaff?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  storageLimitMb?: number;

  @IsOptional()
  @IsString()
  internalNotes?: string;
}

export class RenewLicenseDto {
  @IsDateString()
  newExpiryDate!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsOptional()
  @IsString()
  paymentMode?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ExtendLicenseDto {
  @IsDateString()
  newExpiryDate!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SuspendLicenseDto {
  @IsString()
  reason!: string;
}

export class ListLicensesQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

export class ActivateLicenseKeyDto {
  @IsString()
  activationKey!: string;
}

export class CreateLicenseKeyDto {
  @IsIn([...LICENSE_TYPES])
  licenseType!: string;

  @IsOptional()
  @IsString()
  subscriptionPlan?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  termDays!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  gracePeriodDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxStudents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxStaff?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  storageLimitMb?: number;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsDateString()
  keyExpiresAt?: string;

  @IsOptional()
  @IsString()
  internalNotes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;
}
