import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class WebsiteSettingsDto {
  @IsString()
  @MaxLength(200)
  siteName!: string;

  @IsOptional() @IsString() @MaxLength(300) tagline?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) description?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) logoUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) faviconUrl?: string | null;
  @IsString() @MaxLength(30) primaryColor!: string;
  @IsString() @MaxLength(30) secondaryColor!: string;
  @IsString() @MaxLength(100) fontFamily!: string;
  @IsOptional() @IsString() @MaxLength(300) contactEmail?: string | null;
  @IsOptional() @IsString() @MaxLength(100) contactPhone?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) address?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) mapUrl?: string | null;
  @IsObject() socialLinks!: Record<string, string>;
}

export class AdminWebsitePageDto {
  @IsOptional() @IsUUID() id?: string;
  @IsOptional() @IsString() @MaxLength(300) title?: string;
  @IsOptional() @IsString() @MaxLength(500) slug?: string;
  @IsOptional() @IsString() @MaxLength(1000) excerpt?: string | null;
  @IsOptional()
  @IsIn(['DRAFT', 'IN_REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'])
  status?: string;
  @IsOptional() @IsString() @MaxLength(100) template?: string;
  @IsOptional() @IsString() @MaxLength(300) seoTitle?: string | null;
  @IsOptional()
  @IsString()
  @MaxLength(500)
  seoDescription?: string | null;
  @IsOptional() @IsArray() sections?: Array<Record<string, unknown>>;
  @IsOptional() @IsString() updatedAt?: string;
  @IsOptional() @IsString() publishedAt?: string | null;
}

export class WebsiteSectionDto {
  @IsOptional() @IsString() @MaxLength(100) type?: string;
  @IsOptional() @IsString() @MaxLength(200) label?: string;
  @IsOptional() @IsString() @MaxLength(500) heading?: string | null;
  @IsOptional() @IsString() bodyHtml?: string | null;
  @IsOptional() @IsObject() settings?: Record<string, unknown>;
  @IsOptional() position?: number;
  @IsOptional() @IsBoolean() isVisible?: boolean;
}

export class ReorderWebsiteSectionsDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  sectionIds!: string[];
}

export class UpdateWebsiteMenuDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsIn(['HEADER', 'FOOTER', 'UTILITY']) location?: string;
  @IsOptional() @IsArray() items?: Array<Record<string, unknown>>;
}

export class CreateWebsiteContentTypeDto {
  @IsString() @MaxLength(200) name!: string;
  @IsString() @MaxLength(100) slug!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string | null;
  @IsArray() fields!: Array<Record<string, unknown>>;
  @IsOptional() @IsInt() entryCount?: number;
}

export class WebsiteContentEntryDto {
  @IsOptional() @IsString() @MaxLength(300) title?: string;
  @IsOptional() @IsString() @MaxLength(200) slug?: string;
  @IsOptional()
  @IsIn(['DRAFT', 'IN_REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'])
  status?: string;
  @IsOptional() @IsObject() data?: Record<string, unknown>;
  @IsOptional() @IsString() scheduledAt?: string | null;
  /** Backdate / pin publish date when status is PUBLISHED */
  @IsOptional() @IsString() publishedAt?: string | null;
}

export class UpdateWebsiteMediaDto {
  @IsOptional() @IsUUID() id?: string;
  @IsOptional() @IsString() @MaxLength(500) altText?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) caption?: string | null;
  @IsOptional() @IsString() @MaxLength(500) fileName?: string;
  @IsOptional() @IsString() mimeType?: string;
  @IsOptional() @IsString() publicUrl?: string;
  @IsOptional() @IsInt() size?: number;
  @IsOptional() @IsString() createdAt?: string;
}

export class CreateWebsitePreviewDto {
  @IsOptional() @IsUUID() pageId?: string;
}

export class PublishWebsiteDto {
  @IsOptional() @IsUUID() pageId?: string;
  @IsOptional() @IsString() scheduledAt?: string;
}

export class UpsertWebsiteDepartmentProfileDto {
  @IsOptional() @IsString() @MaxLength(120) slug?: string;
  @IsOptional()
  @IsIn(['ARTS', 'SCIENCE', 'COMMERCE', 'PROFESSIONAL'])
  category?: string;
  @IsOptional() @IsString() @MaxLength(500) tagline?: string;
  @IsOptional() @IsString() aboutText?: string;
  @IsOptional() @IsString() aboutHtml?: string;
  @IsOptional() @IsString() @MaxLength(2000) bannerUrl?: string | null;
  @IsOptional() galleryJson?: unknown;
  @IsOptional() @IsString() @MaxLength(300) contactEmail?: string | null;
  @IsOptional() @IsString() @MaxLength(100) contactPhone?: string | null;
  @IsOptional() @IsString() @MaxLength(500) officeLocation?: string | null;
  @IsOptional() @IsInt() establishedYear?: number | null;
  @IsOptional() @IsBoolean() showOnWebsite?: boolean;
  @IsOptional() @IsInt() displayOrder?: number;
  @IsOptional() featuredFacultyIds?: unknown;
  @IsOptional() downloadsJson?: unknown;
  @IsOptional() @IsString() hodMessage?: string;
}

export class UpdateStaffWebsiteVisibilityDto {
  @IsOptional() @IsBoolean() showOnWebsite?: boolean;
  @IsOptional() @IsString() @MaxLength(120) websiteSlug?: string | null;
  @IsOptional() @IsString() @MaxLength(300) publicEmail?: string | null;
  @IsOptional() @IsString() @MaxLength(100) publicPhone?: string | null;
  @IsOptional() @IsString() @MaxLength(500) officeLocation?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) googleScholarUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) orcidUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) researchAreas?: string | null;
}

export class UpdateWebsiteHeroSlideDto {
  @IsOptional() @IsString() @MaxLength(500) altText?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MaxLength(2000) desktopUrl?: string;
  @IsOptional() @IsString() @MaxLength(2000) mobileUrl?: string | null;
}

export class ReorderWebsiteHeroSlidesDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  slideIds!: string[];
}
