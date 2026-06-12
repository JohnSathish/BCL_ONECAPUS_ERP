import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class ListUsersQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @IsUUID()
  campusId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  programVersionId?: string;

  @IsOptional()
  @IsString()
  semester?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortDir?: 'asc' | 'desc';

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsArray()
  @IsString({ each: true })
  roleSlugs!: string[];

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @IsUUID()
  campusId?: string;

  @IsOptional()
  @IsString()
  accountStatus?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleSlugs?: string[];

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @IsUUID()
  campusId?: string;

  @IsOptional()
  @IsString()
  accountStatus?: string;

  @IsOptional()
  @IsBoolean()
  mfaEnabled?: boolean;
}

export class BulkResetPasswordDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  userIds!: string[];

  @IsOptional()
  @IsBoolean()
  forceReset?: boolean;
}

export class BulkUserActionDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  userIds!: string[];
}

export class ResetPasswordDto {
  @IsOptional()
  @IsString()
  @MinLength(8)
  newPassword?: string;

  @IsOptional()
  @IsBoolean()
  forceReset?: boolean;
}
