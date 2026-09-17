import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { SCHOOL_MOBILE_AUDIENCES } from '../school-mobile.constants';

export class PatchSchoolMobileSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  androidLatestVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  iosLatestVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  minVersion?: string;

  @IsOptional()
  @IsBoolean()
  forceUpdate?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  androidStoreUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  iosStoreUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  releaseNotes?: string;

  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  maintenanceMessage?: string;
}

export class RegisterSchoolMobileDeviceDto {
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  deviceId!: string;

  @IsIn(['ios', 'android'])
  platform!: 'ios' | 'android';

  @IsOptional()
  @IsString()
  @MaxLength(40)
  appVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  pushToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  deviceModel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  osVersion?: string;
}

export class PatchSchoolMobileDeviceDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  appVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  pushToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceLabel?: string;
}

export class UpsertSchoolMobilePrayerDto {
  @IsInt()
  @Min(1)
  @Max(7)
  weekday!: number;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(8000)
  body!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class SchoolMobileBroadcastDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(4000)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  deepLink?: string;

  @IsIn([...SCHOOL_MOBILE_AUDIENCES])
  audience!: (typeof SCHOOL_MOBILE_AUDIENCES)[number];

  @IsOptional()
  @IsObject()
  audienceFilter?: Record<string, string>;
}

export class SchoolMobileLoginDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  identifier!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceLabel?: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

export class SchoolMobileChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

export class SchoolAuthIdentifierDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  identifier!: string;
}

export class SchoolAuthChallengeDto {
  @IsString()
  @MinLength(8)
  @MaxLength(80)
  challengeId!: string;
}

export class SchoolAuthOtpDto extends SchoolAuthChallengeDto {
  @IsString()
  @MinLength(4)
  @MaxLength(8)
  otp!: string;
}

export class SchoolAuthCodeDto extends SchoolAuthChallengeDto {
  @IsString()
  @MinLength(6)
  @MaxLength(20)
  code!: string;
}

export class SchoolAuthSetPasswordDto extends SchoolAuthChallengeDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  confirmPassword!: string;
}

export class SchoolAuthLogoutDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class SchoolMobileFeedbackDto {
  @IsString()
  @MinLength(8)
  @MaxLength(4000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;
}

export class PatchSchoolMobileInboxDto {
  @IsOptional()
  @IsBoolean()
  read?: boolean;

  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}
