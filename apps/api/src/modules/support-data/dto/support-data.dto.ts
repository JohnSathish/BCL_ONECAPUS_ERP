import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class SupportDataListQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  group?: string;

  @IsOptional()
  @IsString()
  activeOnly?: string;

  @IsOptional()
  @IsUUID()
  campusId?: string;

  @IsOptional()
  @IsUUID()
  institutionId?: string;
}

export class SupportDataCreateDto {
  @IsObject()
  data!: Record<string, unknown>;
}

export class SupportDataUpdateDto {
  @IsObject()
  data!: Record<string, unknown>;
}

export class SupportDataStatusDto {
  @IsBoolean()
  isActive!: boolean;
}

export class SupportDataReorderDto {
  @IsArray()
  @IsUUID('4', { each: true })
  ids!: string[];
}

export class SupportDataImportCommitDto {
  @IsArray()
  rows!: Record<string, unknown>[];
}
