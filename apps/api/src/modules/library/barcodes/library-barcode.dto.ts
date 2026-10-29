import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class BarcodeCopyQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  publisher?: string;

  @IsOptional()
  @IsString()
  year?: string;

  @IsOptional()
  @IsString()
  edition?: string;

  @IsOptional()
  @IsIn(['CONFIRMED', 'UNPRINTED', 'NOT_PRINTABLE'])
  printStatus?: 'CONFIRMED' | 'UNPRINTED' | 'NOT_PRINTABLE';

  @IsOptional()
  @IsString()
  accessionFrom?: string;

  @IsOptional()
  @IsString()
  accessionTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class BarcodePreviewDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  copyIds!: string[];
}

export class CreateBarcodeJobDto extends BarcodePreviewDto {
  @IsIn(['INDIVIDUAL', 'BULK', 'REPRINT'])
  mode!: 'INDIVIDUAL' | 'BULK' | 'REPRINT';
}

export class UpdateBarcodeJobDto {
  @IsIn(['DIALOG_OPENED', 'USER_CONFIRMED'])
  status!: 'DIALOG_OPENED' | 'USER_CONFIRMED';
}

export class LabelSettingsDto {
  @IsIn(['A4_2X4', 'SINGLE', 'CUSTOM', 'ROLL'])
  preset!: 'A4_2X4' | 'SINGLE' | 'CUSTOM' | 'ROLL';

  @Type(() => Number)
  @IsNumber()
  @Min(20)
  @Max(500)
  pageWidthMm!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(20)
  @Max(500)
  pageHeightMm!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(6)
  columns!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  rows!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(40)
  marginTopMm!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(40)
  marginRightMm!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(40)
  marginBottomMm!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(40)
  marginLeftMm!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(20)
  gapXMm!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(20)
  gapYMm!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(20)
  @Max(200)
  labelWidthMm!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(15)
  @Max(200)
  labelHeightMm!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(6)
  @Max(40)
  barcodeHeightMm!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.8)
  @Max(3)
  moduleWidth!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(6)
  @Max(14)
  fontSizePt!: number;

  @IsBoolean()
  showLogo!: boolean;

  @IsBoolean()
  showTitle!: boolean;

  @IsBoolean()
  showAuthor!: boolean;

  @IsBoolean()
  showDepartment!: boolean;

  @IsBoolean()
  showCallNumber!: boolean;

  @IsBoolean()
  showAccession!: boolean;

  @IsString()
  headerTitle!: string;

  @IsString()
  headerSubtitle!: string;

  @IsString()
  headerCode!: string;
}
