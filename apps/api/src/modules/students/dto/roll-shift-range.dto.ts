import {
  ArrayMinSize,
  IsArray,
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

export class RollShiftRangeItemDto {
  @IsUUID()
  shiftId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  admissionYear!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  sequenceStart!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  sequenceEnd!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  nextSequence?: number;
}

export class UpsertRollShiftRangesDto {
  @IsUUID()
  institutionId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RollShiftRangeItemDto)
  ranges!: RollShiftRangeItemDto[];
}

export class RollShiftCapacityQueryDto {
  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  admissionYear?: number;
}

export class ReserveRollNumberDto {
  @IsUUID()
  institutionId!: string;

  @IsString()
  @MinLength(3)
  rollNumber!: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class BulkShiftTransferDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  studentIds!: string[];

  @IsUUID()
  toShiftId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
