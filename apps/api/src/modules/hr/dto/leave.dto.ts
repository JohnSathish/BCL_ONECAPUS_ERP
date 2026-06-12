import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateLeaveApplicationDto {
  @IsUUID()
  staffProfileId!: string;

  @IsUUID()
  leaveTypeId!: string;

  @IsDateString()
  fromDate!: string;

  @IsDateString()
  toDate!: string;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  totalDays?: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;
}

export class PortalCreateLeaveDto {
  @IsUUID()
  leaveTypeId!: string;

  @IsDateString()
  fromDate!: string;

  @IsDateString()
  toDate!: string;

  @IsOptional()
  @IsNumber()
  totalDays?: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ApproveLeaveDto {
  @IsIn(['APPROVE', 'REJECT'])
  action!: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

export class InitializeLeaveBalancesDto {
  @IsOptional()
  @IsNumber()
  year?: number;

  @IsOptional()
  @IsUUID(undefined, { each: true })
  staffProfileIds?: string[];

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  overwrite?: boolean;
}
