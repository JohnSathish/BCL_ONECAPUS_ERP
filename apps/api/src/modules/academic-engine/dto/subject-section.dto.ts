import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const SECTION_ALLOCATION_STRATEGIES = [
  'EQUAL',
  'ROLL_NUMBER',
  'ALPHABET',
  'GENDER',
  'RANDOM',
] as const;

export type SectionAllocationStrategy =
  (typeof SECTION_ALLOCATION_STRATEGIES)[number];

export class SubjectSectionFiltersDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  semesterNo?: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @IsOptional()
  @IsUUID()
  semesterId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

export class BulkProvisionSubjectSectionsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  semesterNo?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  offeringIds?: string[];

  @IsArray()
  @IsString({ each: true })
  sectionCodes!: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacityPerSection?: number;

  @IsOptional()
  @IsString()
  shiftCode?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @IsUUID()
  institutionId?: string;
}

export class CreateSubjectSectionDto {
  @IsUUID()
  offeringId!: string;

  @IsUUID()
  shiftId!: string;

  @IsString()
  sectionCode!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  waitlistCapacity?: number;

  @IsOptional()
  @IsUUID()
  facultyId?: string;

  @IsOptional()
  @IsUUID()
  classroomId?: string;
}

export class AutoDivideSubjectSectionsDto {
  @IsUUID()
  offeringId!: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsIn([...SECTION_ALLOCATION_STRATEGIES])
  strategy!: SectionAllocationStrategy;

  @IsOptional()
  @IsUUID()
  semesterId?: string;

  @IsOptional()
  @IsUUID()
  programVersionId?: string;

  @IsOptional()
  @IsUUID()
  admissionBatchId?: string;

  @IsOptional()
  dryRun?: boolean;
}

export class MoveStudentSectionDto {
  @IsUUID()
  lineId!: string;

  @IsUUID()
  targetSectionId!: string;
}

export class SectionAllocationImportRowDto {
  @IsString()
  rollNumber!: string;

  @IsString()
  sectionCode!: string;
}

export class ImportSectionAllocationsDto {
  @IsUUID()
  offeringId!: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionAllocationImportRowDto)
  rows!: SectionAllocationImportRowDto[];
}

export class UpdateSubjectSectionDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  waitlistCapacity?: number;

  @IsOptional()
  @IsUUID()
  facultyId?: string | null;

  @IsOptional()
  @IsUUID()
  classroomId?: string | null;
}
