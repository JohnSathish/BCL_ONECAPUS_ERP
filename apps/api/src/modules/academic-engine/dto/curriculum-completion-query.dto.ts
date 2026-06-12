import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export const COMPLETION_VERSION_STATUSES = [
  'ALL',
  'ACTIVE',
  'DRAFT',
  'ARCHIVED',
] as const;
export const COMPLETION_EXPORT_FORMATS = ['csv', 'xlsx'] as const;
export const COMPLETION_REPORT_TYPES = [
  'audit',
  'missing-setup',
  'nep-compliance',
] as const;

export class CurriculumCompletionQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  programVersionId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8)
  semesterSequence?: number;

  @IsOptional()
  @IsIn([...COMPLETION_VERSION_STATUSES])
  versionStatus?: (typeof COMPLETION_VERSION_STATUSES)[number];

  @IsOptional()
  @IsUUID()
  batchId?: string;

  /** Reserved — honours pathway filter (Phase C). */
  @IsOptional()
  @IsIn(['HONOURS', 'HONOURS_WITH_RESEARCH'])
  honoursTrack?: 'HONOURS' | 'HONOURS_WITH_RESEARCH';

  /** Reserved — curriculum model filter (Phase C). */
  @IsOptional()
  curriculumModel?: string;

  /** Reserved — autonomous revision version (Phase C). */
  @IsOptional()
  autonomousVersionId?: string;

  /** Reserved — CBCS legacy mode (Phase C). */
  @IsOptional()
  legacyCbcs?: string;
}

export class CurriculumCompletionMissingItemsQueryDto extends CurriculumCompletionQueryDto {
  @IsOptional()
  category?: string;

  @IsOptional()
  issueType?: string;
}

export class CurriculumCompletionExportQueryDto extends CurriculumCompletionQueryDto {
  @IsIn([...COMPLETION_EXPORT_FORMATS])
  format!: (typeof COMPLETION_EXPORT_FORMATS)[number];

  @IsIn([...COMPLETION_REPORT_TYPES])
  reportType!: (typeof COMPLETION_REPORT_TYPES)[number];
}
