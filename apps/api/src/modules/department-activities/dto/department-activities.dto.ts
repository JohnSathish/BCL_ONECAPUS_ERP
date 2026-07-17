import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ACTIVITY_STATUSES } from '../domain/activity-types';

export class UpsertDepartmentActivityDto {
  @IsString()
  @MaxLength(300)
  title!: string;

  @IsUUID()
  departmentId!: string;

  @IsString()
  activityType!: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  semesterSequence?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  venue?: string;

  @IsDateString()
  eventDate!: string;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsOptional()
  @IsDateString()
  registrationStartsAt?: string;

  @IsOptional()
  @IsDateString()
  registrationEndsAt?: string;

  @IsOptional()
  @IsUUID()
  coordinatorStaffId?: string;

  @IsOptional()
  @IsUUID()
  hodStaffId?: string;

  @IsOptional()
  @IsString()
  guestSpeaker?: string;

  @IsOptional()
  @IsString()
  chiefGuest?: string;

  @IsOptional()
  @IsString()
  theme?: string;

  @IsOptional()
  @IsString()
  objectives?: string;

  @IsOptional()
  @IsString()
  learningOutcomes?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  posterUrl?: string;

  @IsOptional()
  @IsString()
  bannerUrl?: string;

  @IsOptional()
  @IsString()
  brochureUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxParticipants?: number;
}

export class TransitionActivityStatusDto {
  @IsIn([...ACTIVITY_STATUSES])
  status!: string;
}

export class MarkAttendanceDto {
  @IsOptional()
  @IsUUID()
  registrationId?: string;

  @IsOptional()
  @IsString()
  qrPassToken?: string;

  @IsOptional()
  @IsIn(['QR', 'MANUAL', 'FACULTY'])
  method?: string;
}
