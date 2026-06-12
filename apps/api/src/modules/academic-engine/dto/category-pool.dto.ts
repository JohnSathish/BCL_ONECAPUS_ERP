import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { POOL_ELIGIBLE_CATEGORIES } from '../domain/category-pools';

export class CreateCategoryPoolDto {
  @IsString()
  poolName!: string;

  @IsUUID()
  institutionId!: string;

  @IsInt()
  @Min(1)
  semesterNo!: number;

  @IsIn([...POOL_ELIGIBLE_CATEGORIES])
  categoryType!: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateCategoryPoolDto {
  @IsOptional()
  @IsString()
  poolName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  semesterNo?: number;

  @IsOptional()
  @IsIn([...POOL_ELIGIBLE_CATEGORIES])
  categoryType?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class AddPoolCourseDto {
  @IsUUID()
  courseId!: string;

  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class RemovePoolCourseDto {
  @IsUUID()
  courseId!: string;
}

export class ProvisionPoolSectionsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  semesterNo?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @IsOptional()
  @IsString()
  shiftCode?: string;

  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @IsOptional()
  @IsUUID()
  poolId?: string;
}

export class UpsertPoolAssignmentsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PoolAssignmentItemDto)
  assignments!: PoolAssignmentItemDto[];
}

export class PoolAssignmentItemDto {
  @IsInt()
  @Min(1)
  semesterNo!: number;

  @IsUUID()
  poolId!: string;

  @IsBoolean()
  active!: boolean;
}

export class UpsertPoolExclusionDto {
  @IsUUID()
  poolId!: string;

  @IsUUID()
  courseId!: string;

  @IsBoolean()
  active!: boolean;
}

export class AssignPoolDto {
  @IsIn(['ALL_UG', 'SELECTED_PROGRAMS', 'SELECTED_VERSIONS'])
  mode!: 'ALL_UG' | 'SELECTED_PROGRAMS' | 'SELECTED_VERSIONS';

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  programIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  programVersionIds?: string[];
}

export class ListCategoryPoolsQueryDto {
  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @IsOptional()
  @IsIn([...POOL_ELIGIBLE_CATEGORIES])
  categoryType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  semesterNo?: number;

  @IsOptional()
  @IsBoolean()
  activeOnly?: boolean;
}
