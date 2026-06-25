import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import {
  OFFICIAL_DOCUMENT_PRIORITIES,
  OFFICIAL_DOCUMENT_STATUSES,
  OFFICIAL_DOCUMENT_TYPES,
} from '../constants/official-documents.constants';

export class ListOfficialDocumentsQueryDto {
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

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn([...OFFICIAL_DOCUMENT_TYPES])
  documentType?: string;

  @IsOptional()
  @IsIn([...OFFICIAL_DOCUMENT_STATUSES])
  status?: string;

  @IsOptional()
  @IsIn([...OFFICIAL_DOCUMENT_PRIORITIES])
  priority?: string;

  @IsOptional()
  @IsUUID()
  issuerId?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}

export class CreateOfficialDocumentDto {
  @IsIn([...OFFICIAL_DOCUMENT_TYPES])
  documentType!: string;

  @IsString()
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  salutation?: string;

  @IsString()
  bodyHtml!: string;

  @IsOptional()
  @IsIn([...OFFICIAL_DOCUMENT_PRIORITIES])
  priority?: string;

  @IsOptional()
  @IsUUID()
  issuerId?: string;

  @IsOptional()
  @IsUUID()
  letterheadId?: string;

  @IsOptional()
  @IsObject()
  audience?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  printSettings?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  effectiveDate?: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  scheduledAt?: string;
}

export class UpdateOfficialDocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  salutation?: string;

  @IsOptional()
  @IsString()
  bodyHtml?: string;

  @IsOptional()
  @IsIn([...OFFICIAL_DOCUMENT_PRIORITIES])
  priority?: string;

  @IsOptional()
  @IsUUID()
  issuerId?: string;

  @IsOptional()
  @IsUUID()
  letterheadId?: string;

  @IsOptional()
  @IsObject()
  audience?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  printSettings?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  effectiveDate?: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  scheduledAt?: string;
}

export class ApprovalNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class RejectDocumentDto {
  @IsString()
  @MaxLength(2000)
  note!: string;
}

export class UpsertOfficialDocumentSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  defaultPrefix?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  referencePattern?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  verifyBaseUrl?: string;
}

export class CreateLetterheadDto {
  @IsString()
  @MaxLength(40)
  code!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(200)
  collegeName!: string;

  @IsString()
  @MaxLength(300)
  addressLine!: string;

  @IsOptional()
  @IsString()
  contactLine?: string;

  @IsOptional()
  @IsString()
  logoPath?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateLetterheadDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  collegeName?: string;

  @IsOptional()
  @IsString()
  addressLine?: string;

  @IsOptional()
  @IsString()
  contactLine?: string;

  @IsOptional()
  @IsString()
  logoPath?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateIssuerDto {
  @IsString()
  @MaxLength(40)
  roleCode!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(120)
  designation!: string;

  @IsOptional()
  @IsString()
  signaturePath?: string;

  @IsOptional()
  @IsString()
  sealPath?: string;

  @IsOptional()
  @IsUUID()
  letterheadId?: string;

  @IsOptional()
  @IsString()
  refPrefix?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class UpdateIssuerDto {
  @IsOptional()
  @IsString()
  name?: string;

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
  @IsUUID()
  letterheadId?: string;

  @IsOptional()
  @IsString()
  refPrefix?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateTemplateDto {
  @IsIn([...OFFICIAL_DOCUMENT_TYPES])
  documentType!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  salutation?: string;

  @IsString()
  bodyHtml!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  salutation?: string;

  @IsOptional()
  @IsString()
  bodyHtml?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UploadIssuerAssetDto {
  @IsIn(['signature', 'seal'])
  assetType!: 'signature' | 'seal';

  @IsString()
  storagePath!: string;
}
