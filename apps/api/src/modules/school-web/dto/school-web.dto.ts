import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class PatchSchoolWebSiteDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  shortName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  motto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  district?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  pin?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  primaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  accentColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  seoDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  applyCtaUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  studentPortalUrl?: string;

  @IsOptional()
  @IsObject()
  extrasJson?: Record<string, unknown>;
}

export class SchoolWebMenuItemInputDto {
  @IsString()
  @MaxLength(80)
  label!: string;

  @IsString()
  @MaxLength(240)
  href!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  parentId?: string;
}

export class ReplaceSchoolWebMenuDto {
  @IsIn(['MAIN', 'FOOTER', 'QUICK'])
  location!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SchoolWebMenuItemInputDto)
  items!: SchoolWebMenuItemInputDto[];
}

export class PatchHomepageSectionDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

export class UpsertSchoolWebPageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  slug!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED', 'SCHEDULED'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  seoDescription?: string;

  @IsOptional()
  @IsObject()
  blockDocument?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  seoJson?: Record<string, unknown>;
}

export class UpsertSchoolWebNoticeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  slug!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  category?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(8000)
  body!: string;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED'])
  status?: string;

  @IsOptional()
  @IsObject()
  seoJson?: Record<string, unknown>;
}

export class SubmitSchoolWebEnquiryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  subject?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(4000)
  message!: string;
}

export class PatchEnquiryStatusDto {
  @IsIn(['NEW', 'READ', 'ARCHIVED'])
  status!: string;
}

export class UpsertSchoolWebEventDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  slug!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(800)
  summary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  venue?: string;

  @IsString()
  startsAt!: string;

  @IsOptional()
  @IsString()
  endsAt?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED'])
  status?: string;

  @IsOptional()
  @IsObject()
  seoJson?: Record<string, unknown>;
}

export class SchoolWebPresenceHeartbeatDto {
  @IsString()
  @MinLength(36)
  @MaxLength(36)
  sessionId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  path?: string;
}

export class UpsertSchoolWebGalleryAlbumDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string;

  @IsString()
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  eventName?: string;

  @IsOptional()
  @IsString()
  eventDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED'])
  status?: string;

  @IsOptional()
  @IsIn(['PUBLIC', 'PRIVATE', 'STAFF'])
  visibility?: string;

  @IsOptional()
  @IsBoolean()
  allowDownload?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  academicYear?: string;

  @IsOptional()
  @IsString()
  scheduledAt?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagIds?: string[];

  @IsOptional()
  @IsObject()
  seoJson?: Record<string, unknown>;
}

export class SchoolWebGalleryBulkAlbumsDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];

  @IsIn(['PUBLISHED', 'UNPUBLISHED', 'ARCHIVED', 'DELETE'])
  action!: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsIn(['PUBLIC', 'PRIVATE', 'STAFF'])
  visibility?: string;
}

export class SchoolWebGalleryReorderDto {
  @IsArray()
  @IsString({ each: true })
  itemIds!: string[];
}

export class PatchSchoolWebGalleryItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  caption?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  altText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  credit?: string;

  @IsOptional()
  @IsString()
  moveToAlbumId?: string;
}

export class SchoolWebGalleryBulkItemsDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];

  @IsIn(['DELETE', 'MOVE'])
  action!: string;

  @IsOptional()
  @IsString()
  albumId?: string;
}

export class UpsertSchoolWebGalleryTaxonomyDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}
