import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class OpacSearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsIn([
    'all',
    'title',
    'author',
    'isbn',
    'accession',
    'call',
    'subject',
    'department',
    'publisher',
  ])
  field?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(40)
  limit?: number;

  @IsOptional()
  @IsIn(['title', 'title_desc', 'recent', 'author', 'borrowed'])
  sort?: string;

  @IsOptional()
  @IsIn(['available', 'borrowed', 'reference'])
  availability?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  year?: string;

  @IsOptional()
  @IsIn(['book', 'journal'])
  material?: string;
}

export class OpacReserveDto {
  @IsUUID()
  bookId!: string;
}

export class OpacRenewDto {
  @IsString()
  @MaxLength(80)
  barcode!: string;
}

export class OpacHourDto {
  @IsString()
  @MaxLength(40)
  label!: string;

  @IsString()
  @MaxLength(40)
  hours!: string;
}

export class OpacNoticeDto {
  @IsString()
  @MaxLength(280)
  text!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  date?: string;
}

export class UpdateOpacSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  publicSearch?: boolean;

  @IsOptional()
  @IsBoolean()
  studentLogin?: boolean;

  @IsOptional()
  @IsBoolean()
  staffLogin?: boolean;

  @IsOptional()
  @IsBoolean()
  reservation?: boolean;

  @IsOptional()
  @IsBoolean()
  renewal?: boolean;

  @IsOptional()
  @IsBoolean()
  showFines?: boolean;

  @IsOptional()
  @IsBoolean()
  digital?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  maxReservations?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  reservationDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactEmail?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpacHourDto)
  hours?: OpacHourDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpacNoticeDto)
  announcements?: OpacNoticeDto[];
}
