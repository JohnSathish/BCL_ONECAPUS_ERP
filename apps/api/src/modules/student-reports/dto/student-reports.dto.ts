import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class StudentReportFiltersDto {
  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @IsOptional()
  @IsUUID()
  campusId?: string;

  @IsOptional()
  @IsUUID()
  programVersionId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @IsUUID()
  batchId?: string;

  @IsOptional()
  @IsUUID()
  streamId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  semester?: number;

  @IsOptional()
  @IsString()
  academicYear?: string;

  @IsOptional()
  @IsString()
  admissionStatus?: string;

  @IsOptional()
  @IsString()
  studentStatus?: string;
}

export class StudentReportExportDto extends StudentReportFiltersDto {
  @IsString()
  reportType!: string;

  @IsIn(['xlsx', 'csv'])
  format!: 'xlsx' | 'csv';
}
