import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class CreateIntakeDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(2)
  code!: string;

  @IsUUID()
  programId!: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalSeats!: number;

  @IsOptional()
  @IsIn(['draft', 'open', 'closed'])
  status?: string;
}

export class CreateApplicationDto {
  @IsUUID()
  intakeId!: string;

  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsIn(['GENERAL', 'OBC', 'SC', 'ST', 'EWS'])
  category?: string;

  @Type(() => Number)
  @IsNumber()
  meritScore!: number;

  @IsOptional()
  @IsUUID()
  preferredShiftId?: string;

  @IsUUID()
  academicStreamId!: string;
}

export class UpsertIntakeShiftDto {
  @IsUUID()
  shiftId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalSeats!: number;

  @IsOptional()
  reservedSeats?: Record<string, number>;
}

export class UpdateApplicationStatusDto {
  @IsIn(['submitted', 'under_review', 'shortlisted', 'rejected', 'allotted'])
  status!: string;
}

export class GenerateMeritListDto {
  @IsUUID()
  intakeId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  round?: number;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['GENERAL', 'OBC', 'SC', 'ST', 'EWS'])
  category?: string;
}

export class RunSeatAllocationDto {
  @IsUUID()
  intakeId!: string;

  @IsUUID()
  meritListId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  round?: number;
}

export class UpdateAllocationStatusDto {
  @IsIn(['provisional', 'confirmed', 'withdrawn'])
  status!: string;
}

export class UpdateCycleDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  registrationOpensAt?: string;

  @IsOptional()
  @IsString()
  registrationClosesAt?: string;

  @IsOptional()
  @IsString()
  applicationDeadline?: string;

  @IsOptional()
  @IsString()
  paymentDeadline?: string;

  @IsOptional()
  settings?: Record<string, unknown>;
}

export class VerifyDocumentDto {
  @IsIn(['VERIFIED', 'REJECTED'])
  status!: 'VERIFIED' | 'REJECTED';

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class MarkPaymentDto {
  @IsIn(['PAID', 'WAIVED', 'PENDING'])
  status!: string;

  @IsOptional()
  @IsString()
  paymentReference?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amountPaid?: number;
}

export class MarkAdmissionFeeDto {
  @IsIn(['PAID', 'WAIVED', 'PENDING', 'NOT_APPLICABLE'])
  status!: string;

  @IsOptional()
  @IsString()
  admissionFeeReference?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  admissionFeeAmount?: number;
}
