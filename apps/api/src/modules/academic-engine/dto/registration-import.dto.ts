import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import {
  IMPORT_COMMIT_MODES,
  type ImportCommitMode,
} from '../../../common/import/import.types';

export class ValidateRegistrationImportDto {
  @ApiProperty()
  @IsUUID()
  semesterId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  semesterSequence!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  submitAfterImport?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  freezeAfterImport?: boolean;
}

export class CommitRegistrationImportDto {
  @ApiProperty()
  @IsUUID()
  batchId!: string;

  @ApiProperty()
  @IsUUID()
  semesterId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  semesterSequence!: number;

  @ApiPropertyOptional({ enum: IMPORT_COMMIT_MODES })
  @IsOptional()
  @IsIn(IMPORT_COMMIT_MODES)
  mode?: ImportCommitMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  submitAfterImport?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  freezeAfterImport?: boolean;
}
