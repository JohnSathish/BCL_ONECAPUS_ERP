import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { COURSE_DELIVERY_TYPES } from '../../../common/constants/course-delivery';

export const CURRICULUM_MAPPING_STATUSES = [
  'FULL',
  'PARTIAL',
  'UNMAPPED',
] as const;
export const CURRICULUM_ENROLLMENT_STATUSES = [
  'OPEN',
  'NEAR_FULL',
  'FULL',
  'NO_ENROLLMENT',
] as const;
export const CURRICULUM_VERSION_STATUSES = [
  'ALL',
  'ACTIVE',
  'DRAFT',
  'ARCHIVED',
] as const;
export const CURRICULUM_CREDIT_FILTERS = ['2', '3', '4', 'gt4'] as const;
export const CURRICULUM_QUICK_TOGGLES = [
  'SHARED_POOLS',
  'COMMON_FYUGP',
  'MINOR_TRACK',
  'HONOURS',
  'LABS',
  'HAS_PRACTICAL',
  'MISSING_FACULTY',
] as const;

export type CurriculumMappingStatus =
  (typeof CURRICULUM_MAPPING_STATUSES)[number];
export type CurriculumEnrollmentStatus =
  (typeof CURRICULUM_ENROLLMENT_STATUSES)[number];
export type CurriculumVersionStatus =
  (typeof CURRICULUM_VERSION_STATUSES)[number];
export type CurriculumQuickToggle = (typeof CURRICULUM_QUICK_TOGGLES)[number];

function splitCsv(value?: string): string[] | undefined {
  if (!value?.trim()) return undefined;
  const parts = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts : undefined;
}

function parseSemesters(value?: string): number[] | undefined {
  const parts = splitCsv(value);
  if (!parts?.length) return undefined;
  const nums = parts
    .map((part) => Number(part))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 8);
  return nums.length ? nums : undefined;
}

function parseBooleanQuery(value?: string): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

export class CurriculumOfferingListQueryDto {
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
  limit?: number = 30;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  programVersionId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value.map(String);
    return splitCsv(typeof value === 'string' ? value : undefined);
  })
  @IsString({ each: true })
  category?: string[];

  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value
        .map(Number)
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 8);
    }
    return parseSemesters(typeof value === 'string' ? value : undefined);
  })
  @IsInt({ each: true })
  semesterSequence?: number[];

  @IsOptional()
  @IsUUID()
  streamId?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @Transform(({ value }) =>
    parseBooleanQuery(typeof value === 'string' ? value : undefined),
  )
  @IsBoolean()
  isSharedPool?: boolean;

  @IsOptional()
  @IsIn([...CURRICULUM_MAPPING_STATUSES])
  mappingStatus?: CurriculumMappingStatus;

  @IsOptional()
  @IsIn([...COURSE_DELIVERY_TYPES])
  deliveryType?: string;

  @IsOptional()
  @IsIn([...CURRICULUM_CREDIT_FILTERS])
  credits?: (typeof CURRICULUM_CREDIT_FILTERS)[number];

  @IsOptional()
  @IsIn([...CURRICULUM_ENROLLMENT_STATUSES])
  enrollmentStatus?: CurriculumEnrollmentStatus;

  @IsOptional()
  @Transform(({ value }) =>
    parseBooleanQuery(typeof value === 'string' ? value : undefined),
  )
  @IsBoolean()
  facultyAssigned?: boolean;

  @IsOptional()
  @IsIn([...CURRICULUM_VERSION_STATUSES])
  versionStatus?: CurriculumVersionStatus;

  @IsOptional()
  @IsIn([...CURRICULUM_QUICK_TOGGLES])
  quickToggle?: CurriculumQuickToggle;

  /** Reserved for future use. */
  @IsOptional()
  @IsUUID()
  batchId?: string;

  /** Reserved for future use. */
  @IsOptional()
  @IsUUID()
  campusId?: string;

  /** Reserved for future use. */
  @IsOptional()
  @IsString()
  curriculumModel?: string;

  /** Reserved for future use. */
  @IsOptional()
  @IsString()
  honoursTrack?: string;
}
