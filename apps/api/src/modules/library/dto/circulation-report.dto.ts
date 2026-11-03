import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

export const CIRCULATION_REPORTS = [
  'all',
  'issued',
  'renewed',
  'returned',
  'current',
  'overdue',
  'late',
  'borrower',
  'departments',
  'librarians',
  'lost-damaged',
] as const;
export type CirculationReportKey = (typeof CIRCULATION_REPORTS)[number];

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CirculationReportQueryDto {
  @IsOptional()
  @IsIn(CIRCULATION_REPORTS)
  report?: CirculationReportKey;

  @IsOptional()
  @Matches(DATE)
  from?: string;

  @IsOptional()
  @Matches(DATE)
  to?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  semester?: number;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  /** STUDENT | STAFF | FACULTY | RESEARCH_SCHOLAR */
  @IsOptional()
  @IsString()
  memberType?: string;

  /** Borrower name, roll number or staff ID. */
  @IsOptional()
  @IsString()
  borrower?: string;

  /** A student id or staff profile id, for the borrower-wise report. */
  @IsOptional()
  @IsUUID()
  memberId?: string;

  @IsOptional()
  @IsString()
  bookTitle?: string;

  @IsOptional()
  @IsString()
  accession?: string;

  @IsOptional()
  @IsIn(['ISSUE', 'RENEW', 'RETURN'])
  type?: 'ISSUE' | 'RENEW' | 'RETURN';

  @IsOptional()
  @IsIn([
    'ON_LOAN',
    'OVERDUE',
    'RETURNED',
    'RENEWED',
    'RETURNED_LATE',
    'RETURNED_DAMAGED',
    'LOST',
  ])
  status?: string;

  @IsOptional()
  @IsUUID()
  processedById?: string;

  /** Quick search: name, roll number, staff ID, title, accession or transaction ID. */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class CirculationExportQueryDto extends CirculationReportQueryDto {
  @IsIn(['xlsx', 'csv', 'pdf'])
  format!: 'xlsx' | 'csv' | 'pdf';
}

export class CirculationAnalyticsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @Matches(DATE)
  from?: string;

  @IsOptional()
  @Matches(DATE)
  to?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  memberType?: string;
}
