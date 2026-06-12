import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreatePensionEnrollmentDto {
  @IsUUID()
  staffProfileId!: string;

  @IsString()
  schemeType!: string;

  @IsDateString()
  enrollmentDate!: string;

  @IsOptional()
  @IsNumber()
  lastDrawnBasic?: number;

  @IsOptional()
  @IsBoolean()
  familyPensionEligible?: boolean;
}

export class RecordPensionAccrualDto {
  @IsUUID()
  staffProfileId!: string;

  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @IsInt()
  year!: number;

  @IsNumber()
  accrualAmount!: number;

  @IsOptional()
  @IsNumber()
  employerShare?: number;

  @IsOptional()
  @IsNumber()
  employeeShare?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
