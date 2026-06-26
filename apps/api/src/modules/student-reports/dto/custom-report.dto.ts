import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { StudentReportFiltersDto } from './student-reports.dto';

export class CreateSavedReportDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  module?: string;

  @IsOptional()
  filters?: Record<string, unknown>;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  columns!: string[];

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection?: 'asc' | 'desc';

  @IsOptional()
  @IsString()
  groupBy?: string;
}

export class UpdateSavedReportDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  filters?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  columns?: string[];

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection?: 'asc' | 'desc';

  @IsOptional()
  @IsString()
  groupBy?: string;
}

export class TabularReportExportDto extends StudentReportFiltersDto {
  @IsOptional()
  @IsIn(['xlsx', 'csv'])
  format?: 'xlsx' | 'csv';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  columns?: string[];
}

export class ExecuteCustomReportDto extends TabularReportExportDto {
  @IsOptional()
  @IsString()
  name?: string;
}

export class RunSavedReportDto extends StudentReportFiltersDto {
  @IsOptional()
  @IsIn(['xlsx', 'csv'])
  format?: 'xlsx' | 'csv';
}

export class CreateScheduledReportDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsUUID()
  savedReportId!: string;

  @IsIn(['DAILY', 'WEEKLY', 'MONTHLY'])
  scheduleType!: 'DAILY' | 'WEEKLY' | 'MONTHLY';

  @IsOptional()
  @Type(() => Number)
  scheduleDay?: number;

  @IsOptional()
  @IsString()
  scheduleTime?: string;

  @IsOptional()
  @IsIn(['xlsx', 'csv'])
  format?: 'xlsx' | 'csv';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipientEmails?: string[];

  @IsOptional()
  filterOverrides?: Record<string, unknown>;
}

export class BuiltinReportQueryDto extends StudentReportFiltersDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  columns?: string[];

  @Type(() => Number)
  @IsOptional()
  limit?: number;
}

export class SavedReportIdParam {
  @IsUUID()
  id!: string;
}
