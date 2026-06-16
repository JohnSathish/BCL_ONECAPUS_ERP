import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class TeachingSubjectGroupQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  semesterNo?: number;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  fyugpCategory?: string;

  @IsOptional()
  @IsUUID()
  academicSubjectId?: string;
}

export class CreateTeachingSubjectGroupDto {
  @IsString()
  code!: string;

  @IsString()
  title!: string;

  @IsInt()
  @Min(1)
  semesterNo!: number;

  @IsString()
  fyugpCategory!: string;

  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @IsOptional()
  @IsUUID()
  academicSubjectId?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  primaryStaffProfileId?: string;

  @IsOptional()
  @IsUUID()
  offeringSectionId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  courseIds?: string[];
}

export class UpdateTeachingSubjectGroupDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  semesterNo?: number;

  @IsOptional()
  @IsString()
  fyugpCategory?: string;

  @IsOptional()
  @IsUUID()
  academicSubjectId?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  primaryStaffProfileId?: string;

  @IsOptional()
  @IsUUID()
  offeringSectionId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class SyncTeachingSubjectGroupsDto {
  @IsInt()
  @Min(1)
  semesterNo!: number;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @IsString()
  fyugpCategory?: string;
}

export class LinkTeachingSubjectGroupPaperDto {
  @IsUUID()
  courseId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  paperIndex?: number;

  @IsOptional()
  @IsUUID()
  offeringSectionId?: string;
}
