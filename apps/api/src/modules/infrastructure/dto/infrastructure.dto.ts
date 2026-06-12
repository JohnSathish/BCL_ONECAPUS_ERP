import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class InfrastructureQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  campusId?: string;

  @IsOptional()
  @IsUUID()
  buildingId?: string;

  @IsOptional()
  @IsUUID()
  floorId?: string;

  @IsOptional()
  @IsUUID()
  roomTypeId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  type?: string;
}

export class BuildingDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsUUID()
  campusId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class FloorDto {
  @IsUUID()
  buildingId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  floorNumber?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class RoomTypeDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  status?: string;
}

export class RoomDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  shortName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  campusId?: string;

  @IsOptional()
  @IsUUID()
  buildingId?: string;

  @IsOptional()
  @IsUUID()
  floorId?: string;

  @IsOptional()
  @IsUUID()
  roomTypeId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  capacity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  practicalCapacity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  examCapacity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  standingCapacity?: number;

  @IsOptional()
  @IsArray()
  shiftAvailability?: string[];

  @IsOptional()
  @IsString()
  departmentRestrictionMode?: string;

  @IsOptional()
  @IsArray()
  restrictedDepartmentIds?: string[];

  @IsOptional()
  @IsArray()
  preferredDepartmentIds?: string[];

  @IsOptional()
  @IsArray()
  facilities?: string[];

  @IsOptional()
  @IsArray()
  supportedCategories?: string[];

  @IsOptional()
  @IsBoolean()
  availableForTimetable?: boolean;

  @IsOptional()
  @IsBoolean()
  availableForAttendance?: boolean;

  @IsOptional()
  @IsBoolean()
  availableForExams?: boolean;

  @IsOptional()
  @IsBoolean()
  availableForWorkshops?: boolean;

  @IsOptional()
  @IsBoolean()
  availableForSeminars?: boolean;

  @IsOptional()
  @IsBoolean()
  availableForCombined?: boolean;

  @IsOptional()
  @IsBoolean()
  isSharedHall?: boolean;

  @IsOptional()
  @IsBoolean()
  isPracticalLab?: boolean;

  @IsOptional()
  @IsBoolean()
  supportsMdc?: boolean;

  @IsOptional()
  @IsBoolean()
  supportsVac?: boolean;

  @IsOptional()
  @IsBoolean()
  supportsAec?: boolean;

  @IsOptional()
  @IsBoolean()
  supportsSec?: boolean;

  @IsOptional()
  @IsString()
  status?: string;
}

export class ReservationDto {
  @IsUUID()
  classroomId!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class ReservationQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  classroomId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class ReservationStatusDto {
  @IsString()
  status!: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class AvailabilityQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  classroomId?: string;
}
