import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const VERSION_PATTERN = /^\d{1,4}(\.\d{1,4}){0,3}$/;
const VERSION_MESSAGE = 'Use a version like 1.0.30';

export class SaveAppUpdatePolicyDto {
  @IsString()
  @Matches(VERSION_PATTERN, { message: `latestVersion: ${VERSION_MESSAGE}` })
  latestVersion!: string;

  @IsString()
  @Matches(VERSION_PATTERN, { message: `minimumVersion: ${VERSION_MESSAGE}` })
  minimumVersion!: string;

  @IsBoolean()
  forceUpdate!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  storeUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  releaseTitle?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  releaseNotes?: string[];

  @IsOptional()
  @IsDateString()
  releaseDate?: string | null;

  @IsBoolean()
  isActive!: boolean;
}

export class SendAppUpdateNotificationDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  body?: string;

  /** Only devices whose last reported version is older than the latest version. Default true. */
  @IsOptional()
  @IsBoolean()
  onlyOutdated?: boolean;
}
