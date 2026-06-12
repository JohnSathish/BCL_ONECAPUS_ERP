import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  MinLength,
} from 'class-validator';

export const SHIFT_TYPES = ['REGULAR', 'WEEKEND', 'SUMMER'] as const;
export const SHIFT_STATUSES = ['ACTIVE', 'INACTIVE'] as const;

export class CreateShiftDto {
  @IsUUID()
  institutionId!: string;

  @IsUUID()
  campusId!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(2)
  code!: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
  startTime!: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
  endTime!: string;

  @IsOptional()
  @IsIn(SHIFT_TYPES)
  shiftType?: string;

  @IsOptional()
  @IsIn(SHIFT_STATUSES)
  status?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateShiftDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  code?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
  startTime?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
  endTime?: string;

  @IsOptional()
  @IsIn(SHIFT_TYPES)
  shiftType?: string;

  @IsOptional()
  @IsIn(SHIFT_STATUSES)
  status?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class ReorderShiftsDto {
  @IsUUID('4', { each: true })
  shiftIds!: string[];
}

export class AssignShiftAdminDto {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class AssignShiftAdminByEmailDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  /** When true, creates the user if missing (password required). */
  @IsOptional()
  @IsBoolean()
  createIfMissing?: boolean;

  @IsOptional()
  @MinLength(8)
  password?: string;
}
