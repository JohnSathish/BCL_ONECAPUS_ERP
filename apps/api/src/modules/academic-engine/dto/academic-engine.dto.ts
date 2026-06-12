import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class UpsertStructureDto {
  @IsOptional()
  @IsUUID()
  streamId?: string;

  @IsOptional()
  @IsString()
  structureType?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalSemesters?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  degreeMinCredits?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  semesterCreditTarget?: number;

  @IsOptional()
  @IsArray()
  semesterRules?: {
    semesterSequence: number;
    categoryCounts: Record<string, number>;
    continuityRules: Record<string, string>;
    categoryMeta?: Record<
      string,
      { creditRule?: number; mandatory?: boolean; optional?: boolean }
    >;
    semesterCreditTarget?: number;
  }[];
}

export class UpdateOfferingCapacityDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  capacity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  waitlistCapacity?: number;
}

export class Class12SubjectDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @Type(() => Number)
  marks?: number;
}

export class UpsertStudentProfileDto {
  @IsUUID()
  streamId!: string;

  @IsOptional()
  @IsBoolean()
  forceStreamChange?: boolean;

  @IsOptional()
  @IsUUID()
  admissionYearId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Class12SubjectDto)
  class12Subjects?: Class12SubjectDto[];

  @IsOptional()
  languagePreferences?: Record<string, unknown>;

  @IsOptional()
  languageEligibility?: Record<string, unknown>;
}

export class CreateProgramChoiceDto {
  @IsString()
  choiceType!: 'MAJOR' | 'MINOR';

  @IsString()
  subjectSlug!: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  effectiveFromSemester?: number;
}

export class TrackOverrideDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}

export class ResetVtcTrackDto extends TrackOverrideDto {
  @IsOptional()
  @IsString()
  trackGroupCode?: string;

  @IsOptional()
  @IsUUID()
  sem3OfferingId?: string;
}

export class CreateRegistrationWindowDto {
  @IsUUID()
  semesterId!: string;

  @IsString()
  name!: string;

  @IsDateString()
  opensAt!: string;

  @IsDateString()
  closesAt!: string;
}

export class CreateRegistrationDto {
  @IsUUID()
  semesterId!: string;

  @IsInt()
  @Min(1)
  semesterSequence!: number;
}

export class ValidateSubjectBasketDto {
  @IsUUID()
  programVersionId!: string;

  @IsInt()
  @Min(1)
  semesterSequence!: number;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @IsUUID()
  streamId?: string;

  @IsOptional()
  @IsString()
  majorSubjectSlug?: string;

  @IsOptional()
  @IsString()
  minorSubjectSlug?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Class12SubjectDto)
  class12Subjects?: Class12SubjectDto[];

  @IsObject()
  selections!: Record<string, string>;
}

export class RegistrationLineDto {
  @IsString()
  category!: string;

  @IsOptional()
  @IsUUID()
  offeringId?: string;

  @IsOptional()
  @IsUUID()
  offeringSectionId?: string;

  @IsOptional()
  @IsString()
  registrationSource?: string;

  @IsOptional()
  @IsString()
  generatedBy?: string;

  @IsOptional()
  @IsBoolean()
  eligibilityOverride?: boolean;

  @IsOptional()
  @IsString()
  eligibilityOverrideReason?: string;
}

export class CreateOfferingSectionDto {
  @IsUUID()
  shiftId!: string;

  @IsOptional()
  @IsString()
  sectionCode?: string;

  @IsOptional()
  @IsString()
  studentGroup?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  streamIds?: string[];

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
  facultyId?: string;

  @IsOptional()
  @IsUUID()
  staffProfileId?: string;

  @IsOptional()
  @IsUUID()
  classroomId?: string;
}

export class UpsertApprovalPolicyDto {
  @IsOptional()
  @IsUUID()
  programVersionId?: string;

  @IsOptional()
  @IsUUID()
  registrationWindowId?: string;

  @IsString()
  mode!: 'auto' | 'advisor' | 'hod' | 'admin_only';

  @IsOptional()
  approverRoles?: string[];

  @IsOptional()
  creditPolicy?: { minCredits: number; maxCredits: number };

  @IsOptional()
  shiftPolicy?: { enforcePreferredShift?: boolean; blockCrossShift?: boolean };
}

export class RejectRegistrationDto {
  @IsString()
  comment!: string;
}

export class UpdateRegistrationLinesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RegistrationLineDto)
  lines!: RegistrationLineDto[];
}

export class LockWindowDto {
  @IsBoolean()
  locked!: boolean;
}

export class ListRegistrationsQueryDto {
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
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;

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
}

export class BulkAutoAssignDto {
  @IsUUID()
  semesterId!: string;

  @IsInt()
  @Min(1)
  semesterSequence!: number;

  @IsOptional()
  @IsUUID()
  programVersionId?: string;

  @IsOptional()
  @IsUUID()
  admissionBatchId?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @IsBoolean()
  submitAfterAssign?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  studentIds?: string[];

  @IsOptional()
  @IsIn(['COMPULSORY_ONLY', 'ALL_CATEGORIES'])
  assignMode?: 'COMPULSORY_ONLY' | 'ALL_CATEGORIES';
}

export class AutoAssignRegistrationDto {
  @IsOptional()
  @IsIn(['COMPULSORY_ONLY', 'ALL_CATEGORIES'])
  assignMode?: 'COMPULSORY_ONLY' | 'ALL_CATEGORIES';
}

export class BulkGenerateRegistrationsDto {
  @IsUUID()
  semesterId!: string;

  @IsInt()
  @Min(1)
  semesterSequence!: number;

  @IsIn(['DRAFT_ONLY', 'COMPULSORY_ONLY', 'PREPARE_ELECTIVES', 'FULL'])
  mode!: 'DRAFT_ONLY' | 'COMPULSORY_ONLY' | 'PREPARE_ELECTIVES' | 'FULL';

  @IsOptional()
  @IsUUID()
  programVersionId?: string;

  @IsOptional()
  @IsUUID()
  admissionBatchId?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @IsBoolean()
  submitAfter?: boolean;

  @IsOptional()
  @IsIn(['COMPULSORY_ONLY', 'ALL_CATEGORIES'])
  assignMode?: 'COMPULSORY_ONLY' | 'ALL_CATEGORIES';

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  studentIds?: string[];
}

export class FreezeRegistrationDto {
  @IsBoolean()
  frozen!: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  studentIds?: string[];

  @IsOptional()
  @IsUUID()
  admissionBatchId?: string;

  @IsOptional()
  @IsUUID()
  programVersionId?: string;
}

export class UpdateRegistrationWorkflowDto {
  @IsOptional()
  @IsString()
  mode?: 'ADMIN_ONLY' | 'STUDENT_SELF' | 'HYBRID';

  @IsOptional()
  @IsBoolean()
  allowStudentSelfService?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  studentElectiveCategories?: string[];
}
