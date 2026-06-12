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
