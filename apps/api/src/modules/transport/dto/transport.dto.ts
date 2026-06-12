import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class ListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  routeId?: string;
}

export class CreateRouteDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  startPoint?: string;

  @IsOptional()
  @IsString()
  endPoint?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  fareAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(50)
  @Max(100)
  capacityWarningPercent?: number;
}

export class UpdateRouteDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  startPoint?: string;

  @IsOptional()
  @IsString()
  endPoint?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  fareAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(50)
  @Max(100)
  capacityWarningPercent?: number;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateStopDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  pickupTime?: string;
}

export class CreateVehicleDto {
  @IsString()
  @IsNotEmpty()
  registrationNo!: string;

  @IsOptional()
  @IsString()
  vehicleType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsString()
  driverName?: string;

  @IsOptional()
  @IsString()
  driverMobile?: string;

  @IsOptional()
  @IsUUID()
  routeId?: string;
}

export class UpdateVehicleDto {
  @IsOptional()
  @IsString()
  vehicleType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  capacity?: number;

  @IsOptional()
  @IsString()
  driverName?: string;

  @IsOptional()
  @IsString()
  driverMobile?: string;

  @IsOptional()
  @IsUUID()
  routeId?: string | null;

  @IsOptional()
  @IsString()
  status?: string;
}

export class AssignStudentDto {
  @IsUUID()
  studentId!: string;

  @IsUUID()
  routeId!: string;

  @IsOptional()
  @IsUUID()
  stopId?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsBoolean()
  notifyParents?: boolean;
}

export class StudentSearchQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
