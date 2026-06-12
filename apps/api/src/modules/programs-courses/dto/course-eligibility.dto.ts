import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class Class12SubjectInputDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  marks?: number;
}

export class CompletedStudyInputDto {
  @IsString()
  subjectSlug!: string;

  @IsString()
  category!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  semesterSequence!: number;

  @IsOptional()
  @IsUUID()
  courseId?: string;
}

export class CourseEligibilityPreviewDto {
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsUUID()
  programVersionId?: string;

  @IsOptional()
  @IsUUID()
  programId?: string;

  @IsOptional()
  @IsUUID()
  streamId?: string;

  @IsOptional()
  @IsString()
  streamCode?: string;

  @IsOptional()
  @IsString()
  majorSubjectSlug?: string;

  @IsOptional()
  @IsString()
  minorSubjectSlug?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Class12SubjectInputDto)
  class12Subjects?: Class12SubjectInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompletedStudyInputDto)
  completedStudy?: CompletedStudyInputDto[];
}

export class CourseEligibilityStatsDto {
  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  programVersionIds?: string[];
}

export class UpdateCourseEligibilityDto {
  @IsObject()
  eligibilityRules!: Record<string, unknown>;
}
