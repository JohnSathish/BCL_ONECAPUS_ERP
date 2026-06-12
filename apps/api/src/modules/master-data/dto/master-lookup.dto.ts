import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateMasterLookupDto {
  @IsString()
  lookupType!: string;

  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  label!: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  campusId?: string;
}

export class UpdateMasterLookupDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ReorderMasterLookupsDto {
  @IsString({ each: true })
  ids!: string[];
}
