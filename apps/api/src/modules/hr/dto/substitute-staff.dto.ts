import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export const SUBSTITUTE_CATEGORIES = [
  'GUEST_FACULTY',
  'VISITING_FACULTY',
  'TEMPORARY_FACULTY',
  'REPLACEMENT_FACULTY',
  'CONTRACT_FACULTY',
] as const;

export const REPLACEMENT_REASONS = [
  'STUDY_LEAVE',
  'PHD_LEAVE',
  'MATERNITY_LEAVE',
  'MEDICAL_LEAVE',
  'FDP',
  'RESEARCH_FELLOWSHIP',
  'SABBATICAL',
  'DEPUTATION',
  'OTHER',
] as const;

export const SALARY_ARRANGEMENTS = [
  'COLLEGE_PAYS_SUBSTITUTE',
  'ORIGINAL_EMPLOYEE_PAYS_SUBSTITUTE',
  'NO_PAYMENT_TRACKING',
] as const;

export const SUBSTITUTE_STATUSES = [
  'ACTIVE',
  'COMPLETED',
  'TERMINATED',
] as const;
export const ASSIGNMENT_STATUSES = [
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
] as const;

export const SUBSTITUTE_DOCUMENT_TYPES = [
  'APPOINTMENT_LETTER',
  'AGREEMENT_COPY',
  'RESUME_CV',
  'AADHAAR_CARD',
  'PAN_CARD',
  'PASSPORT_PHOTO',
  'EDUCATIONAL_CERTIFICATES',
  'PG_DEGREE',
  'MPHIL_CERTIFICATE',
  'PHD_CERTIFICATE',
  'NET_CERTIFICATE',
  'SET_CERTIFICATE',
  'EXPERIENCE_CERTIFICATES',
  'JOINING_REPORT',
  'RELIEVING_ORDER',
] as const;

export class CreateSubstituteStaffDto {
  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsOptional()
  @IsString()
  substituteCode?: string;

  @IsOptional()
  @IsIn(SUBSTITUTE_CATEGORIES)
  category?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  qualification?: string;

  @IsOptional()
  @IsString()
  specialization?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsDateString()
  joiningDate?: string;

  @IsOptional()
  @IsUUID()
  linkedStaffProfileId?: string;
}

export class UpdateSubstituteStaffDto extends CreateSubstituteStaffDto {
  @IsOptional()
  @IsIn(SUBSTITUTE_STATUSES)
  status?: string;

  @IsOptional()
  @IsDateString()
  relievingDate?: string;
}

export class ReplacementSubjectDto {
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsUUID()
  offeringSectionId?: string;

  @IsOptional()
  @IsString()
  subjectLabel?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateReplacementAssignmentDto {
  @IsUUID()
  originalStaffProfileId!: string;

  @IsOptional()
  @IsUUID()
  substituteStaffId?: string;

  @IsOptional()
  createSubstitute?: CreateSubstituteStaffDto;

  @IsIn(REPLACEMENT_REASONS)
  reason!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsIn(SALARY_ARRANGEMENTS)
  salaryArrangement!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyAgreedAmount?: number;

  @IsOptional()
  @IsBoolean()
  fullWorkloadTransfer?: boolean;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsArray()
  @Type(() => ReplacementSubjectDto)
  subjects?: ReplacementSubjectDto[];

  @IsOptional()
  @IsUUID()
  leaveApplicationId?: string;
}

export class EndReplacementAssignmentDto {
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class SubstituteStaffQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsIn(SUBSTITUTE_CATEGORIES)
  category?: string;

  @IsOptional()
  @IsIn(SUBSTITUTE_STATUSES)
  status?: string;
}

export class ReplacementAssignmentQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  originalStaffProfileId?: string;

  @IsOptional()
  @IsUUID()
  substituteStaffId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsIn(REPLACEMENT_REASONS)
  reason?: string;

  @IsOptional()
  @IsIn(ASSIGNMENT_STATUSES)
  status?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsBoolean()
  expiringSoon?: boolean;
}
