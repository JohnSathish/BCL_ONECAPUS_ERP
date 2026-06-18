import { Type } from 'class-transformer';
import { OmitType } from '@nestjs/mapped-types';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import type {
  CirculationPolicy,
  FinePolicy,
} from '../domain/library-policy.types';
export class ScanAccessDto {
  @IsString()
  @IsNotEmpty()
  scanCode!: string;

  @IsOptional()
  @IsUUID()
  hallId?: string;

  @IsOptional()
  @IsUUID()
  zoneId?: string;
}

export class RegisterVisitorDto {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsString()
  institution?: string;

  @IsOptional()
  @IsString()
  purpose?: string;
}

export class LibrarySettingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalSeats?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  finePerDay?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  graceDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxFine?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  defaultLoanDays?: number;

  @IsOptional()
  @IsUUID()
  roomId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxUploadMb?: number;

  @IsOptional()
  studentDigitalAccessEnabled?: boolean;

  @IsOptional()
  qrEntryEnabled?: boolean;

  @IsOptional()
  selfCheckInEnabled?: boolean;

  @IsOptional()
  zonesEnabled?: boolean;

  @IsOptional()
  blockIssueOnUnpaidFines?: boolean;

  @IsOptional()
  overdueNotifyEnabled?: boolean;

  @IsOptional()
  dueTomorrowNotifyEnabled?: boolean;

  @IsOptional()
  assistantEnabled?: boolean;

  @IsOptional()
  rfidEntryEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxRenewals?: number;

  @IsOptional()
  @IsObject()
  circulationPolicy?: CirculationPolicy;

  @IsOptional()
  @IsObject()
  finePolicy?: FinePolicy;

  @IsOptional()
  @IsArray()
  allowedMimeTypes?: string[];

  @IsOptional()
  @IsString()
  accessionPrefix?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  accessionNextSeq?: number;
}

export class MemberSummaryQueryDto {
  @IsString()
  @IsNotEmpty()
  scanCode!: string;
}

export class BookPreviewQueryDto {
  @IsString()
  @IsNotEmpty()
  barcode!: string;
}

export class ActivityQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class CreateReadingZoneDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalSeats?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class UpdateReadingZoneDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalSeats?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  active?: boolean;
}

export class LibrarySearchQueryDto {
  @IsString()
  @IsNotEmpty()
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsString()
  type?: 'ALL' | 'BOOK' | 'DIGITAL' | 'RESEARCH';
}

export class WaiveFineDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class PayFineDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RenewLoanDto {
  @IsString()
  @IsNotEmpty()
  copyBarcode!: string;
}

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class CreateBookDto {
  @IsString()
  @IsNotEmpty()
  accessionNo!: string;

  @IsOptional()
  @IsString()
  bookNumber?: string;

  @IsOptional()
  @IsString()
  isbn?: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  author?: string;

  @IsOptional()
  @IsString()
  publisher?: string;

  @IsOptional()
  @IsString()
  edition?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  shelf?: string;

  @IsOptional()
  @IsString()
  rack?: string;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsString()
  row?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalCopies?: number;
}

export class UpdateBookDto {
  @IsOptional()
  @IsString()
  bookNumber?: string;

  @IsOptional()
  @IsString()
  isbn?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  author?: string;

  @IsOptional()
  @IsString()
  publisher?: string;

  @IsOptional()
  @IsString()
  edition?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  shelf?: string;

  @IsOptional()
  @IsString()
  rack?: string;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsString()
  row?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateBookCopyDto {
  @IsUUID()
  bookId!: string;

  @IsString()
  @IsNotEmpty()
  barcode!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  copyNumber?: number;
}

export class IssueBookDto {
  @IsString()
  @IsNotEmpty()
  memberScan!: string;

  @IsString()
  @IsNotEmpty()
  copyBarcode!: string;
}

export class ReturnBookDto {
  @IsString()
  @IsNotEmpty()
  copyBarcode!: string;
}

export class ReserveBookDto {
  @IsUUID()
  bookId!: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;
}

export class VisitQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @IsOptional()
  @IsString()
  memberType?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;
}

export class BookQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  accessionStatus?: string;
}

export class ReportQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

export class DigitalAssetQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  assetType?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateDigitalAssetDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  author?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  assetType!: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  isbn?: string;

  @IsOptional()
  @IsString()
  doi?: string;

  @IsOptional()
  @IsString()
  externalUrl?: string;

  @IsOptional()
  @IsString()
  visibility?: string;
}

export class UpdateDigitalAssetDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  author?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  assetType?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  visibility?: string;

  @IsOptional()
  @IsString()
  externalUrl?: string;
}

export class ResearchItemQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  itemType?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

export class CreateResearchItemDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  abstract?: string;

  @IsString()
  @IsNotEmpty()
  itemType!: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  publicationYear?: number;

  @IsOptional()
  @IsString()
  journalName?: string;

  @IsOptional()
  @IsString()
  doi?: string;

  @IsOptional()
  @IsUUID()
  staffAuthorId?: string;

  @IsOptional()
  @IsUUID()
  studentAuthorId?: string;

  @IsOptional()
  @IsUUID()
  supervisorStaffId?: string;

  @IsOptional()
  @IsString()
  externalUrl?: string;
}

export class UpdateResearchItemDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  abstract?: string;

  @IsOptional()
  @IsString()
  itemType?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  publicationYear?: number;

  @IsOptional()
  @IsString()
  journalName?: string;

  @IsOptional()
  @IsString()
  doi?: string;

  @IsOptional()
  @IsString()
  externalUrl?: string;
}

export class ResearchApprovalDto {
  @IsString()
  @IsNotEmpty()
  action!: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  comments?: string;
}

export class ReadingAnalyticsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(730)
  days?: number = 365;
}

export class LibraryMemberQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  memberType?: string;
}

export class MemberDetailQueryDto {
  @IsString()
  @IsNotEmpty()
  memberType!: string;
}

export class CreateAccessionBookDto extends OmitType(CreateBookDto, [
  'accessionNo',
] as const) {
  @IsOptional()
  @IsString()
  accessionNo?: string;

  @IsOptional()
  @IsString()
  accessionStatus?: string;
}

export class UpdateAccessionWorkflowDto {
  @IsOptional()
  @IsString()
  accessionStatus?: string;

  @IsOptional()
  @IsString()
  shelf?: string;

  @IsOptional()
  @IsString()
  rack?: string;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsString()
  row?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;
}

export class ReportCopyIncidentDto {
  @IsString()
  @IsNotEmpty()
  copyBarcode!: string;

  @IsString()
  @IsNotEmpty()
  incidentType!: 'LOST' | 'DAMAGED' | string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  chargeAmount?: number;
}

export class ReplaceCopyIncidentDto {
  @IsOptional()
  @IsUUID()
  replacementCopyId?: string;

  @IsOptional()
  @IsString()
  replacementBarcode?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CopyIncidentQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  incidentType?: string;
}

export class ResolveIncidentDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class LinkLibraryNaacEvidenceDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsString()
  @IsNotEmpty()
  academicYear!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  criterion?: number;

  @IsOptional()
  @IsString()
  metricCode?: string;

  @IsOptional()
  @IsString()
  format?: 'pdf' | 'xlsx' | 'csv';

  @IsOptional()
  @IsString()
  evidenceNotes?: string;
}

export class NaacLibraryReportQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  academicYear?: string;
}

export class LibraryAssistantAskDto {
  @IsString()
  @IsNotEmpty()
  question!: string;
}

export class HardwareScanDto {
  @IsString()
  @IsNotEmpty()
  scanCode!: string;

  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @IsUUID()
  accessPointId?: string;

  @IsOptional()
  @IsUUID()
  zoneId?: string;
}

export class CamsLibraryBridgeDto {
  @IsString()
  @IsNotEmpty()
  accessPointCode!: string;

  @IsString()
  @IsNotEmpty()
  scanCode!: string;

  @IsOptional()
  @IsString()
  method?: string;
}
