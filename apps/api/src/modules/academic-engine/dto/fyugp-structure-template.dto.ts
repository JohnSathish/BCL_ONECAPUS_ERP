import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class FyugpTemplateLineDto {
  @IsInt()
  @Min(1)
  semesterNo!: number;

  @IsString()
  categoryType!: string;

  @IsInt()
  @Min(0)
  subjectCount!: number;

  @IsOptional()
  @IsString()
  continuityRule?: string;

  @IsOptional()
  @IsNumber()
  creditRule?: number;

  @IsOptional()
  @IsBoolean()
  optionalFlag?: boolean;
}

export class CreateFyugpTemplateDto {
  @IsString()
  templateName!: string;

  @IsInt()
  regulationYear!: number;

  @IsIn(['UG', 'PG'])
  programmeLevel!: 'UG' | 'PG';

  @IsOptional()
  @IsInt()
  @Min(1)
  totalSemesters?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FyugpTemplateLineDto)
  lines!: FyugpTemplateLineDto[];
}

export class UpdateFyugpTemplateDto {
  @IsOptional()
  @IsString()
  templateName?: string;

  @IsOptional()
  @IsInt()
  regulationYear?: number;

  @IsOptional()
  @IsIn(['UG', 'PG'])
  programmeLevel?: 'UG' | 'PG';

  @IsOptional()
  @IsInt()
  @Min(1)
  totalSemesters?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FyugpTemplateLineDto)
  lines?: FyugpTemplateLineDto[];
}

export class ApplyFyugpTemplateDto {
  @IsIn(['ALL_UG', 'SELECTED_PROGRAMS', 'SELECTED_VERSIONS'])
  mode!: 'ALL_UG' | 'SELECTED_PROGRAMS' | 'SELECTED_VERSIONS';

  @IsIn(['REPLACE_ALL', 'SKIP_EXISTING'])
  conflictStrategy!: 'REPLACE_ALL' | 'SKIP_EXISTING';

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  programIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  programVersionIds?: string[];

  @IsOptional()
  @IsIn(['UG', 'PG'])
  programmeLevel?: 'UG' | 'PG';
}

export class ApplyTemplateToVersionDto {
  @IsOptional()
  @IsIn(['REPLACE_ALL', 'SKIP_EXISTING'])
  conflictStrategy?: 'REPLACE_ALL' | 'SKIP_EXISTING';
}
