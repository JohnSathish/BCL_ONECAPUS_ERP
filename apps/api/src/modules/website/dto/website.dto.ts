import { Type, Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
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

export class CreateWebsiteBloodDonorDto {
  @IsString()
  @MaxLength(120)
  fullName!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateOfBirth!: string;

  @IsIn(['Male', 'Female', 'Other'])
  gender!: string;

  @IsString()
  @MaxLength(30)
  phone!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @IsIn(['Email', 'Phone', 'WhatsApp'])
  preferredContact?: string;

  @IsIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
  bloodGroup!: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined,
  )
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  lastDonationDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  streetAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  pincode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  medicalNotes?: string;

  @IsBoolean()
  eligible!: boolean;

  /** Honeypot — must be empty when present. */
  @IsOptional()
  @IsString()
  @MaxLength(0)
  company?: string;
}

export class ListWebsiteBloodDonorsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;
}

export class CreateWebsiteNewsletterDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  source?: string;

  /** Honeypot — must be empty when present. */
  @IsOptional()
  @IsString()
  @MaxLength(0)
  company?: string;
}

export class ListWebsiteNewsletterQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  take?: number;

  @IsOptional()
  @IsIn(['ACTIVE', 'UNSUBSCRIBED', 'ALL'])
  status?: string;
}

export class UpdateWebsiteNewsletterStatusDto {
  @IsIn(['ACTIVE', 'UNSUBSCRIBED'])
  status!: string;
}

export class CreateWebsiteFyugInterestDto {
  @IsString()
  @MaxLength(160)
  fullName!: string;

  @IsIn(['Male', 'Female'])
  gender!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateOfBirth!: string;

  @IsString()
  @MaxLength(30)
  mobile!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  whatsapp?: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MaxLength(80)
  state!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  district?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  pinCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  bloodGroup?: string;

  @IsString()
  @MaxLength(120)
  fatherName!: string;

  @IsString()
  @MaxLength(30)
  fatherMobile!: string;

  @IsString()
  @MaxLength(120)
  motherName!: string;

  @IsString()
  @MaxLength(30)
  motherMobile!: string;

  @IsString()
  @MaxLength(200)
  collegeLastAttended!: string;

  @IsString()
  @MaxLength(200)
  affiliatedUniversity!: string;

  @IsString()
  @MaxLength(80)
  majorCourse!: string;

  @IsString()
  @MaxLength(80)
  minorCourse!: string;

  @IsString()
  @MaxLength(80)
  applyingHonoursIn!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  cuetScore?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cgpaSemesterV?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  percentageSemesterV?: string;

  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === 'yes' || normalized === '1')
        return true;
      if (normalized === 'false' || normalized === 'no' || normalized === '0')
        return false;
    }
    return value;
  })
  @IsBoolean()
  hasBackPapers!: boolean;

  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (
        normalized === 'true' ||
        normalized === 'yes' ||
        normalized === '1' ||
        normalized === 'on'
      )
        return true;
      if (normalized === 'false' || normalized === 'no' || normalized === '0')
        return false;
    }
    return value;
  })
  @IsBoolean()
  declarationAccepted!: boolean;

  @IsString()
  @MaxLength(160)
  signatureName!: string;

  /** Honeypot — must be empty when present. */
  @IsOptional()
  @IsString()
  @MaxLength(0)
  company?: string;
}

export class ListWebsiteFyugInterestsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  take?: number;
}
