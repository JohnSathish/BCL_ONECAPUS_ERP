import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  CBCS_COURSE_TYPES,
  NEP_CURRICULUM_CATEGORIES,
} from '../../../common/constants/academic-categories';
import { COURSE_DELIVERY_TYPES } from '../../../common/constants/course-delivery';

export class CourseListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 30;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsIn([...CBCS_COURSE_TYPES])
  courseType?: string;

  @IsOptional()
  @IsIn([...COURSE_DELIVERY_TYPES])
  deliveryType?: string;

  @IsOptional()
  @IsUUID()
  programVersionId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8)
  semesterSequence?: number;

  @IsOptional()
  @IsIn([...NEP_CURRICULUM_CATEGORIES])
  category?: string;

  /** Reserved for future filters (faculty, shift, syllabus version, archived). */
  @IsOptional()
  @IsString()
  status?: string;
}
