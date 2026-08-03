import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

function toOptionalBoolean({ value }: { value: unknown }): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true' || value === '1' || value === 1)
    return true;
  if (value === false || value === 'false' || value === '0' || value === 0)
    return false;
  return undefined;
}

/** Query filters for GET /admissions/applications */
export class ListApplicationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  intakeId?: string;

  @IsOptional()
  @IsString()
  cycleId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @IsOptional()
  @IsString()
  documentVerificationStatus?: string;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  paymentPending?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  documentPending?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  admissionFeePending?: boolean;
}

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

export class CreateAcademicYearInlineDto {
  @IsString()
  name!: string;

  @IsString()
  startDate!: string;

  @IsString()
  endDate!: string;

  @IsOptional()
  @IsUUID()
  institutionId?: string;
}

export class CloneAdmissionCycleDto {
  @IsOptional()
  @IsUUID()
  sourceCycleId?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateAcademicYearInlineDto)
  createAcademicYear?: CreateAcademicYearInlineDto;

  @IsOptional()
  @IsString()
  applicationNumberPrefix?: string;

  @IsOptional()
  @IsIn(['clear', 'shiftYear', 'keep'])
  deadlineMode?: 'clear' | 'shiftYear' | 'keep';

  @IsOptional()
  @IsBoolean()
  archiveSource?: boolean;

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
  settingsOverrides?: Record<string, unknown>;
}

export class ClonePreviewQueryDto {
  @IsUUID()
  sourceCycleId!: string;

  @IsString()
  academicYearName!: string;
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
