import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { StudentListQueryDto } from '../../dto/students.dto';

export class PhotoNormalizationDto {
  @IsOptional() @IsBoolean() ignoreExtension?: boolean = true;
  @IsOptional() @IsBoolean() ignoreSpaces?: boolean = true;
  @IsOptional() @IsBoolean() ignoreCase?: boolean = true;
  @IsOptional() @IsBoolean() stripSpecialCharacters?: boolean = false;
}

export class PhotoBulkPreviewDto {
  @IsIn([
    'rollNumber',
    'applicationNumber',
    'studentCode',
    'enrollmentNumber',
    'nehuRegistrationNumber',
    'studentId',
  ])
  identifierStrategy!: string;

  @IsOptional()
  @IsIn(['FILES', 'ZIP', 'CSV'])
  uploadMode?: 'FILES' | 'ZIP' | 'CSV';

  @IsOptional()
  normalization?: PhotoNormalizationDto | string;

  @IsOptional()
  scopeFilter?: StudentListQueryDto | string;

  @IsOptional()
  @IsIn(['REPLACE_EXISTING', 'SKIP_EXISTING', 'KEEP_BOTH'])
  conflictStrategy?: 'REPLACE_EXISTING' | 'SKIP_EXISTING' | 'KEEP_BOTH';

  @IsOptional()
  @IsIn(['LATEST', 'HIGHEST_RESOLUTION', 'MANUAL'])
  duplicateStrategy?: 'LATEST' | 'HIGHEST_RESOLUTION' | 'MANUAL';

  @IsOptional()
  @IsIn(['COVER', 'CONTAIN'])
  cropMode?: 'COVER' | 'CONTAIN';

  @IsOptional()
  @IsString()
  csvMap?: string;
}

export class PhotoBulkApplyDto {
  @IsUUID()
  batchId!: string;

  @IsOptional()
  @IsIn(['REPLACE_EXISTING', 'SKIP_EXISTING', 'KEEP_BOTH'])
  conflictStrategy?: 'REPLACE_EXISTING' | 'SKIP_EXISTING' | 'KEEP_BOTH';
}

export class PhotoBulkDeleteDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => StudentListQueryDto)
  filter?: StudentListQueryDto;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  studentIds?: string[];
}

export class PhotoIdentifierExportQueryDto extends StudentListQueryDto {
  @IsOptional()
  @IsIn([
    'rollNumber',
    'applicationNumber',
    'studentCode',
    'enrollmentNumber',
    'nehuRegistrationNumber',
    'studentId',
  ])
  identifierStrategy?: string;
}
