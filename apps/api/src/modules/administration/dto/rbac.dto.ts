import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateRoleDto {
  @IsString()
  slug!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateRolePermissionsDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  permissionIds!: string[];
}

export class UpdateUserPermissionOverridesDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  grantPermissionIds!: string[];

  @IsArray()
  @IsUUID(undefined, { each: true })
  denyPermissionIds!: string[];
}

export class AssignUserRoleDto {
  @IsUUID()
  roleId!: string;

  @IsOptional()
  @IsUUID()
  campusId?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  programmeId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  semesterNo?: number;
}

export class ApplyWorkspaceTemplateDto {
  @IsString()
  templateSlug!: string;
}
