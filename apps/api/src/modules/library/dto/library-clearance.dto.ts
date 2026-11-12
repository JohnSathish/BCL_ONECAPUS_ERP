import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const STATUSES = ['ALL', 'CLEARED', 'PENDING', 'NOT_PROCESSED'] as const;

export class ClearanceListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  academicYear?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  examinationName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  semester?: number;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  programId?: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number] = 'ALL';
}

export class ClearanceStudentSearchDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}

export class ClearancePreviewQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  academicYear?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  examinationName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  semester?: number;
}

export class SaveClearanceDto {
  @IsUUID()
  studentId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  academicYear!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  examinationName!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  semester!: number;

  @IsIn(['PENDING', 'CLEARED'])
  status!: 'PENDING' | 'CLEARED';

  @IsIn(['YES', 'NO'])
  booksReturned!: 'YES' | 'NO';

  @IsIn(['CLEARED', 'PENDING'])
  duesStatus!: 'CLEARED' | 'PENDING';

  @IsIn(['CLEARED', 'PENDING'])
  lostDamagedStatus!: 'CLEARED' | 'PENDING';

  @IsIn(['CLEARED', 'NOT_CLEARED'])
  accountStatus!: 'CLEARED' | 'NOT_CLEARED';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remarks?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  librarianName?: string;

  @IsOptional()
  @IsDateString()
  clearedOn?: string;
}

export class UpdateClearanceDto {
  @IsIn(['PENDING', 'CLEARED'])
  status!: 'PENDING' | 'CLEARED';

  @IsIn(['YES', 'NO'])
  booksReturned!: 'YES' | 'NO';

  @IsIn(['CLEARED', 'PENDING'])
  duesStatus!: 'CLEARED' | 'PENDING';

  @IsIn(['CLEARED', 'PENDING'])
  lostDamagedStatus!: 'CLEARED' | 'PENDING';

  @IsIn(['CLEARED', 'NOT_CLEARED'])
  accountStatus!: 'CLEARED' | 'NOT_CLEARED';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remarks?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  librarianName?: string;

  @IsOptional()
  @IsDateString()
  clearedOn?: string;
}

export class BulkClearanceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  academicYear!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  examinationName!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  semester!: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(400)
  @IsUUID('4', { each: true })
  studentIds?: string[];

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  programId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  librarianName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remarks?: string;

  @IsOptional()
  @IsDateString()
  clearedOn?: string;
}

export class ClearancePrintDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  ids!: string[];

  @IsOptional()
  @IsIn(['single', 'pair'])
  layout?: 'single' | 'pair';

  @IsOptional()
  @IsBoolean()
  autoPrint?: boolean;
}
