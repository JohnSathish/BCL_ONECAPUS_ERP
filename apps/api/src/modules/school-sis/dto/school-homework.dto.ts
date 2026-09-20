import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

function asBool(value: unknown) {
  return value === true || value === 'true' || value === '1';
}

export class SaveSchoolHomeworkDto {
  @IsUUID()
  sectionId!: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  body?: string;

  @IsDateString()
  assignDate!: string;

  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @IsString()
  visibleTo?: string;

  @IsOptional()
  @Transform(({ value }) => asBool(value))
  @IsBoolean()
  asDraft?: boolean;
}
