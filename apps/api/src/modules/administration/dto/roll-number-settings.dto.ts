import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RollPrefixConfigItemDto {
  @IsUUID()
  streamId!: string;

  @IsString()
  @MinLength(1)
  prefix!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class DepartmentShiftRangeItemDto {
  @IsUUID()
  departmentId!: string;

  @IsUUID()
  shiftId!: string;

  @IsInt()
  @Min(1)
  sequenceStart!: number;

  @IsInt()
  @Min(1)
  sequenceEnd!: number;

  @IsInt()
  @Min(1)
  nextSequence!: number;
}

export class UpdateDepartmentRollRangesDto {
  @IsInt()
  admissionYear!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DepartmentShiftRangeItemDto)
  ranges!: DepartmentShiftRangeItemDto[];
}

export class UpdateRollNumberConfigDto {
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(6)
  sequenceLength?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  separator?: string;

  @IsOptional()
  @IsBoolean()
  autoGenerateOnAdmit?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RollPrefixConfigItemDto)
  prefixes?: RollPrefixConfigItemDto[];
}
