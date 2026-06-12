import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class ListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  q?: string;
}

export class CreateEnquiryDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['ADMISSION', 'GENERAL', 'PLACEMENT', 'OTHER'])
  enquiryType!: string;

  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  programmeInterest?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  admissionApplicationId?: string;
}

export class UpdateEnquiryDto {
  @IsOptional()
  @IsIn(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'])
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  assignedToId?: string | null;
}

export class CreateGatePassDto {
  @IsString()
  @IsNotEmpty()
  visitorName!: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsString()
  idProofType?: string;

  @IsOptional()
  @IsString()
  idProofNumber?: string;

  @IsOptional()
  @IsString()
  hostName?: string;

  @IsOptional()
  @IsString()
  hostDepartment?: string;

  @IsOptional()
  @IsString()
  hostMobile?: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsString()
  vehicleNo?: string;

  @IsOptional()
  @IsString()
  validUntil?: string;
}

export class CreateComplaintDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['ACADEMIC', 'ADMIN', 'FACILITY', 'HOSTEL', 'TRANSPORT', 'OTHER'])
  category!: string;

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH'])
  priority?: string;

  @IsString()
  @IsNotEmpty()
  complainantName!: string;

  @IsOptional()
  @IsString()
  complainantMobile?: string;

  @IsOptional()
  @IsEmail()
  complainantEmail?: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsUUID()
  staffProfileId?: string;

  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;
}

export class UpdateComplaintDto {
  @IsOptional()
  @IsIn(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'])
  status?: string;

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH'])
  priority?: string;

  @IsOptional()
  @IsUUID()
  assignedToId?: string | null;

  @IsOptional()
  @IsString()
  resolution?: string;
}

export class LookupPassDto {
  @IsString()
  @IsNotEmpty()
  passNumber!: string;
}

export class KioskScanDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsOptional()
  autoCheckIn?: boolean;
}

export class LinkAdmissionDto {
  @IsUUID()
  admissionApplicationId!: string;
}
