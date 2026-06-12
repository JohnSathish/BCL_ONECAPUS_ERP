import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class StudentIdCardPrintRequestDto {
  @ApiProperty({ enum: ['NEW', 'REPRINT'] })
  @IsIn(['NEW', 'REPRINT'])
  requestType!: 'NEW' | 'REPRINT';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class CompletePrintRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  issueId?: string;
}

export class GenerateIdCardDto {
  @ApiProperty({
    enum: ['STUDENT', 'STAFF', 'CONTRACT', 'VISITING', 'RESEARCH'],
  })
  @IsIn(['STUDENT', 'STAFF', 'CONTRACT', 'VISITING', 'RESEARCH'])
  holderType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  staffProfileId?: string;
}

export class ReissueIdCardDto {
  @ApiProperty()
  @IsUUID()
  previousIssueId!: string;

  @ApiProperty({
    enum: [
      'LOST',
      'DAMAGED',
      'RFID_FAILURE',
      'NAME_CORRECTION',
      'DEPARTMENT_CHANGE',
    ],
  })
  @IsIn([
    'LOST',
    'DAMAGED',
    'RFID_FAILURE',
    'NAME_CORRECTION',
    'DEPARTMENT_CHANGE',
  ])
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  reissueFee?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class ReportLostCardDto {
  @ApiProperty()
  @IsUUID()
  issueId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class BulkGenerateIdCardsDto {
  @ApiProperty({ enum: ['STUDENT', 'STAFF'] })
  @IsIn(['STUDENT', 'STAFF'])
  holderType!: 'STUDENT' | 'STAFF';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  programme?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  semester?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  batch?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  studentIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  staffProfileIds?: string[];

  @ApiPropertyOptional({
    description:
      'Filter staff bulk generate by staff type (e.g. TEACHING, NON_TEACHING)',
  })
  @IsOptional()
  @IsString()
  staffType?: string;
}

export class UpdateIdCardSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  qrPrefix?: string;

  @ApiPropertyOptional()
  @IsOptional()
  validityYears?: number;

  @ApiPropertyOptional()
  @IsOptional()
  showBloodGroup?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  showRfidOnCard?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  institutionSignatureUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  watermarkEnabled?: boolean;
}

export class UpdateIdCardTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Layout v1 JSON with front/back element arrays',
  })
  @IsOptional()
  @IsObject()
  layout?: Record<string, unknown>;
}

export class CreateIdCardTemplateDto {
  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  holderType!: string;

  @ApiProperty({ description: 'Layout v1 JSON with front/back element arrays' })
  @IsObject()
  layout!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  setAsDefault?: boolean;
}

export class RenderIdCardPdfDto {
  @ApiProperty({
    description: 'Self-contained HTML document for CR80 portrait card(s)',
  })
  @IsString()
  html!: string;

  @ApiPropertyOptional({
    description: 'Include alignment grid and corner marks',
  })
  @IsOptional()
  @IsBoolean()
  testMode?: boolean;

  @ApiPropertyOptional({
    description:
      'Number of CR80 pages in the document (extends render timeout for bulk exports)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  pageCount?: number;
}
