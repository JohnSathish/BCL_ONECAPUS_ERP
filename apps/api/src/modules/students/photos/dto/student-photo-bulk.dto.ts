import { BadRequestException } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { StudentListQueryDto } from '../../dto/students.dto';

const IDENTIFIER_STRATEGIES = [
  'rollNumber',
  'applicationNumber',
  'studentCode',
  'enrollmentNumber',
  'nehuRegistrationNumber',
  'studentId',
] as const;

function parseMultipartJson({ value }: { value: unknown }) {
  if (value == null || value === '') return undefined;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export class PhotoNormalizationDto {
  @IsOptional() @IsBoolean() ignoreExtension?: boolean = true;
  @IsOptional() @IsBoolean() ignoreSpaces?: boolean = true;
  @IsOptional() @IsBoolean() ignoreCase?: boolean = true;
  @IsOptional() @IsBoolean() stripSpecialCharacters?: boolean = false;
}

export class PhotoBulkPreviewDto {
  @IsIn([...IDENTIFIER_STRATEGIES])
  identifierStrategy!: string;

  @IsOptional()
  @IsIn(['FILES', 'ZIP', 'CSV'])
  uploadMode?: 'FILES' | 'ZIP' | 'CSV';

  @IsOptional()
  @Transform(parseMultipartJson)
  normalization?: PhotoNormalizationDto | string;

  @IsOptional()
  @Transform(parseMultipartJson)
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

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

/** Multipart bodies skip class-validator (no DTO metatype) so extra form fields cannot 400. */
export function parsePhotoBulkPreviewBody(
  body: Record<string, unknown> | PhotoBulkPreviewDto | undefined,
): PhotoBulkPreviewDto {
  const source = (body ?? {}) as Record<string, unknown>;
  const identifierStrategy = asTrimmedString(source.identifierStrategy);
  if (
    !(IDENTIFIER_STRATEGIES as readonly string[]).includes(identifierStrategy)
  ) {
    throw new BadRequestException(
      identifierStrategy
        ? `Invalid identifier strategy: ${identifierStrategy}`
        : 'identifierStrategy is required',
    );
  }

  const uploadMode = asTrimmedString(source.uploadMode) || undefined;
  if (uploadMode && !['FILES', 'ZIP', 'CSV'].includes(uploadMode)) {
    throw new BadRequestException(`Invalid upload mode: ${uploadMode}`);
  }
  const conflictStrategy =
    asTrimmedString(source.conflictStrategy) || undefined;
  if (
    conflictStrategy &&
    !['REPLACE_EXISTING', 'SKIP_EXISTING', 'KEEP_BOTH'].includes(
      conflictStrategy,
    )
  ) {
    throw new BadRequestException(
      `Invalid conflict strategy: ${conflictStrategy}`,
    );
  }
  const duplicateStrategy =
    asTrimmedString(source.duplicateStrategy) || undefined;
  if (
    duplicateStrategy &&
    !['LATEST', 'HIGHEST_RESOLUTION', 'MANUAL'].includes(duplicateStrategy)
  ) {
    throw new BadRequestException(
      `Invalid duplicate strategy: ${duplicateStrategy}`,
    );
  }
  const cropMode = asTrimmedString(source.cropMode) || undefined;
  if (cropMode && !['COVER', 'CONTAIN'].includes(cropMode)) {
    throw new BadRequestException(`Invalid crop mode: ${cropMode}`);
  }

  return {
    identifierStrategy,
    uploadMode: uploadMode as PhotoBulkPreviewDto['uploadMode'],
    normalization: parseMultipartJson({ value: source.normalization }) as
      | PhotoNormalizationDto
      | string
      | undefined,
    scopeFilter: parseMultipartJson({ value: source.scopeFilter }) as
      | StudentListQueryDto
      | string
      | undefined,
    conflictStrategy:
      conflictStrategy as PhotoBulkPreviewDto['conflictStrategy'],
    duplicateStrategy:
      duplicateStrategy as PhotoBulkPreviewDto['duplicateStrategy'],
    cropMode: cropMode as PhotoBulkPreviewDto['cropMode'],
    csvMap: asTrimmedString(source.csvMap) || undefined,
  };
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
