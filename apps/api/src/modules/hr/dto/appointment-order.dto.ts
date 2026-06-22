import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class AppointmentOrderQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  designationId?: string;

  @IsOptional()
  @IsString()
  appointmentType?: string;

  @IsOptional()
  @IsString()
  staffType?: string;

  @IsOptional()
  @IsNumber()
  joiningYear?: number;
}

export class CreateAppointmentOrderDto {
  @IsUUID()
  applicationId!: string;

  @IsOptional()
  @IsUUID()
  offerId?: string;

  @IsString()
  appointmentType!: string;

  @IsOptional()
  @IsString()
  employmentMode?: string;

  @IsString()
  staffType!: string;

  @IsOptional()
  @IsUUID()
  designationId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @IsDateString()
  joiningDate?: string;

  @IsOptional()
  @IsString()
  reportingTo?: string;

  @IsOptional()
  @IsUUID()
  payStructureTemplateId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  basicPay?: number;

  @IsOptional()
  salaryBreakup?: unknown;

  @IsOptional()
  @IsNumber()
  grossSalary?: number;

  @IsOptional()
  @IsNumber()
  totalDeductions?: number;

  @IsOptional()
  @IsNumber()
  netSalary?: number;

  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsOptional()
  @IsString()
  termsHtml?: string;
}

export class UpdateAppointmentOrderDto extends CreateAppointmentOrderDto {}

export class RejectAppointmentOrderDto {
  @IsString()
  reason!: string;
}

export class CancelAppointmentOrderDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class AcceptAppointmentOrderDto {
  @IsOptional()
  @IsString()
  signedCopyUrl?: string;
}

export class BulkGenerateAppointmentOrdersDto {
  @IsArray()
  @IsUUID('4', { each: true })
  applicationIds!: string[];
}

export class CreateJoiningReportDto {
  @IsUUID()
  appointmentOrderId!: string;

  @IsDateString()
  actualJoiningDate!: string;

  @IsOptional()
  @IsDateString()
  reportingDate?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  documentUrl?: string;
}

export class PreviewSalaryDto {
  @IsUUID()
  payStructureTemplateId!: string;

  @IsNumber()
  @Min(0)
  basicPay!: number;
}
