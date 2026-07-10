import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { PORTAL_DOCUMENT_TYPES } from '../domain/profile-update-policy.defaults';

export const STUDENT_PORTAL_CHANGE_SECTIONS = [
  'personal',
  'contact',
  'address',
  'guardians',
  'bank',
  'emergency',
  'class_xii',
  'parent',
] as const;

export type StudentPortalChangeSection =
  (typeof STUDENT_PORTAL_CHANGE_SECTIONS)[number];

export class StudentPortalChangeRequestDto {
  @ApiProperty({ enum: STUDENT_PORTAL_CHANGE_SECTIONS })
  @IsIn([...STUDENT_PORTAL_CHANGE_SECTIONS])
  section!: StudentPortalChangeSection;

  @ApiProperty({ description: 'Field-level changes keyed by field name' })
  @IsObject()
  changes!: Record<string, unknown>;
}

export class StudentProfileChangeItemDto {
  @IsString()
  sectionKey!: string;

  @IsString()
  fieldKey!: string;

  newValue?: unknown;
}

export class SubmitProfileChangesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudentProfileChangeItemDto)
  changes!: StudentProfileChangeItemDto[];
}

export class ClassXiiSubjectDto {
  @IsString()
  subjectName!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  marksObtained?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxMarks?: number | null;

  @IsOptional()
  @IsString()
  grade?: string | null;
}

export class UpsertClassXiiDto {
  @IsOptional()
  @IsString()
  boardName?: string | null;

  @IsOptional()
  @IsString()
  schoolName?: string | null;

  @IsOptional()
  @IsString()
  boardRollNumber?: string | null;

  @IsOptional()
  @IsString()
  registrationNumber?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  examYear?: number | null;

  @IsOptional()
  @IsString()
  stream?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  totalMarks?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maximumMarks?: number | null;

  @IsOptional()
  @IsString()
  grade?: string | null;

  @IsOptional()
  @IsString()
  division?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClassXiiSubjectDto)
  subjects?: ClassXiiSubjectDto[];
}

export class UpdateAbcIdDto {
  @IsString()
  abcId!: string;
}

export class UploadStudentPortalDocumentDto {
  @ApiProperty({
    example: 'AADHAAR',
    description: PORTAL_DOCUMENT_TYPES.join(' | '),
  })
  @IsString()
  documentType!: string;
}

export const ID_CARD_PRINT_REQUEST_TYPES = ['NEW', 'REPRINT'] as const;
export type IdCardPrintRequestType =
  (typeof ID_CARD_PRINT_REQUEST_TYPES)[number];

export class StudentIdCardPrintRequestDto {
  @ApiProperty({ enum: ID_CARD_PRINT_REQUEST_TYPES })
  @IsIn([...ID_CARD_PRINT_REQUEST_TYPES])
  requestType!: IdCardPrintRequestType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}

export class ReviewProfileChangeDto {
  @IsIn(['APPROVE', 'REJECT', 'NEEDS_INFO'])
  action!: 'APPROVE' | 'REJECT' | 'NEEDS_INFO';

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class BulkReviewProfileChangesDto {
  @IsArray()
  @IsUUID('4', { each: true })
  requestIds!: string[];

  @IsIn(['APPROVE', 'REJECT', 'NEEDS_INFO'])
  action!: 'APPROVE' | 'REJECT' | 'NEEDS_INFO';

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class ProfileSoftGateSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minCompletionPercent?: number;

  @IsOptional()
  @IsBoolean()
  remindOnLogin?: boolean;

  @IsOptional()
  @IsBoolean()
  softBlockRegistration?: boolean;

  @IsOptional()
  @IsBoolean()
  softBlockCertificates?: boolean;
}

export class UpsertProfileUpdatePolicyDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProfileUpdatePolicyRowDto)
  rows!: ProfileUpdatePolicyRowDto[];
}

export class ProfileUpdatePolicyRowDto {
  @IsString()
  sectionKey!: string;

  @IsString()
  fieldKey!: string;

  @IsOptional()
  @IsIn([
    'AUTO_APPROVE',
    'APPROVAL_REQUIRED',
    'VERIFICATION_REQUIRED',
    'READ_ONLY',
  ])
  approvalMode?:
    | 'AUTO_APPROVE'
    | 'APPROVAL_REQUIRED'
    | 'VERIFICATION_REQUIRED'
    | 'READ_ONLY';

  @IsOptional()
  @IsBoolean()
  mandatory?: boolean;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class ProfileVerificationQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsString()
  sectionKey?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  take?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['json', 'xlsx', 'csv'])
  format?: 'json' | 'xlsx' | 'csv';
}
