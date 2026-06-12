import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class CertificateCategoryDto {
  @IsString()
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  group?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CertificateTemplateDto {
  @IsUUID()
  categoryId!: string;

  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsIn(['PORTRAIT', 'LANDSCAPE'])
  orientation?: string;

  @IsOptional()
  @IsString()
  pageSize?: string;

  @IsOptional()
  @IsString()
  html?: string;

  @IsOptional()
  layout?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  variables?: string[];
}

export class CertificateRequestDto {
  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsUUID()
  studentId!: string;

  @IsString()
  requestType!: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  variableData?: Record<string, unknown>;
}

export class CertificateIssueDto {
  @IsOptional()
  @IsUUID()
  requestId?: string;

  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsUUID()
  studentId!: string;

  @IsOptional()
  variableData?: Record<string, unknown>;
}

export class CertificatePreviewDto {
  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsUUID()
  studentId!: string;

  @IsOptional()
  variableData?: Record<string, unknown>;
}

export class CertificateApprovalDto {
  @IsString()
  action!: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  comments?: string;
}

export class CertificateBulkIssueDto {
  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsArray()
  studentIds!: string[];
}

export class CertificateQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

export class CertificateSequenceDto {
  @IsString()
  categoryCode!: string;

  @IsString()
  prefix!: string;

  @IsOptional()
  @IsString()
  suffix?: string;

  @IsNumber()
  @Min(2000)
  year!: number;

  @IsOptional()
  @IsString()
  format?: string;
}

export class CertificateSignatureDto {
  @IsString()
  roleSlug!: string;

  @IsString()
  displayName!: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsString()
  signaturePath?: string;

  @IsOptional()
  @IsString()
  sealPath?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
