import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { StaffDirectoryQueryDto } from '../../dto/staff.dto';

export const STAFF_BULK_MATCHING_KEYS = [
  'employeeCode',
  'shortCode',
  'portalEmail',
  'staffId',
] as const;

export type StaffBulkMatchingKey = (typeof STAFF_BULK_MATCHING_KEYS)[number];

export class StaffBulkUpdateScopeDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  staffIds?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => StaffDirectoryQueryDto)
  filter?: StaffDirectoryQueryDto;
}

export class StaffBulkUpdatePreviewDto {
  @ValidateNested()
  @Type(() => StaffBulkUpdateScopeDto)
  scope!: StaffBulkUpdateScopeDto;

  @IsArray()
  @IsString({ each: true })
  fieldKeys!: string[];

  @IsIn(['REPLACE', 'APPEND', 'CSV'])
  updateMode!: 'REPLACE' | 'APPEND' | 'CSV';

  @IsOptional()
  @IsIn(STAFF_BULK_MATCHING_KEYS)
  matchingKey?: StaffBulkMatchingKey;

  @IsOptional()
  @IsObject()
  values?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  csvRows?: Record<string, string>[];
}

export class StaffBulkUpdateApplyDto {
  @IsUUID()
  batchId!: string;

  @IsOptional()
  @IsBoolean()
  forceApply?: boolean;
}

export class StaffBulkUpdateRowsDto {
  @IsArray()
  @IsString({ each: true })
  fieldKeys!: string[];

  @IsOptional()
  @IsIn(STAFF_BULK_MATCHING_KEYS)
  matchingKey?: StaffBulkMatchingKey;

  @IsArray()
  rows!: Record<string, string>[];
}

export class StaffBulkUpdateTemplateQueryDto extends StaffDirectoryQueryDto {
  @IsString()
  fields!: string;

  @IsOptional()
  @IsIn(STAFF_BULK_MATCHING_KEYS)
  matchingKey?: StaffBulkMatchingKey;

  @IsOptional()
  @IsIn(['COMPACT', 'ASSISTED'])
  templateMode?: 'COMPACT' | 'ASSISTED';
}
