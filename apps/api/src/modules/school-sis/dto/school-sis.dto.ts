import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class CreateSchoolStudentDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  admissionNumber?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  guardianName?: string;

  @IsOptional()
  @IsString()
  guardianPhone?: string;

  @IsOptional()
  @IsString()
  guardianRelation?: string;

  @IsOptional()
  @IsString()
  previousSchoolName?: string;

  @IsOptional()
  @IsString()
  previousClass?: string;
}

export class CreateSchoolStaffDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  employeeCode!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsOptional()
  @IsIn(['TEACHING', 'NON_TEACHING'])
  staffType?: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;
}

export class SaveSchoolStaffDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  employeeCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsIn(['TEACHING', 'NON_TEACHING'])
  staffType?: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @ValidateIf((_, v) => typeof v === 'string' && v.trim().length > 0)
  @IsEmail()
  email?: string;

  @IsOptional()
  @ValidateIf((_, v) => typeof v === 'string' && v.trim().length > 0)
  @IsDateString()
  joiningDate?: string;

  @IsOptional()
  @ValidateIf((_, v) => typeof v === 'string' && v.trim().length > 0)
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  bloodGroup?: string;

  @IsOptional()
  @IsString()
  fatherSpouseName?: string;

  @IsOptional()
  @IsString()
  academicQualification?: string;

  @IsOptional()
  @IsString()
  professionalQualification?: string;

  @IsOptional()
  @IsString()
  teachingExperience?: string;

  @IsOptional()
  @IsString()
  classAssigned?: string;

  @IsOptional()
  @IsString()
  trainingStatus?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsObject()
  extrasJson?: Record<string, unknown>;
}

export class AssignSchoolRollNumbersDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  studentIds?: string[];
}

export class EnrollStudentDto {
  @IsString()
  studentId!: string;

  @IsString()
  sectionId!: string;

  @IsOptional()
  @IsString()
  rollNumber?: string;
}

export class PromoteStudentDto {
  @IsUUID()
  studentId!: string;

  @IsUUID()
  toSectionId!: string;

  @IsOptional()
  @IsString()
  rollNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  note?: string;
}

export class AddPreviousSchoolDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  schoolName!: string;

  @IsOptional()
  @IsString()
  lastClass?: string;

  @IsOptional()
  @IsString()
  board?: string;

  @IsOptional()
  @IsString()
  yearOfLeaving?: string;

  @IsOptional()
  @IsString()
  tcNumber?: string;
}

export class AddStudentDocumentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  slot!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(180)
  fileName!: string;

  @IsOptional()
  @IsString()
  mimeType?: string;
}

export class AssignClassTeacherDto {
  @IsString()
  sectionId!: string;

  @IsString()
  staffId!: string;
}

export class AssignSubjectTeacherDto {
  @IsString()
  sectionId!: string;

  @IsString()
  subjectId!: string;

  @IsString()
  staffId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  periodsPerWeek?: number;
}

export class CreateSchoolSectionDto {
  @IsString()
  gradeId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(12)
  name!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity?: number;
}

export class CreateAdmissionCycleDto {
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  name!: string;

  @IsDateString()
  opensAt!: string;

  @IsDateString()
  closesAt!: string;

  @IsOptional()
  @IsUUID()
  gradeId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  seatCap?: number;
}

export class PatchApplicationStatusDto {
  @IsIn([
    'SUBMITTED',
    'UNDER_REVIEW',
    'OFFERED',
    'WAITLIST',
    'REJECTED',
    'WITHDRAWN',
  ])
  status!: string;
}

export class ConvertApplicationDto {
  @IsUUID()
  sectionId!: string;

  @IsOptional()
  @IsString()
  rollNumber?: string;
}

export class SubmitSchoolApplicationDto {
  @IsUUID()
  cycleId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  previousSchoolName?: string;

  @IsOptional()
  @IsString()
  previousClass?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  guardianName!: string;

  @IsOptional()
  @IsString()
  guardianRelation?: string;

  @IsOptional()
  @IsString()
  guardianPhone?: string;

  @IsOptional()
  @IsEmail()
  guardianEmail?: string;
}

export class SchoolAddressDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  line?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  district?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  pin?: string;
}

export class SchoolGuardianPersonDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  occupation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  photoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  relationship?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SchoolAddressDto)
  address?: SchoolAddressDto;
}

export class SchoolSiblingLinkDto {
  @IsUUID()
  siblingStudentId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  relationship?: string;
}

export class SchoolPreviousSchoolMasterDto {
  @IsOptional()
  @IsBoolean()
  none?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  schoolName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  lastClass?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  yearOfLeaving?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  tcNumber?: string;

  @IsOptional()
  @IsDateString()
  tcDate?: string;
}

export class SchoolTransportDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  routeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  vehicleId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  pickupPoint?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  dropPoint?: string;
}

export class SchoolHostelDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  hostelId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  roomNumber?: string;

  @IsOptional()
  @IsDateString()
  joinedAt?: string;
}

export class SaveSchoolStudentMasterDto {
  @IsOptional()
  @IsBoolean()
  autosave?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  admissionNumber?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsIn(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'])
  gender?: string;

  @IsOptional()
  @IsIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
  bloodGroup?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  house?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  religion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  casteCategory?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  nationality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  motherTongue?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languagesKnown?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(20)
  aadhaarNumber?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  photoUrl?: string;

  @IsOptional()
  @IsIn([
    'ACTIVE',
    'INACTIVE',
    'WITHDRAWN',
    'TRANSFERRED',
    'GRADUATED',
    'SUSPENDED',
  ])
  status?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  rollNumber?: string;

  @IsOptional()
  @IsDateString()
  admissionDate?: string;

  @IsOptional()
  @IsBoolean()
  hasSiblings?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SchoolSiblingLinkDto)
  siblings?: SchoolSiblingLinkDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => SchoolAddressDto)
  currentAddress?: SchoolAddressDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SchoolAddressDto)
  permanentAddress?: SchoolAddressDto;

  @IsOptional()
  @IsBoolean()
  permanentSameAsCurrent?: boolean;

  @IsOptional()
  @IsBoolean()
  usesTransport?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => SchoolTransportDto)
  transport?: SchoolTransportDto;

  @IsOptional()
  @IsBoolean()
  usesHostel?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => SchoolHostelDto)
  hostel?: SchoolHostelDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SchoolGuardianPersonDto)
  father?: SchoolGuardianPersonDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SchoolGuardianPersonDto)
  mother?: SchoolGuardianPersonDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SchoolGuardianPersonDto)
  guardian?: SchoolGuardianPersonDto;

  @IsOptional()
  @IsIn(['FATHER', 'MOTHER', 'GUARDIAN', 'OTHER'])
  guardianType?: string;

  @IsOptional()
  @IsBoolean()
  guardianSameAsFather?: boolean;

  @IsOptional()
  @IsIn(['GOOD', 'NEEDS_ATTENTION', 'OTHER'])
  medicalHealth?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergies?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  medicalConditions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  medications?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  emergencyNotes?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SchoolPreviousSchoolMasterDto)
  previousSchool?: SchoolPreviousSchoolMasterDto;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  bankName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  bankBranch?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  bankIfsc?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  remarks?: string;

  @IsOptional()
  @IsObject()
  extra?: Record<string, unknown>;
}

export class SchoolTimetableBellDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsIn(['PERIOD', 'BREAK'])
  kind!: string;

  @IsString()
  @MaxLength(20)
  code!: string;

  @IsString()
  @MaxLength(80)
  label!: string;

  @IsString()
  @MaxLength(8)
  startTime!: string;

  @IsString()
  @MaxLength(8)
  endTime!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  periodNumber?: number | null;
}

export class SaveSchoolTimetableBellsDto {
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SchoolTimetableBellDto)
  bells!: SchoolTimetableBellDto[];

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  days?: number[];
}

export class SaveSchoolTimetableSlotDto {
  @IsUUID()
  sectionId!: string;

  @IsUUID()
  bellId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  dayOfWeek!: number;

  @IsOptional()
  @IsUUID()
  planId?: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string | null;

  @IsOptional()
  @IsUUID()
  staffId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  roomLabel?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  notes?: string | null;

  @IsOptional()
  @IsBoolean()
  allowOverride?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  printedSubject?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  printedTeacher?: string | null;

  @IsOptional()
  @IsBoolean()
  needsConfirmation?: boolean;
}

export class BulkSchoolTimetableSlotsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveSchoolTimetableSlotDto)
  slots!: SaveSchoolTimetableSlotDto[];
}

export class MoveSchoolTimetableSlotDto {
  @IsUUID()
  slotId!: string;

  @IsUUID()
  bellId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  dayOfWeek!: number;

  @IsOptional()
  @IsBoolean()
  allowOverride?: boolean;
}

export class CopySchoolTimetableDto {
  @IsOptional()
  @IsIn(['SECTION', 'DAY', 'WEEK', 'YEAR'])
  mode?: 'SECTION' | 'DAY' | 'WEEK' | 'YEAR';

  @IsOptional()
  @IsUUID()
  fromSectionId?: string;

  @IsOptional()
  @IsUUID()
  toSectionId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  fromDay?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  toDay?: number;

  @IsOptional()
  @IsUUID()
  fromYearId?: string;

  @IsOptional()
  @IsUUID()
  toYearId?: string;

  @IsOptional()
  @IsUUID()
  planId?: string;

  @IsOptional()
  @IsBoolean()
  replaceDest?: boolean;
}

export class CreateSchoolRoomDto {
  @IsString()
  @MaxLength(40)
  name!: string;
}

export class SaveSchoolSubjectTypeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class SaveSchoolSubjectDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;

  @IsOptional()
  @IsUUID()
  subjectTypeId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  isOptional?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxMarks?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  passMarks?: number;

  @IsOptional()
  @IsBoolean()
  hasTheory?: boolean;

  @IsOptional()
  @IsBoolean()
  hasPractical?: boolean;
}

export class SaveSchoolClassSubjectsDto {
  @IsUUID()
  gradeId!: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  subjectIds!: string[];
}

export class BulkSchoolClassSubjectsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  gradeIds!: string[];

  @IsArray()
  @IsUUID('4', { each: true })
  subjectIds!: string[];
}

export class SaveSchoolAcademicYearDto {
  @IsString()
  @MinLength(4)
  @MaxLength(40)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  code?: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsIn(['CURRENT', 'UPCOMING', 'ARCHIVED'])
  status?: string;

  @IsOptional()
  @IsUUID()
  copyTimetableFromYearId?: string;
}

export class SaveSchoolGradeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class PatchSchoolSectionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(12)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  roomLabel?: string;
}

export class SaveSchoolHouseDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  captainName?: string;

  @IsOptional()
  @IsUUID()
  teacherStaffId?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class AssignSchoolHouseMembersDto {
  @IsUUID()
  houseId!: string;

  @IsArray()
  @IsUUID('4', { each: true })
  studentIds!: string[];
}

export class SaveSchoolClubDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;

  @IsOptional()
  @IsUUID()
  coordinatorStaffId?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class AssignSchoolClubMembersDto {
  @IsArray()
  @IsUUID('4', { each: true })
  studentIds!: string[];
}

export class SaveSchoolClubActivityDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsDateString()
  activityDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  notes?: string;
}

export class SaveSchoolOptionalMappingDto {
  @IsUUID()
  studentId!: string;

  @IsArray()
  @IsUUID('4', { each: true })
  subjectIds!: string[];
}

export class BulkSchoolPromotionDto {
  @IsArray()
  @IsUUID('4', { each: true })
  studentIds!: string[];

  @IsIn(['PROMOTE', 'HOLD', 'WITHDRAW'])
  action!: 'PROMOTE' | 'HOLD' | 'WITHDRAW';

  @IsOptional()
  @IsUUID()
  toSectionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  note?: string;
}

export class SaveSchoolIdCardTemplateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE'])
  status?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsObject()
  layoutJson?: Record<string, unknown>;
}

export class SaveSchoolFeeSettingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dueDay?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lateFeeAmount?: number;

  @IsOptional()
  @IsBoolean()
  lateFeeEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  paymentMethods?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(12)
  receiptPrefix?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  signatoryName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  schoolName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  schoolAddress?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  instructions?: string[];
}

export class SaveSchoolMonthlyFeePlanDto {
  @IsUUID()
  gradeId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  tuitionAmount!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lateFeeAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  otherAmount?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class SchoolFeeLateWaiverDto {
  @IsString()
  @MinLength(7)
  @MaxLength(7)
  month!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(240)
  reason!: string;
}

export class CollectSchoolFeeDto {
  @IsUUID()
  studentId!: string;

  @IsOptional()
  @IsString()
  @MinLength(7)
  @MaxLength(7)
  feeMonth?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  months?: string[];

  @IsString()
  @IsIn(['CASH', 'UPI', 'BANK', 'CHEQUE', 'OTHER', 'ONLINE'])
  paymentMode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  chequeNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  bankName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsIn(['AMOUNT', 'PERCENT'])
  discountType?: 'AMOUNT' | 'PERCENT';

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  discountValue?: number;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  discountReason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  discountApprovedBy?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amountPaying?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  otherAmount?: number;

  @IsOptional()
  @IsBoolean()
  waiveLateFee?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SchoolFeeLateWaiverDto)
  lateWaivers?: SchoolFeeLateWaiverDto[];

  @IsOptional()
  @IsIn(['OFFICE', 'PARENT', 'GATEWAY'])
  channel?: 'OFFICE' | 'PARENT' | 'GATEWAY';

  @IsOptional()
  @IsString()
  @MaxLength(240)
  notes?: string;
}

export class VoidSchoolFeeDto {
  @IsString()
  @MinLength(4)
  @MaxLength(240)
  reason!: string;
}

export class CloseSchoolFeeCashDto {
  @IsUUID()
  userId!: string;

  @IsString()
  date!: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @Type(() => Number)
  openingCash!: number;

  @Type(() => Number)
  actualCashCount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  notes?: string;
}

export class UpdateSchoolFeeLineDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amount?: number | null;

  @IsOptional()
  @IsBoolean()
  unspecified?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  remarks?: string | null;

  @IsOptional()
  @IsBoolean()
  applyToSameSchedule?: boolean;
}

export class UpdateSchoolFeeInstallmentDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amount!: number;
}
