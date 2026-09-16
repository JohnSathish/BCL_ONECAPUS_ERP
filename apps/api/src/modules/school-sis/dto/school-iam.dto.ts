import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class SchoolIamCreateUserDto {
  @IsString()
  email!: string;
  @IsString()
  displayName!: string;
  @IsOptional()
  @IsString()
  username?: string;
  @IsOptional()
  @IsString()
  phone?: string;
  @IsArray()
  @IsString({ each: true })
  roleSlugs!: string[];
  @IsOptional()
  @IsString()
  password?: string;
  @IsOptional()
  @IsString()
  accountStatus?: string;
  @IsOptional()
  @IsString()
  staffId?: string;
  @IsOptional()
  @IsString()
  studentId?: string;
  @IsOptional()
  @IsString()
  guardianId?: string;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sectionIds?: string[];
  @IsOptional()
  @IsBoolean()
  mustResetPassword?: boolean;
  @IsOptional()
  @IsBoolean()
  invite?: boolean;
}

export class SchoolIamInviteDto {
  @IsString()
  name!: string;
  @IsString()
  email!: string;
  @IsString()
  role!: string;
}

export class SchoolIamAcceptInviteDto {
  @IsString()
  token!: string;
  @IsString()
  @MinLength(8)
  password!: string;
}

export class SchoolIamRolesDto {
  @IsArray()
  @IsString({ each: true })
  roleSlugs!: string[];
}

export class SchoolIamDirectPermsDto {
  @IsArray()
  items!: { slug: string; effect: 'grant' | 'deny' }[];
}

export class SchoolIamSaveRoleDto {
  @IsOptional()
  @IsString()
  id?: string;
  @IsString()
  name!: string;
  @IsOptional()
  @IsString()
  slug?: string;
  @IsOptional()
  @IsString()
  description?: string;
  @IsArray()
  @IsString({ each: true })
  permissions!: string[];
}

export class SchoolIamBulkDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];
  @IsString()
  action!: string;
  @IsOptional()
  @IsString()
  roleSlug?: string;
}

export class SchoolIamImportDto {
  @IsArray()
  rows!: Array<{
    fullName: string;
    email: string;
    username?: string;
    mobile?: string;
    employeeId?: string;
    role?: string;
    status?: string;
  }>;
  @IsOptional()
  @IsBoolean()
  confirm?: boolean;
}

export class SchoolIamImpersonateDto {
  @IsString()
  @MinLength(4)
  reason!: string;
}

export class SchoolIamDirectoryProvisionDto {
  @IsOptional()
  @IsBoolean()
  confirm?: boolean;
  @IsOptional()
  @IsBoolean()
  includeStudents?: boolean;
  @IsOptional()
  @IsBoolean()
  includeStaff?: boolean;
  @IsOptional()
  @IsString()
  password?: string;
}

export class SchoolIamReviewDto {
  @IsString()
  decision!: string;
  @IsOptional()
  @IsString()
  note?: string;
}
