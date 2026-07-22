import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateWebsiteSiteDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  slug?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  primaryDomain?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  logoUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  faviconUrl?: string | null;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}

export class CreateWebsitePageDto {
  @IsString()
  @MaxLength(500)
  path!: string;

  @IsString()
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  excerpt?: string;

  @IsOptional()
  @IsString()
  bodyHtml?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  seoDescription?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  seoKeywords?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  changeNote?: string;
}

export class UpdateWebsitePageDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  path?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  excerpt?: string | null;

  @IsOptional()
  @IsString()
  bodyHtml?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  seoTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  seoDescription?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  seoKeywords?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  changeNote?: string;
}

export class ListWebsitePagesQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  status?: string;

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

export class PublishWebsitePageDto {
  @IsOptional()
  @IsUUID()
  revisionId?: string;
}

export class UpsertWebsiteRedirectDto {
  @IsString()
  @MaxLength(500)
  fromPath!: string;

  @IsString()
  @MaxLength(2000)
  toPath!: string;

  @IsOptional()
  @IsIn([301, 302, 307, 308])
  statusCode?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UploadWebsiteMediaDto {
  @IsOptional()
  @IsIn(['IMAGE', 'DOCUMENT'])
  kind?: 'IMAGE' | 'DOCUMENT';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  altText?: string;
}
