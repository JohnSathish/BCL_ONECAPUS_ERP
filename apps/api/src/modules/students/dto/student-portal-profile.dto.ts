import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';
export const STUDENT_PORTAL_CHANGE_SECTIONS = ['contact', 'parent'] as const;

export type StudentPortalChangeSection =
  (typeof STUDENT_PORTAL_CHANGE_SECTIONS)[number];

export class StudentPortalChangeRequestDto {
  @ApiProperty({ enum: STUDENT_PORTAL_CHANGE_SECTIONS })
  @IsIn([...STUDENT_PORTAL_CHANGE_SECTIONS])
  section!: StudentPortalChangeSection;

  @ApiProperty({ description: 'Field-level changes keyed by field name' })
  @IsObject()
  changes!: Record<string, string | null>;
}

export class UploadStudentPortalDocumentDto {
  @ApiProperty({
    example: 'AADHAAR',
    description: 'AADHAAR | PAN | TC | MIGRATION | PHOTO | SIGNATURE',
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
