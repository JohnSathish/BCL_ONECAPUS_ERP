import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class ValidateFyugpRegistrationDto {
  @IsOptional()
  @IsUUID()
  registrationId?: string;

  @IsOptional()
  @IsUUID()
  programVersionId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  semesterSequence?: number;

  @IsOptional()
  @IsString()
  shiftId?: string;

  @IsOptional()
  @IsString()
  streamId?: string;

  @IsOptional()
  @IsString()
  majorSubjectSlug?: string;

  @IsOptional()
  @IsString()
  minorSubjectSlug?: string;

  @IsOptional()
  @IsString()
  honoursTrack?: 'HONOURS' | 'HONOURS_WITH_RESEARCH';

  @IsOptional()
  @IsObject()
  selections?: Record<string, string>;
}

export class GenerateFyugpRegistrationDto {
  @IsUUID()
  studentId!: string;

  @IsUUID()
  programVersionId!: string;

  @IsInt()
  @Min(1)
  semesterSequence!: number;

  @IsOptional()
  @IsUUID()
  registrationId?: string;

  @IsOptional()
  @IsString()
  shiftId?: string;

  @IsOptional()
  @IsString()
  streamId?: string;

  @IsOptional()
  @IsObject()
  subjectSelections?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  persist?: boolean;
}

export class SetHonoursTrackDto {
  @IsString()
  track!: 'HONOURS' | 'HONOURS_WITH_RESEARCH';

  @IsOptional()
  @IsInt()
  @Min(1)
  effectiveFromSemester?: number;

  @IsOptional()
  @IsBoolean()
  eligibilityOverride?: boolean;

  @IsOptional()
  @IsString()
  eligibilityOverrideReason?: string;

  @IsOptional()
  aggregatePercentageAtSelection?: number;
}

export class UpdateAggregateThroughSem6Dto {
  @IsNumber()
  @Min(0)
  @Max(100)
  aggregatePercentageThroughSem6!: number;
}
