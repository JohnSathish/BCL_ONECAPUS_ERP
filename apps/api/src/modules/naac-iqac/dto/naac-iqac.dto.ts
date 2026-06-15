import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @IsOptional()
  @IsString()
  q?: string;
}

export class EvidenceSearchDto extends ListQueryDto {
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
  academicYear?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  sourceType?: string;
}

export class CreateEvidenceTagDto {
  @IsString()
  sourceType!: string;

  @IsUUID()
  sourceId!: string;

  @IsInt()
  @Min(1)
  @Max(7)
  criterion!: number;

  @IsString()
  academicYear!: string;

  @IsOptional()
  @IsString()
  metricCode?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  committeeId?: string;

  @IsOptional()
  @IsUUID()
  programmeId?: string;

  @IsOptional()
  @IsString()
  activityTitle?: string;

  @IsOptional()
  @IsString()
  eventTitle?: string;

  @IsOptional()
  @IsString()
  evidenceNotes?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  storageKey?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsUUID()
  vaultDocumentId?: string;
}

export class CreateMetricDto {
  @IsUUID()
  criterionId!: string;

  @IsString()
  code!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  dataType?: string;

  @IsOptional()
  isMandatory?: boolean;
}

export class UpdateMetricDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  dataType?: string;

  @IsOptional()
  isMandatory?: boolean;
}

export class VaultUploadDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  criterion!: number;

  @IsString()
  academicYear!: string;

  @IsOptional()
  @IsString()
  metricCode?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  committeeId?: string;

  @IsOptional()
  @IsUUID()
  programmeId?: string;

  @IsOptional()
  @IsString()
  activityTitle?: string;

  @IsOptional()
  @IsString()
  eventTitle?: string;

  @IsOptional()
  @IsString()
  evidenceNotes?: string;
}

export class CreateAqarDto {
  @IsString()
  academicYear!: string;

  @IsString()
  title!: string;
}

export class UpdateAqarDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  institutionProfile?: Record<string, unknown>;
}

export class SyncAqarSectionDto {
  @IsString()
  sectionKey!: string;
}

export class CreateFacultyAchievementDto {
  @IsUUID()
  staffProfileId!: string;

  @IsString()
  achievementType!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  achievementDate?: string;

  @IsOptional()
  @IsUUID()
  staffPublicationId?: string;

  @IsOptional()
  @IsUUID()
  staffAwardId?: string;

  @IsInt()
  @Min(1)
  @Max(7)
  criterion!: number;

  @IsString()
  academicYear!: string;

  @IsOptional()
  @IsString()
  metricCode?: string;
}

export class CreateStudentAchievementDto {
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsString()
  achievementType!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  achievementDate?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsInt()
  @Min(1)
  @Max(7)
  criterion!: number;

  @IsString()
  academicYear!: string;

  @IsOptional()
  @IsString()
  metricCode?: string;
}

export class CreateMouDto {
  @IsString()
  partnerType!: string;

  @IsString()
  partnerName!: string;

  @IsOptional()
  @IsString()
  signedAt?: string;

  @IsOptional()
  @IsString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateMouActivityDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  activityDate?: string;

  @IsOptional()
  @IsString()
  outcomes?: string;

  @IsOptional()
  @IsString()
  reportNotes?: string;
}

export class CreateDepartmentSubmissionDto {
  @IsUUID()
  departmentId!: string;

  @IsString()
  academicYear!: string;

  @IsString()
  submissionType!: string;

  @IsOptional()
  payload?: Record<string, unknown>;
}

export class ReviewDepartmentSubmissionDto {
  @IsString()
  status!: string;
}

export class CreateCalendarEventDto {
  @IsString()
  title!: string;

  @IsString()
  eventType!: string;

  @IsString()
  dueDate!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  activeAqarYear?: string;

  @IsOptional()
  institutionProfile?: Record<string, unknown>;
}

export class ReportExportDto {
  @IsString()
  reportType!: string;

  @IsOptional()
  @IsString()
  format?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  criterion?: number;

  @IsOptional()
  @IsString()
  academicYear?: string;
}
