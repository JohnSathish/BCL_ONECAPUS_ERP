import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { CHARGE_TYPES, QUARTER_STATUSES } from '../constants';

export class CreateQuarterDto {
  @IsString()
  quarterNumber!: string;

  @IsString()
  quarterType!: string;

  @IsOptional()
  @IsString()
  block?: string;

  @IsOptional()
  @IsString()
  floor?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  numberOfRooms?: number;

  @IsOptional()
  @IsIn([...QUARTER_STATUSES])
  status?: string;

  @IsNumber()
  @Min(0)
  monthlyRent!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  waterCharge?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  electricityCharge?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maintenanceCharge?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  internetCharge?: number;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class UpdateQuarterDto extends CreateQuarterDto {}

export class AllotQuarterDto {
  @IsUUID()
  staffProfileId!: string;

  @IsUUID()
  quarterId!: string;

  @IsDateString()
  allottedAt!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyRent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  waterCharge?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  electricityCharge?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maintenanceCharge?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  internetCharge?: number;

  @IsOptional()
  @IsBoolean()
  payrollDeductionEnabled?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class VacateQuarterDto {
  @IsDateString()
  vacatedAt!: string;

  @IsOptional()
  @IsString()
  finalMeterReading?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  finalCharges?: number;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class CreateMonthlyChargeDto {
  @IsUUID()
  quarterId!: string;

  @IsUUID()
  staffProfileId!: string;

  @IsIn([...CHARGE_TYPES])
  chargeType!: string;

  @IsInt()
  @Min(1)
  @Max(12)
  billingMonth!: number;

  @IsInt()
  @Min(2000)
  billingYear!: number;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class CreateQuarterTypeDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  slug?: string;
}

export class QuarterListQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  quarterType?: string;

  @IsOptional()
  @IsString()
  block?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class OccupancyHistoryQueryDto extends QuarterListQueryDto {
  @IsOptional()
  @IsUUID()
  quarterId?: string;

  @IsOptional()
  @IsUUID()
  staffProfileId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;
}
