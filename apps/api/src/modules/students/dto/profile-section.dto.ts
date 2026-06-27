import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AddressDto {
  @IsOptional() @IsString() line1?: string;
  @IsOptional() @IsString() line2?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() pinCode?: string;
}

export class UpdateBasicSectionDto {
  @IsOptional() @IsString() applicationNumber?: string;
  @IsOptional() @IsString() admissionNumber?: string;
  @IsOptional() @IsString() enrollmentNumber?: string;
  @IsOptional() @IsString() rollNumber?: string;
  @IsOptional() @IsString() universityRollNumber?: string;
  @IsOptional() @IsString() universityRegistrationNumber?: string;
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() mobileNumber?: string;
  @IsOptional() @IsString() dateOfBirth?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsString() maritalStatus?: string;
  @IsOptional() @IsUUID() bloodGroupLookupId?: string;
  @IsOptional() @IsString() studentStatus?: string;
  @IsOptional() @IsUUID() programVersionId?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsUUID() primaryShiftId?: string;
  @IsOptional() @IsUUID() admissionBatchId?: string;
  @IsOptional() @IsString() rfidNumber?: string;
  @IsOptional() @IsString() abcId?: string;
}

export class UpdateCategorySectionDto {
  @IsOptional() @IsUUID() categoryLookupId?: string;
  @IsOptional() @IsUUID() religionLookupId?: string;
  @IsOptional() @IsUUID() tribeLookupId?: string;
  @IsOptional() @IsUUID() denominationLookupId?: string;
  @IsOptional() @IsBoolean() differentlyAbled?: boolean;
  @IsOptional() @IsBoolean() ews?: boolean;
  @IsOptional() @IsUUID() nationalityLookupId?: string;
}

export class UpdateAddressSectionDto {
  @IsOptional() @ValidateNested() @Type(() => AddressDto) tura?: AddressDto;
  @IsOptional() @ValidateNested() @Type(() => AddressDto) home?: AddressDto;
  @IsOptional() @IsBoolean() homeSameAsTura?: boolean;
}

export class GuardianDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsInt() age?: number;
  @IsOptional() @IsString() occupation?: string;
  @IsOptional() @IsString() contactNumber?: string;
  @IsOptional() @IsEmail() email?: string;
}

export class UpdateGuardiansSectionDto {
  @IsOptional() @ValidateNested() @Type(() => GuardianDto) father?: GuardianDto;
  @IsOptional() @ValidateNested() @Type(() => GuardianDto) mother?: GuardianDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => GuardianDto)
  localGuardian?: GuardianDto;
}

export class BoardSubjectMarkDto {
  @IsString() subjectName!: string;
  @IsOptional() @IsInt() marksObtained?: number;
  @IsOptional() @IsInt() maxMarks?: number;
}

export class UpdateBoardExamSectionDto {
  @IsOptional() @IsString() boardName?: string;
  @IsOptional() @IsString() schoolName?: string;
  @IsOptional() @IsString() boardRollNumber?: string;
  @IsOptional() @IsInt() examYear?: number;
  @IsOptional() @IsString() stream?: string;
  @IsOptional() @IsString() registrationType?: string;
  @IsOptional() @IsInt() totalMarks?: number;
  @IsOptional() @IsNumber() percentage?: number;
  @IsOptional() @IsString() division?: string;
  @IsOptional() @IsUUID() marksheetDocumentId?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BoardSubjectMarkDto)
  subjectMarks?: BoardSubjectMarkDto[];
}

export class UpdateCuetSectionDto {
  @IsOptional() @IsBoolean() cuetApplied?: boolean;
  @IsOptional() @IsString() cuetRollNumber?: string;
  @IsOptional() @IsNumber() cuetScore?: number;
  @IsOptional() cuetSubjects?: unknown;
}

export class UpdateAcademicSectionDto {
  @IsOptional() @IsUUID() streamId?: string;
  @IsOptional() @IsUUID() admissionBatchId?: string;
  @IsOptional() @IsUUID() admissionYearId?: string;
  @IsOptional() @IsString() majorSubjectSlug?: string;
  @IsOptional() @IsString() minorSubjectSlug?: string;
  @IsOptional() @IsString() admissionType?: string;
  @IsOptional() @IsString() admissionCategory?: string;
  @IsOptional() class12Subjects?: unknown;
  @IsOptional() @IsIn(['HOSTELLER', 'DAY_SCHOLAR']) residenceType?: string;
  @IsOptional() @IsString() hostelBlock?: string;
  @IsOptional() @IsString() hostelRoom?: string;
}

export class VerifyDocumentDto {
  @IsString() verificationStatus!: 'VERIFIED' | 'REJECTED';
  @IsOptional() @IsString() verificationRemarks?: string;
}

export class ProfileFieldConfigDto {
  @IsString() sectionKey!: string;
  @IsString() fieldKey!: string;
  @IsOptional() @IsBoolean() visible?: boolean;
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @IsBoolean() editable?: boolean;
  @IsOptional() @IsBoolean() studentEditable?: boolean;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export class UpsertProfileFieldConfigDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProfileFieldConfigDto)
  fields!: ProfileFieldConfigDto[];
}
