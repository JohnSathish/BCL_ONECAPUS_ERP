import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class ExamFeeMasterLineDto {
  @IsString()
  headCode!: string;

  @IsString()
  headName!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsIn(['FLAT', 'PER_PAPER'])
  unit!: 'FLAT' | 'PER_PAPER';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateExamFeeMasterDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  academicYearLabel?: string;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExamFeeMasterLineDto)
  lines?: ExamFeeMasterLineDto[];
}

export class UpdateExamFeeMasterDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  academicYearLabel?: string;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExamFeeMasterLineDto)
  lines?: ExamFeeMasterLineDto[];
}

export class CreateExamFeeSessionDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  academicYearLabel?: string;

  @IsIn(['ODD', 'EVEN'])
  semesterCycle!: 'ODD' | 'EVEN';

  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  applicableSemesters!: number[];

  @IsOptional()
  @IsDateString()
  applicationStartDate?: string;

  @IsOptional()
  @IsDateString()
  applicationEndDate?: string;

  @IsOptional()
  @IsDateString()
  lateFeeDate?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'CLOSED'])
  status?: 'DRAFT' | 'ACTIVE' | 'CLOSED';
}

export class UpdateExamFeeSessionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  academicYearLabel?: string;

  @IsOptional()
  @IsIn(['ODD', 'EVEN'])
  semesterCycle?: 'ODD' | 'EVEN';

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  applicableSemesters?: number[];

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsDateString()
  applicationStartDate?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsDateString()
  applicationEndDate?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsDateString()
  lateFeeDate?: string | null;

  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'CLOSED'])
  status?: 'DRAFT' | 'ACTIVE' | 'CLOSED';
}

export class UpdateExamFeeSettingsDto {
  @IsOptional()
  @IsString()
  receiptPrefix?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedManualModes?: string[];

  @IsOptional()
  @IsBoolean()
  requireDeclaration?: boolean;

  @IsOptional()
  @IsBoolean()
  autoVerifyOnPayment?: boolean;
}

export class StartExamApplicationDto {
  @IsUUID()
  sessionId!: string;
}

export class AddBackPaperDto {
  @IsInt()
  @Min(1)
  semesterNo!: number;

  @IsString()
  subjectCode!: string;

  @IsString()
  subjectName!: string;

  @IsIn(['THEORY_ONLY', 'THEORY_PRACTICAL'])
  examPaperType!: 'THEORY_ONLY' | 'THEORY_PRACTICAL';
}

export class SubmitExamApplicationDto {
  @IsBoolean()
  declarationAccepted!: boolean;
}

export class ManualExamPaymentDto {
  @IsIn(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'DD'])
  paymentMode!: string;

  @IsOptional()
  @IsString()
  externalReference?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class InitiateExamOnlinePaymentDto {
  @IsOptional()
  @IsString()
  provider?: string;
}

export class VerifyExamApplicationDto {
  @IsIn(['APPROVE', 'REJECT', 'REQUEST_CORRECTION'])
  action!: 'APPROVE' | 'REJECT' | 'REQUEST_CORRECTION';

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class ExamApplicationListQueryDto {
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

export class ExamReportQueryDto {
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
