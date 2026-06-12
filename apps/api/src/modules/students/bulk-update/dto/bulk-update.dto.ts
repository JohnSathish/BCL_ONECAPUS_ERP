import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { StudentListQueryDto } from '../../dto/students.dto';

export class BulkUpdateScopeDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  studentIds?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => StudentListQueryDto)
  filter?: StudentListQueryDto;
}

export class BulkUpdatePreviewDto {
  @ValidateNested()
  @Type(() => BulkUpdateScopeDto)
  scope!: BulkUpdateScopeDto;

  @IsArray()
  @IsString({ each: true })
  fieldKeys!: string[];

  @IsIn(['REPLACE', 'APPEND', 'CSV'])
  updateMode!: 'REPLACE' | 'APPEND' | 'CSV';

  @IsOptional()
  @IsObject()
  values?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  csvRows?: Record<string, string>[];

  @IsOptional()
  @IsBoolean()
  allowVtcOverride?: boolean;
}

export class BulkUpdateApplyDto {
  @IsUUID()
  batchId!: string;

  @IsOptional()
  @IsBoolean()
  forceApply?: boolean;
}

export class BulkUpdateCsvImportDto {
  @IsArray()
  @IsString({ each: true })
  fieldKeys!: string[];

  @IsArray()
  csvRows!: Record<string, string>[];
}
