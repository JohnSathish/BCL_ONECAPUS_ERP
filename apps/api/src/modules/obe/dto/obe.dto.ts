import { IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateProgramOutcomeDto {
  @IsString()
  programVersionId!: string;

  @IsString()
  @MinLength(2)
  code!: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  bloomLevel?: string;
}

export class CreateCourseOutcomeDto {
  @IsString()
  courseId!: string;

  @IsString()
  @MinLength(2)
  code!: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  bloomLevel?: string;
}

export class CreateCoPoMapDto {
  @IsString()
  courseOutcomeId!: string;

  @IsString()
  programOutcomeId!: string;

  @IsOptional()
  @IsNumber()
  weight?: number;
}

export class RunAttainmentDto {
  @IsString()
  programVersionId!: string;

  @IsOptional()
  @IsString()
  label?: string;
}
