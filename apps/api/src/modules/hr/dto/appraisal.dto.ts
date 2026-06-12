import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateAppraisalCycleDto {
  @IsString()
  name!: string;

  @IsInt()
  year!: number;

  @IsString()
  startDate!: string;

  @IsString()
  endDate!: string;

  @IsOptional()
  templateJson?: unknown;

  @IsOptional()
  @IsString()
  status?: string;
}

export class ScoreAppraisalDto {
  @IsIn(['SELF', 'HOD', 'PRINCIPAL'])
  role!: 'SELF' | 'HOD' | 'PRINCIPAL';

  @IsNumber()
  @Min(0)
  @Max(100)
  score!: number;

  @IsOptional()
  @IsString()
  remarks?: string;
}
