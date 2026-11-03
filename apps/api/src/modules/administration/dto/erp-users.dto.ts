import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class ListErpUsersQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  /** active | inactive | locked | pending */
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  /** enabled | disabled */
  @IsOptional()
  @IsString()
  erpAccess?: string;

  @IsOptional()
  @IsIn([
    'name',
    'username',
    'email',
    'lastLoginAt',
    'createdAt',
    'accountCode',
  ])
  sortBy?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}

export class CreateErpUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  mobile?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  employeeId?: string;

  /** Empty string means no department. */
  @IsOptional()
  @ValidateIf((o: CreateErpUserDto) => o.departmentId !== '')
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  designation?: string;

  @IsString()
  username!: string;

  @IsString()
  @MaxLength(128)
  password!: string;

  @IsString()
  confirmPassword!: string;

  @IsIn(['active', 'inactive'])
  accountStatus!: 'active' | 'inactive';

  @IsString()
  roleSlug!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  extraPermissions?: string[];

  @IsBoolean()
  erpAccessEnabled!: boolean;

  @IsBoolean()
  forcePasswordChange!: boolean;
}

export class UpdateErpUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  mobile?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  employeeId?: string;

  /** Empty string clears the department. */
  @IsOptional()
  @ValidateIf((o: UpdateErpUserDto) => o.departmentId !== '')
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  designation?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  roleSlug?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  extraPermissions?: string[];

  @IsOptional()
  @IsBoolean()
  erpAccessEnabled?: boolean;
}

export class ErpUserResetPasswordDto {
  @IsString()
  @MaxLength(128)
  newPassword!: string;

  @IsString()
  confirmPassword!: string;

  @IsBoolean()
  forcePasswordChange!: boolean;
}
