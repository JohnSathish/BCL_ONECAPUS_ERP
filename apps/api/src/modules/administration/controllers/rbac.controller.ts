import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../../common/decorators/require-permissions.decorator';
import {
  ApplyWorkspaceTemplateDto,
  AssignUserRoleDto,
  CreateRoleDto,
  UpdateRoleDto,
  UpdateRolePermissionsDto,
  UpdateUserPermissionOverridesDto,
} from '../dto/rbac.dto';
import { RbacService } from '../services/rbac.service';

@ApiBearerAuth()
@ApiTags('admin-rbac')
@Controller({ path: 'admin/rbac', version: '1' })
export class RbacController {
  constructor(private readonly rbac: RbacService) {}

  @Get('roles')
  @RequireAnyPermission('rbac:manage', 'users:read')
  listRoles(@CurrentUser() user: JwtUser) {
    return this.rbac.listRoles(user.tid);
  }

  @Get('permissions')
  @RequirePermissions('rbac:manage')
  listPermissions() {
    return this.rbac.listPermissions();
  }

  @Post('roles')
  @RequirePermissions('rbac:manage')
  createRole(@CurrentUser() user: JwtUser, @Body() dto: CreateRoleDto) {
    return this.rbac.createRole(user.tid, dto, user.sub);
  }

  @Patch('roles/:id')
  @RequirePermissions('rbac:manage')
  updateRole(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rbac.updateRole(user.tid, id, dto, user.sub);
  }

  @Put('roles/:id/permissions')
  @RequirePermissions('rbac:manage')
  updatePermissions(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    return this.rbac.updateRolePermissions(user.tid, id, dto, user.sub);
  }

  @Post('roles/:id/apply-template')
  @RequirePermissions('rbac:manage')
  applyTemplate(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ApplyWorkspaceTemplateDto,
  ) {
    return this.rbac.applyWorkspaceTemplate(user.tid, id, dto, user.sub);
  }

  @Get('workspace-templates')
  @RequirePermissions('rbac:manage')
  listWorkspaceTemplates() {
    return this.rbac.listWorkspaceTemplates();
  }

  @Get('users/:userId/effective-permissions')
  @RequireAnyPermission('rbac:manage', 'users:read')
  getUserEffectivePermissions(
    @CurrentUser() user: JwtUser,
    @Param('userId') userId: string,
  ) {
    return this.rbac.getUserEffectivePermissions(user.tid, userId);
  }

  @Post('users/:userId/roles')
  @RequirePermissions('rbac:manage')
  assignUserRole(
    @CurrentUser() user: JwtUser,
    @Param('userId') userId: string,
    @Body() dto: AssignUserRoleDto,
  ) {
    return this.rbac.assignUserRole(user.tid, userId, dto, user.sub);
  }

  @Put('users/:userId/permission-overrides')
  @RequirePermissions('rbac:manage')
  updateUserOverrides(
    @CurrentUser() user: JwtUser,
    @Param('userId') userId: string,
    @Body() dto: UpdateUserPermissionOverridesDto,
  ) {
    return this.rbac.updateUserPermissionOverrides(
      user.tid,
      userId,
      dto,
      user.sub,
    );
  }
}
