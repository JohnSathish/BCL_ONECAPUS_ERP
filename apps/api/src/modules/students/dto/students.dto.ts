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
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export const ADMISSION_TYPES = [
  'REGULAR',
  'LATERAL',
  'MIGRATION',
  'RE_ADMISSION',
] as const;

export const STUDENT_IMPORT_MODES = ['CREATE', 'MERGE'] as const;
export type StudentImportMode = (typeof STUDENT_IMPORT_MODES)[number];

export class CreateStudentDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  enrollmentNumber!: string;

  @IsOptional()
  @IsUUID()
  programVersionId?: string;

  @IsOptional()
  @IsDateString()
  admissionDate?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}

export class UpdateStudentDto {
  @IsOptional()
  @IsUUID()
  programVersionId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(2)
  enrollmentNumber?: string;

  @IsOptional()
  @IsDateString()
  admissionDate?: string | null;
}

export class CreateShiftTransferDto {
  @IsUUID()
  toShiftId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class EnrollFromApplicationDto {
  @IsOptional()
  @IsUUID()
  primaryShiftId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  enrollmentNumber?: string;

  @IsOptional()
  @IsUUID()
  programVersionId?: string;

  @IsOptional()
  @IsDateString()
  admissionDate?: string;

  @IsOptional()
  @IsUUID()
  admissionBatchId?: string;
}

export class AdmitStudentDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  enrollmentNumber?: string;

  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsUUID()
  programVersionId!: string;

  @IsUUID()
  admissionBatchId!: string;

  @IsUUID()
  streamId!: string;

  @IsUUID()
  primaryShiftId!: string;

  @IsOptional()
  @IsString()
  rollNumber?: string;

  @IsOptional()
  @IsString()
  applicationNumber?: string;

  @IsOptional()
  @IsString()
  admissionNumber?: string;

  @IsOptional()
  @IsUUID()
  campusId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  maritalStatus?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  mobileNumber?: string;

  @IsOptional()
  @IsString()
  nationalId?: string;

  @IsOptional()
  @IsUUID()
  nationalityLookupId?: string;

  @IsOptional()
  @IsUUID()
  bloodGroupLookupId?: string;

  @IsOptional()
  @IsUUID()
  religionLookupId?: string;

  @IsOptional()
  @IsUUID()
  categoryLookupId?: string;

  @IsOptional()
  @IsUUID()
  tribeLookupId?: string;

  @IsOptional()
  @IsUUID()
  denominationLookupId?: string;

  @IsOptional()
  @IsBoolean()
  differentlyAbled?: boolean;

  @IsOptional()
  @IsBoolean()
  ews?: boolean;

  @IsOptional()
  @IsObject()
  address?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  guardianName?: string;

  @IsOptional()
  @IsString()
  guardianMobile?: string;

  @IsOptional()
  @IsString()
  majorSubjectSlug?: string;

  @IsOptional()
  @IsString()
  minorSubjectSlug?: string;

  @IsOptional()
  @IsDateString()
  admissionDate?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsIn(ADMISSION_TYPES)
  admissionType?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  currentSemester?: number;

  @IsOptional()
  @IsString()
  rfidNumber?: string;

  @IsOptional()
  @IsString()
  abcId?: string;
}

export class UpdateStudentProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @IsOptional()
  @IsString()
  enrollmentNumber?: string;

  @IsOptional()
  @IsString()
  rollNumber?: string;

  @IsOptional()
  @IsUUID()
  programVersionId?: string;

  @IsOptional()
  @IsUUID()
  campusId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  primaryShiftId?: string;

  @IsOptional()
  @IsUUID()
  streamId?: string;

  @IsOptional()
  @IsUUID()
  admissionBatchId?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  mobileNumber?: string;

  @IsOptional()
  @IsString()
  nationalId?: string;

  @IsOptional()
  @IsUUID()
  nationalityLookupId?: string;

  @IsOptional()
  @IsUUID()
  bloodGroupLookupId?: string;

  @IsOptional()
  @IsUUID()
  religionLookupId?: string;

  @IsOptional()
  @IsUUID()
  categoryLookupId?: string;

  @IsOptional()
  @IsObject()
  address?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  guardianName?: string;

  @IsOptional()
  @IsString()
  guardianMobile?: string;

  @IsOptional()
  @IsString()
  admissionStatus?: string;

  @IsOptional()
  @IsDateString()
  admissionDate?: string;

  @IsOptional()
  @IsIn(['HOSTELLER', 'DAY_SCHOLAR'])
  residenceType?: string;

  @IsOptional()
  @IsString()
  hostelBlock?: string;

  @IsOptional()
  @IsString()
  hostelRoom?: string;
}

export class ValidateStudentImportDto {
  @IsOptional()
  @IsIn([...STUDENT_IMPORT_MODES])
  importMode?: StudentImportMode;
}

export class CommitStudentImportDto {
  @IsUUID()
  batchId!: string;

  @IsString()
  mode!: 'VALID_ONLY' | 'STRICT';

  @IsOptional()
  @IsIn([...STUDENT_IMPORT_MODES])
  importMode?: StudentImportMode;
}

export class UploadStudentDocumentDto {
  @IsString()
  documentType!: string;
}

export class AdmitFullStudentDto extends AdmitStudentDto {
  @IsOptional()
  @IsObject()
  sections?: Record<string, Record<string, unknown>>;
}

export class AdmitWithRegistrationDto extends AdmitFullStudentDto {
  @IsOptional()
  @IsObject()
  subjectSelections?: Record<string, string>;

  @IsOptional()
  @IsIn(['NONE', 'DRAFT', 'SUBMIT'])
  registrationAction?: 'NONE' | 'DRAFT' | 'SUBMIT';

  @IsOptional()
  @IsInt()
  @Min(1)
  semesterSequence?: number;

  @IsOptional()
  @IsBoolean()
  generateRollNumber?: boolean;

  @IsOptional()
  @IsBoolean()
  rollNumberAutoGenerated?: boolean;
}

export class GenerateRollNumberDto {
  @IsUUID()
  streamId!: string;

  @IsUUID()
  admissionBatchId!: string;

  @IsOptional()
  @IsBoolean()
  preview?: boolean;

  @IsOptional()
  @IsUUID()
  studentId?: string;
}

export class BulkGenerateRollNumbersDto {
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @IsOptional()
  @IsInt()
  admissionYear?: number;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  streamId?: string;

  @IsOptional()
  @IsInt()
  semesterNo?: number;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  excludeStudentIds?: string[];
}

export class CreateLifecycleEventDto {
  @IsUUID()
  studentId!: string;

  @IsString()
  eventType!: string;

  @IsDateString()
  effectiveDate!: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateStudentRemarkDto {
  @IsString()
  remarkType!: string;

  @IsString()
  body!: string;

  @IsOptional()
  @IsString()
  visibility?: string;
}

export class BulkAssignRfidDto {
  @IsObject()
  assignments!: Record<string, string>;
}

export class StudentListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  programVersionId?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsOptional()
  @IsUUID()
  batchId?: string;

  @IsOptional()
  @IsString()
  semester?: string;

  @IsOptional()
  @IsUUID()
  streamId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  categoryLookupId?: string;

  @IsOptional()
  @IsUUID()
  religionLookupId?: string;

  @IsOptional()
  @IsString()
  differentlyAbled?: string;

  @IsOptional()
  @IsString()
  studentStatus?: string;

  @IsOptional()
  @IsString()
  admissionType?: string;

  @IsOptional()
  @IsString()
  admissionStatus?: string;

  @IsOptional()
  @IsString()
  academicStatus?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  majorSubjectSlug?: string;

  @IsOptional()
  @IsString()
  minorSubjectSlug?: string;

  @IsOptional()
  @IsString()
  ids?: string;

  @IsOptional()
  @IsString()
  feeDue?: string;

  @IsOptional()
  @IsString()
  hostel?: string;

  @IsOptional()
  @IsString()
  attendanceShortage?: string;

  @IsOptional()
  @IsString()
  subjectPending?: string;

  @IsOptional()
  @IsString()
  rfidAssigned?: string;

  @IsOptional()
  @IsString()
  noPhoto?: string;

  @IsOptional()
  @IsString()
  noMobile?: string;

  @IsOptional()
  @IsString()
  recentlyAdded?: string;

  @IsOptional()
  @IsString()
  abcStatus?: string;

  @IsOptional()
  @IsString()
  operational?: string;
}

export class BulkAbcUploadRowDto {
  @IsString()
  rollNumber!: string;

  @IsString()
  abcId!: string;
}

export class BulkAbcUploadDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkAbcUploadRowDto)
  rows!: BulkAbcUploadRowDto[];
}

export class StudentExportQueryDto extends StudentListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  override limit?: number = 10000;
}

export function toStudentListQuery(query: StudentListQueryDto) {
  const { ids, ...rest } = query;
  return {
    ...rest,
    ids: ids ? ids.split(',').filter(Boolean) : undefined,
  };
}
