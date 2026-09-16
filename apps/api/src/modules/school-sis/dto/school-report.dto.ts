import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class SchoolReportExportDto {
  @IsString()
  key!: string;

  @IsIn(['pdf', 'xlsx', 'html', 'csv'])
  format!: 'pdf' | 'xlsx' | 'html' | 'csv';

  @IsOptional()
  @IsObject()
  filters?: Record<string, string>;

  @IsOptional()
  @IsIn(['portrait', 'landscape'])
  orientation?: 'portrait' | 'landscape';

  @IsOptional()
  @IsString()
  generatedBy?: string;
}
