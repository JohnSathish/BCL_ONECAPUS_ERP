import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  CBCS_COURSE_TYPES,
  NEP_CURRICULUM_CATEGORIES,
} from '../../../common/constants/academic-categories';
import {
  ATTENDANCE_MODES,
  COURSE_DELIVERY_TYPES,
  CREDIT_CALCULATION_MODES,
} from '../../../common/constants/course-delivery';

export class CreateProgramDto {
  @IsString()
  @MinLength(2)
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsUUID()
  departmentId!: string;

  @IsString()
  @MinLength(1)
  level!: string;
}

export class UpdateProgramDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  level?: string;

  @ValidateIf((_, v) => v !== null)
  @IsOptional()
  @IsUUID()
  departmentId?: string | null;
}

export class CreateProgramVersionDto {
  @IsUUID()
  programId!: string;

  @IsOptional()
  @IsNumber()
  version?: number;

  @IsOptional()
  @IsBoolean()
  cbcsEnabled?: boolean;

  @IsOptional()
  @IsUUID()
  sourceVersionId?: string;
}

export class DuplicateProgramVersionDto {
  @IsOptional()
  @IsUUID()
  sourceVersionId?: string;
}

export class RelabelProgramVersionDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(999)
  version!: number;
}

export class NormalizeProgramVersionsDto {
  @IsString()
  @MinLength(2)
  programCode!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  keepVersionNumber!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { each: true })
  removeVersionNumbers?: number[];
}

export class CreateCourseDto {
  @IsString()
  @MinLength(2)
  code!: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @Type(() => Number)
  @IsNumber()
  credits!: number;

  @IsString()
  @IsIn([...CBCS_COURSE_TYPES], {
    message:
      'courseType must be a CBCS catalog type (CORE, ELECTIVE, SKILL, OPEN, LAB). NEP categories belong on curriculum mapping.',
  })
  courseType!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  subjectSlug?: string;

  @IsOptional()
  @IsString()
  vtcTrackGroupCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  vtcTrackStage?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  syllabusVersion?: string;

  @IsOptional()
  @IsString()
  @IsIn([...COURSE_DELIVERY_TYPES])
  deliveryType?: string;

  @IsOptional()
  @IsString()
  @IsIn([...CREDIT_CALCULATION_MODES])
  creditCalculationMode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  theoryCredits?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  practicalCredits?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  theoryHoursPerWeek?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  practicalHoursPerWeek?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalTheoryContactHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalPracticalContactHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalContactHours?: number;

  @IsOptional()
  @IsString()
  @IsIn([...ATTENDANCE_MODES])
  attendanceMode?: string;

  @IsOptional()
  @IsBoolean()
  labRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresTimetableSlots?: boolean;

  @IsOptional()
  @IsObject()
  eligibilityRules?: Record<string, unknown>;
}

export class UpdateCourseDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  credits?: number;

  @IsOptional()
  @IsString()
  @IsIn([...CBCS_COURSE_TYPES], {
    message:
      'courseType must be a CBCS catalog type (CORE, ELECTIVE, SKILL, OPEN, LAB). NEP categories belong on curriculum mapping.',
  })
  courseType?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @ValidateIf((_, v) => v !== null)
  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsString()
  subjectSlug?: string;

  @IsOptional()
  @IsString()
  vtcTrackGroupCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  vtcTrackStage?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  syllabusVersion?: string;

  @IsOptional()
  @IsString()
  @IsIn([...COURSE_DELIVERY_TYPES])
  deliveryType?: string;

  @IsOptional()
  @IsString()
  @IsIn([...CREDIT_CALCULATION_MODES])
  creditCalculationMode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  theoryCredits?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  practicalCredits?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  theoryHoursPerWeek?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  practicalHoursPerWeek?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalTheoryContactHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalPracticalContactHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalContactHours?: number;

  @IsOptional()
  @IsString()
  @IsIn([...ATTENDANCE_MODES])
  attendanceMode?: string;

  @IsOptional()
  @IsBoolean()
  labRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresTimetableSlots?: boolean;

  @IsOptional()
  @IsObject()
  eligibilityRules?: Record<string, unknown>;
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
  @IsNumber()
  capacity?: number;

  @IsOptional()
  @IsNumber()
  waitlistCapacity?: number;

  @IsOptional()
  @IsUUID()
  facultyId?: string;

  @IsOptional()
  @IsUUID()
  classroomId?: string;
}

export class UpdateOfferingSectionDto {
  @IsOptional()
  @IsUUID()
  shiftId?: string;

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

  @ValidateIf((_, v) => v !== null)
  @IsOptional()
  @IsUUID()
  facultyId?: string | null;

  @ValidateIf((_, v) => v !== null)
  @IsOptional()
  @IsUUID()
  classroomId?: string | null;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateCourseOfferingDto {
  @IsUUID()
  programVersionId!: string;

  @IsUUID()
  courseId!: string;

  @IsOptional()
  @IsUUID()
  semesterId?: string;

  @IsOptional()
  @IsBoolean()
  isElective?: boolean;

  @IsString()
  @IsIn([...NEP_CURRICULUM_CATEGORIES], {
    message:
      'category must be a NEP curriculum role (MAJOR, MINOR, MDC, AEC, SEC, VAC, VTC, …)',
  })
  category!: string;

  @IsOptional()
  @IsNumber()
  semesterSequence?: number;

  @IsOptional()
  @IsNumber()
  displayOrder?: number;

  @IsOptional()
  @IsNumber()
  majorPaperIndex?: number;

  @IsOptional()
  @IsNumber()
  capacity?: number;

  @IsOptional()
  @IsNumber()
  waitlistCapacity?: number;
}

export class UpdateCourseOfferingDto {
  @IsOptional()
  @IsNumber()
  capacity?: number;

  @IsOptional()
  @IsNumber()
  waitlistCapacity?: number;

  @IsOptional()
  @IsString()
  @IsIn([...NEP_CURRICULUM_CATEGORIES])
  category?: string;

  @IsOptional()
  @IsNumber()
  semesterSequence?: number;

  @IsOptional()
  @IsNumber()
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  isElective?: boolean;

  @ValidateIf((_, v) => v !== null)
  @IsOptional()
  @IsUUID()
  semesterId?: string | null;

  @IsOptional()
  @IsNumber()
  majorPaperIndex?: number;
}
