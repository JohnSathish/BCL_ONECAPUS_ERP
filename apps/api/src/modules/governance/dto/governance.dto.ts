import { Type } from 'class-transformer';
import { OmitType } from '@nestjs/mapped-types';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  GOVERNANCE_ATR_STATUSES,
  GOVERNANCE_ATTENDANCE_STATUSES,
  GOVERNANCE_COMMITTEE_CATEGORIES,
  GOVERNANCE_COMMITTEE_STATUSES,
  GOVERNANCE_COMMITTEE_TYPES,
  GOVERNANCE_DOCUMENT_CATEGORIES,
  GOVERNANCE_EVENT_STATUSES,
  GOVERNANCE_EVENT_TYPES,
  GOVERNANCE_MEETING_MODES,
  GOVERNANCE_MEETING_PRIORITIES,
  GOVERNANCE_MEETING_STATUSES,
  GOVERNANCE_MEMBER_ROLES,
  GOVERNANCE_MEMBER_STATUSES,
  GOVERNANCE_MOM_STATUSES,
  GOVERNANCE_NOTICE_AUDIENCES,
  GOVERNANCE_NOTICE_STATUSES,
  GOVERNANCE_REPORT_FORMATS,
  GOVERNANCE_REPORT_TYPES,
  GOVERNANCE_TASK_STATUSES,
} from '../constants/governance.constants';

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

  @IsOptional()
  @IsUUID()
  committeeId?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  academicYear?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class CreateCommitteeDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  shortCode!: string;

  @IsOptional()
  @IsIn([...GOVERNANCE_COMMITTEE_TYPES])
  committeeType?: string;

  @IsString()
  @IsNotEmpty()
  @IsIn([...GOVERNANCE_COMMITTEE_CATEGORIES])
  category!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  academicYear?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateCommitteeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn([...GOVERNANCE_COMMITTEE_TYPES])
  committeeType?: string;

  @IsOptional()
  @IsIn([...GOVERNANCE_COMMITTEE_CATEGORIES])
  category?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  academicYear?: string;

  @IsOptional()
  @IsIn([...GOVERNANCE_COMMITTEE_STATUSES])
  status?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateMemberDto {
  @IsUUID()
  committeeId!: string;

  @IsString()
  @IsNotEmpty()
  displayName!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn([...GOVERNANCE_MEMBER_ROLES])
  role!: string;

  @IsOptional()
  @IsUUID()
  staffProfileId?: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsDateString()
  joiningDate?: string;

  @IsOptional()
  @IsBoolean()
  isExternal?: boolean;
}

export class CreateCommitteeMemberBodyDto extends OmitType(CreateMemberDto, [
  'committeeId',
] as const) {}

export class UpdateMemberDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsIn([...GOVERNANCE_MEMBER_ROLES])
  role?: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsIn([...GOVERNANCE_MEMBER_STATUSES])
  status?: string;

  @IsOptional()
  @IsDateString()
  joiningDate?: string;

  @IsOptional()
  @IsBoolean()
  isExternal?: boolean;
}

export class BulkAssignMembersDto {
  @IsUUID()
  committeeId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateMemberDto)
  members!: Omit<CreateMemberDto, 'committeeId'>[];
}

export class AgendaItemDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class CreateMeetingDto {
  @IsUUID()
  committeeId!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsDateString()
  meetingDate!: string;

  @IsOptional()
  @IsString()
  meetingTime?: string;

  @IsOptional()
  @IsString()
  venue?: string;

  @IsOptional()
  @IsIn([...GOVERNANCE_MEETING_MODES])
  meetingMode?: string;

  @IsOptional()
  @IsString()
  agenda?: string;

  @IsOptional()
  @IsIn([...GOVERNANCE_MEETING_PRIORITIES])
  priority?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgendaItemDto)
  agendaItems?: AgendaItemDto[];
}

export class UpdateMeetingDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsDateString()
  meetingDate?: string;

  @IsOptional()
  @IsString()
  meetingTime?: string;

  @IsOptional()
  @IsString()
  venue?: string;

  @IsOptional()
  @IsIn([...GOVERNANCE_MEETING_MODES])
  meetingMode?: string;

  @IsOptional()
  @IsString()
  agenda?: string;

  @IsOptional()
  @IsIn([...GOVERNANCE_MEETING_PRIORITIES])
  priority?: string;

  @IsOptional()
  @IsIn([...GOVERNANCE_MEETING_STATUSES])
  status?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgendaItemDto)
  agendaItems?: AgendaItemDto[];
}

export class CalendarQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  committeeId?: string;
}

export class MarkAttendanceDto {
  @IsUUID()
  meetingId!: string;

  @IsOptional()
  @IsUUID()
  memberId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsIn([...GOVERNANCE_ATTENDANCE_STATUSES])
  status!: string;
}

export class QrAttendanceDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsOptional()
  @IsUUID()
  memberId?: string;
}

export class OtpAttendanceDto {
  @IsUUID()
  meetingId!: string;

  @IsString()
  @IsNotEmpty()
  otp!: string;

  @IsOptional()
  @IsUUID()
  memberId?: string;
}

export class CreateMomDto {
  @IsUUID()
  meetingId!: string;

  @IsOptional()
  @IsString()
  discussion?: string;

  @IsOptional()
  @IsString()
  decisions?: string;

  @IsOptional()
  @IsString()
  resolutions?: string;

  @IsOptional()
  @IsString()
  futureActions?: string;
}

export class UpdateMomDto {
  @IsOptional()
  @IsString()
  discussion?: string;

  @IsOptional()
  @IsString()
  decisions?: string;

  @IsOptional()
  @IsString()
  resolutions?: string;

  @IsOptional()
  @IsString()
  futureActions?: string;

  @IsOptional()
  @IsIn([...GOVERNANCE_MOM_STATUSES])
  status?: string;
}

export class CreateAtrDto {
  @IsUUID()
  committeeId!: string;

  @IsOptional()
  @IsUUID()
  meetingId?: string;

  @IsString()
  @IsNotEmpty()
  actionItem!: string;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @IsOptional()
  @IsString()
  assignedName?: string;

  @IsOptional()
  @IsIn([...GOVERNANCE_MEETING_PRIORITIES])
  priority?: string;

  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class UpdateAtrDto {
  @IsOptional()
  @IsString()
  actionItem?: string;

  @IsOptional()
  @IsUUID()
  assignedToId?: string | null;

  @IsOptional()
  @IsString()
  assignedName?: string;

  @IsOptional()
  @IsIn([...GOVERNANCE_MEETING_PRIORITIES])
  priority?: string;

  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsIn([...GOVERNANCE_ATR_STATUSES])
  status?: string;
}

export class AtrStatusTransitionDto {
  @IsIn([...GOVERNANCE_ATR_STATUSES])
  status!: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class CreateTaskDto {
  @IsUUID()
  committeeId!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @IsOptional()
  @IsString()
  assignedName?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  assignedToId?: string | null;

  @IsOptional()
  @IsString()
  assignedName?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsIn([...GOVERNANCE_TASK_STATUSES])
  status?: string;
}

export class CreateNoticeDto {
  @IsOptional()
  @IsUUID()
  committeeId?: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsOptional()
  @IsIn([...GOVERNANCE_NOTICE_AUDIENCES])
  audience?: string;
}

export class UpdateNoticeDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsIn([...GOVERNANCE_NOTICE_AUDIENCES])
  audience?: string;

  @IsOptional()
  @IsIn([...GOVERNANCE_NOTICE_STATUSES])
  status?: string;
}

export class UploadDocumentDto {
  @IsOptional()
  @IsUUID()
  committeeId?: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn([...GOVERNANCE_DOCUMENT_CATEGORIES])
  category!: string;

  @IsOptional()
  @IsString()
  folderPath?: string;

  @IsOptional()
  @IsString()
  academicYear?: string;
}

export class DocumentListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn([...GOVERNANCE_DOCUMENT_CATEGORIES])
  declare category?: string;

  @IsOptional()
  @IsString()
  folderPath?: string;
}

export class CreateEventDto {
  @IsUUID()
  committeeId!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn([...GOVERNANCE_EVENT_TYPES])
  eventType!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  venue?: string;
}

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsIn([...GOVERNANCE_EVENT_TYPES])
  eventType?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  venue?: string;

  @IsOptional()
  @IsIn([...GOVERNANCE_EVENT_STATUSES])
  status?: string;
}

export class CreateNaacTagDto {
  @IsString()
  @IsNotEmpty()
  entityType!: string;

  @IsUUID()
  entityId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  criterion!: number;

  @IsOptional()
  @IsString()
  evidenceNotes?: string;

  @IsOptional()
  @IsUUID()
  documentId?: string;
}

export class ReportExportDto {
  @IsIn([...GOVERNANCE_REPORT_TYPES])
  reportType!: string;

  @IsIn([...GOVERNANCE_REPORT_FORMATS])
  format!: string;

  @IsOptional()
  @IsUUID()
  committeeId?: string;

  @IsOptional()
  @IsString()
  academicYear?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class AnalyticsQueryDto {
  @IsOptional()
  @IsString()
  academicYear?: string;

  @IsOptional()
  @IsUUID()
  committeeId?: string;
}

export class PerformanceComputeDto {
  @IsOptional()
  @IsString()
  academicYear?: string;

  @IsOptional()
  @IsUUID()
  committeeId?: string;
}

export class ReviewImportDraftDto {
  @IsIn(['APPROVED', 'REJECTED'])
  reviewStatus!: string;

  @IsOptional()
  @IsObject()
  parsedJson?: Record<string, unknown>;
}

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  defaultAcademicYear?: string;

  @IsOptional()
  @IsString()
  noticePrefix?: string;

  @IsOptional()
  @IsBoolean()
  notifyEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyInApp?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyPush?: boolean;

  @IsOptional()
  @IsBoolean()
  notifySms?: boolean;

  @IsOptional()
  @IsBoolean()
  qrAttendanceEnabled?: boolean;

  @IsOptional()
  @IsObject()
  performanceWeights?: Record<string, number>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class PortalAttendanceDto {
  @IsUUID()
  meetingId!: string;

  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @IsString()
  otp?: string;
}
