import { Transform, Type } from 'class-transformer';
import { OmitType } from '@nestjs/mapped-types';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
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

  @IsOptional()
  @IsString()
  updatedAt?: string;
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

  @IsOptional()
  @IsIn(['today', 'recent'])
  scope?: 'today' | 'recent' = 'today';

  @IsOptional()
  @IsIn(['ISSUE', 'RETURN', 'RENEW', 'RESERVE'])
  action?: 'ISSUE' | 'RETURN' | 'RENEW' | 'RESERVE';
}

export class DashboardUsageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(92)
  days?: number;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}

export class LibraryDashboardQueryDto {
  @IsOptional()
  @IsIn(['today', 'week', 'month'])
  period?: 'today' | 'week' | 'month' = 'today';
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

  @IsOptional()
  @IsString()
  @MaxLength(20)
  receiptNo?: string;
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

export class ReservationListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['ALL', 'ACTIVE', 'FULFILLED', 'CANCELLED', 'EXPIRED'])
  status?: 'ALL' | 'ACTIVE' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED' = 'ALL';

  @IsOptional()
  @IsIn(['ALL', 'STUDENT', 'STAFF', 'FACULTY'])
  memberType?: 'ALL' | 'STUDENT' | 'STAFF' | 'FACULTY' = 'ALL';

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsIn(['newest', 'oldest', 'title'])
  sort?: 'newest' | 'oldest' | 'title' = 'newest';
}

export class ReservationStudentQueryDto {
  @IsString()
  @IsNotEmpty()
  search!: string;
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
  limit?: number = 20;

  @IsOptional()
  @IsIn(['ALL', 'STUDENT', 'STAFF', 'FACULTY', 'NON_TEACHING', 'VISITOR'])
  memberType?:
    | 'ALL'
    | 'STUDENT'
    | 'STAFF'
    | 'FACULTY'
    | 'NON_TEACHING'
    | 'VISITOR';

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsIn(['today', 'week', 'month', 'custom'])
  period?: 'today' | 'week' | 'month' | 'custom';
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

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  year?: string;

  @IsOptional()
  @IsIn(['ALL', 'AVAILABLE', 'ISSUED', 'RESERVED', 'LOST'])
  availability?: 'ALL' | 'AVAILABLE' | 'ISSUED' | 'RESERVED' | 'LOST';

  @IsOptional()
  @IsIn([
    'accession',
    'title',
    'author',
    'department',
    'year',
    'copies',
    'available',
  ])
  sort?:
    | 'accession'
    | 'title'
    | 'author'
    | 'department'
    | 'year'
    | 'copies'
    | 'available';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';

  @IsOptional()
  @IsIn(['true', 'false'])
  facets?: 'true' | 'false';
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

export class EntryExitReportQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsIn(['today', 'yesterday', 'week', 'month', 'year', 'custom'])
  period?: 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'custom';

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  programId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  semester?: number;

  @IsOptional()
  @IsIn(['ALL', 'MALE', 'FEMALE', 'OTHER'])
  gender?: 'ALL' | 'MALE' | 'FEMALE' | 'OTHER';

  @IsOptional()
  @IsIn(['ALL', 'STUDENT', 'STAFF', 'FACULTY', 'NON_TEACHING', 'VISITOR'])
  memberType?:
    | 'ALL'
    | 'STUDENT'
    | 'STAFF'
    | 'FACULTY'
    | 'NON_TEACHING'
    | 'VISITOR';

  @IsOptional()
  @IsIn(['ALL', 'INSIDE', 'EXITED', 'INCOMPLETE'])
  visitStatus?: 'ALL' | 'INSIDE' | 'EXITED' | 'INCOMPLETE';

  @IsOptional()
  @IsIn(['ALL', 'MORNING', 'AFTERNOON', 'EVENING'])
  timeRange?: 'ALL' | 'MORNING' | 'AFTERNOON' | 'EVENING';

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;

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
  limit?: number = 25;

  @IsOptional()
  @IsIn(['entryAt', 'exitAt', 'duration', 'department', 'name'])
  sortBy?: 'entryAt' | 'exitAt' | 'duration' | 'department' | 'name';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(1440)
  longStayMinutes?: number;
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
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  year?: string;

  @IsOptional()
  @IsIn(['EBOOK', 'QUESTION_PAPER', 'RESEARCH_PAPER', 'OTHER'])
  bucket?: 'EBOOK' | 'QUESTION_PAPER' | 'RESEARCH_PAPER' | 'OTHER';
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

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}

export class ReportsDeskQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(730)
  days?: number = 30;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
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
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsString()
  memberType?: string;

  @IsOptional()
  @IsIn([
    'ALL',
    'STUDENT',
    'FACULTY',
    'STAFF',
    'RESEARCH_SCHOLAR',
    'INACTIVE',
    'BLOCKED',
  ])
  tab?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  semester?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  academicYear?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'BLOCKED'])
  status?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  hasOverdue?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  hasFine?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  hasActiveLoans?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  hasBorrowed?: string;

  @IsOptional()
  @IsIn(['name', 'department', 'loans', 'fines', 'score'])
  sort?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: string;

  @IsOptional()
  @IsIn(['csv', 'xlsx', 'pdf'])
  format?: 'csv' | 'xlsx' | 'pdf';
}

export class MemberDetailQueryDto {
  @IsString()
  @IsNotEmpty()
  memberType!: string;

  @IsOptional()
  @IsIn(['recent', 'all'])
  loans?: 'recent' | 'all';
}

export class MemberSyncDto {
  @IsIn(['ALL', 'STUDENTS', 'FACULTY', 'STAFF'])
  scope!: 'ALL' | 'STUDENTS' | 'FACULTY' | 'STAFF';
}

export class MemberBlockDto {
  @IsIn(['STUDENT', 'FACULTY', 'STAFF', 'RESEARCH_SCHOLAR'])
  memberType!: string;

  @IsIn([
    'OVERDUE',
    'UNPAID_FINES',
    'LOST_BOOKS',
    'DAMAGED_BOOKS',
    'DISCIPLINARY',
    'ADMINISTRATIVE',
    'OTHER',
  ])
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class MemberUnblockDto {
  @IsIn(['STUDENT', 'FACULTY', 'STAFF', 'RESEARCH_SCHOLAR'])
  memberType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  reason!: string;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

export class MemberPrivilegeDto {
  @IsIn(['STUDENT', 'FACULTY', 'STAFF', 'RESEARCH_SCHOLAR'])
  memberType!: string;

  @IsOptional()
  @Transform(({ value }) => nullableNumber(value))
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(100)
  loanLimit?: number | null;

  @IsOptional()
  @Transform(({ value }) => nullableNumber(value))
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(365)
  loanDays?: number | null;

  @IsOptional()
  @Transform(({ value }) => nullableNumber(value))
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(20)
  maxRenewals?: number | null;

  @IsOptional()
  @IsBoolean()
  fineExempt?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  expiresAt?: string | null;
}

export class MemberRefDto {
  @IsUUID()
  memberId!: string;

  @IsIn(['STUDENT', 'FACULTY', 'STAFF', 'RESEARCH_SCHOLAR'])
  memberType!: string;
}

export class MemberBulkDto {
  @IsIn(['ACTIVATE', 'BLOCK', 'UNBLOCK', 'EXPIRY', 'SYNC'])
  action!: 'ACTIVATE' | 'BLOCK' | 'UNBLOCK' | 'EXPIRY' | 'SYNC';

  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => MemberRefDto)
  members!: MemberRefDto[];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  expiresAt?: string | null;
}

export class CreateAccessionBookDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  author!: string;

  @IsOptional()
  @IsString()
  isbn?: string;

  @IsOptional()
  @IsString()
  edition?: string;

  @IsOptional()
  @IsString()
  publisher?: string;

  @IsOptional()
  @IsString()
  publicationYear?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsUUID()
  categoryId!: string;

  @IsString()
  @IsNotEmpty()
  bookType!: string;

  @IsOptional()
  @IsString()
  keywords?: string;

  @IsUUID()
  departmentId!: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  departmentIds?: string[];

  @IsOptional()
  @IsString()
  classificationNumber?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  subjectClassification?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  totalCopies!: number;

  @IsString()
  @IsNotEmpty()
  dateReceived!: string;

  @IsOptional()
  @IsIn(['NEW', 'GOOD', 'FAIR', 'DAMAGED'])
  condition?: string;

  @IsOptional()
  @IsIn([
    'RECEIVED',
    'CATALOGUED',
    'ON_SHELF',
    'ISSUED',
    'LOST',
    'DAMAGED',
    'WITHDRAWN',
  ])
  availability?: string;

  @IsIn(['PURCHASE', 'DONATION', 'GIFT', 'OTHER'])
  acquisitionType!: string;

  @IsOptional()
  @IsString()
  supplierName?: string;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsOptional()
  @IsString()
  purchaseDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  fundingSource?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
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

export class CopyIncidentListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['ALL', 'LOST', 'DAMAGED', 'REPLACED', 'RESOLVED', 'CLOSED'])
  bucket?: 'ALL' | 'LOST' | 'DAMAGED' | 'REPLACED' | 'RESOLVED' | 'CLOSED' =
    'ALL';

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  incidentType?: string;

  @IsOptional()
  @IsUUID()
  reportedById?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsIn(['newest', 'oldest', 'title'])
  sort?: 'newest' | 'oldest' | 'title' = 'newest';
}

export class IncidentCopyQueryDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}

export class ReplaceByBarcodeDto {
  @IsString()
  @IsNotEmpty()
  copyBarcode!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  replacementBarcode?: string;
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

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsIn(['ALL', 'PHYSICAL', 'DIGITAL'])
  medium?: 'ALL' | 'PHYSICAL' | 'DIGITAL';

  @IsOptional()
  @IsIn(['pdf', 'xlsx', 'csv'])
  format?: 'pdf' | 'xlsx' | 'csv';
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
