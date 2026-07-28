import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';

export class UpdateMoodleSettingsDto {
  @IsOptional()
  @IsUrl({ require_tld: false })
  moodleUrl?: string;

  @IsOptional()
  @IsString()
  wsToken?: string;

  @IsOptional()
  @IsString()
  wsServiceName?: string;

  @IsOptional()
  @IsString()
  ssoSecret?: string;

  @IsOptional()
  @IsBoolean()
  enableSync?: boolean;

  @IsOptional()
  @IsBoolean()
  enableAutoUserCreation?: boolean;

  @IsOptional()
  @IsBoolean()
  enableAutoCourseCreation?: boolean;

  @IsOptional()
  @IsBoolean()
  enableAutoEnrollment?: boolean;

  @IsOptional()
  @IsBoolean()
  enableGradeSync?: boolean;

  @IsOptional()
  @IsBoolean()
  enableAttendanceSync?: boolean;

  @IsOptional()
  @IsBoolean()
  enableAssignmentSync?: boolean;

  @IsOptional()
  @IsBoolean()
  enableNotificationSync?: boolean;

  @IsOptional()
  @IsBoolean()
  ssoEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  cronIntervalMinutes?: number;
}

export class MoodleSyncRequestDto {
  @IsOptional()
  @IsString()
  syncType?:
    | 'USERS'
    | 'COURSES'
    | 'ENROLLMENTS'
    | 'GRADES'
    | 'ASSIGNMENTS'
    | 'ATTENDANCE'
    | 'NOTIFICATIONS'
    | 'ALL';
}

export class MoodleSsoVerifyDto {
  @IsString()
  token!: string;
}

export class MoodleLaunchQueryDto {
  @IsOptional()
  @IsString()
  workspaceId?: string;

  @IsOptional()
  @IsInt()
  moodleCourseId?: number;
}
