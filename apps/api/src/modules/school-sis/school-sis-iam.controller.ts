import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import { extractClientIp } from '../../common/utils/request-host';
import {
  SCHOOL_SIS_PERMISSION_MANAGE,
  SCHOOL_SIS_PERMISSION_READ,
} from './school-sis.constants';
import { SchoolSisIamService } from './school-sis-iam.service';
import {
  SchoolIamBulkDto,
  SchoolIamCreateUserDto,
  SchoolIamDirectPermsDto,
  SchoolIamImpersonateDto,
  SchoolIamImportDto,
  SchoolIamInviteDto,
  SchoolIamReviewDto,
  SchoolIamRolesDto,
  SchoolIamSaveRoleDto,
} from './dto/school-iam.dto';

const VIEW = [
  SCHOOL_SIS_PERMISSION_READ,
  SCHOOL_SIS_PERMISSION_MANAGE,
  'users:read',
  'users.view',
] as const;

const MANAGE = [
  SCHOOL_SIS_PERMISSION_MANAGE,
  'users:manage',
  'users.create',
  'users.update',
  'users.invite',
] as const;

@ApiBearerAuth()
@ApiTags('school-sis-iam')
@Controller({ path: 'school-sis/iam', version: '1' })
export class SchoolSisIamController {
  constructor(private readonly iam: SchoolSisIamService) {}

  @Get('catalog')
  @RequireAnyPermission(...VIEW)
  catalog() {
    return this.iam.catalog();
  }

  @Get('dashboard')
  @RequireAnyPermission(...VIEW)
  dashboard(@CurrentUser() user: JwtUser) {
    return this.iam.dashboard(user.tid);
  }

  @Post('seed-roles')
  @RequireAnyPermission(...MANAGE, 'rbac:manage', 'roles.create')
  seed(@CurrentUser() user: JwtUser) {
    return this.iam.ensureDefaultRoles(user.tid);
  }

  @Get('users')
  @RequireAnyPermission(...VIEW)
  users(
    @CurrentUser() user: JwtUser,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('role') role?: string,
    @Query('mfa') mfa?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.iam.listUsers(user.tid, {
      search,
      status,
      role,
      mfa,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 25,
    });
  }

  @Get('users/:id')
  @RequireAnyPermission(...VIEW)
  getUser(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.iam.getUser(user.tid, id);
  }

  @Post('users')
  @RequireAnyPermission(...MANAGE)
  create(@CurrentUser() user: JwtUser, @Body() body: SchoolIamCreateUserDto) {
    return this.iam.createUser(user.tid, user, body);
  }

  @Patch('users/:id')
  @RequireAnyPermission(...MANAGE)
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.iam.updateUser(user.tid, user, id, body as never);
  }

  @Post('users/:id/status/:status')
  @RequireAnyPermission(...MANAGE)
  status(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('status') status: string,
  ) {
    return this.iam.setStatus(user.tid, user, id, status);
  }

  @Delete('users/:id')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    'users:manage',
    'users.delete',
  )
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.iam.softDelete(user.tid, user, id);
  }

  @Post('users/:id/reset-password')
  @RequireAnyPermission(...MANAGE)
  reset(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { forceChange?: boolean },
  ) {
    return this.iam.resetPassword(
      user.tid,
      user,
      id,
      body.forceChange !== false,
    );
  }

  @Post('users/:id/roles')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    'rbac:manage',
    'roles.update',
  )
  roles(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: SchoolIamRolesDto,
  ) {
    return this.iam.assignRoles(user.tid, user, id, body.roleSlugs);
  }

  @Post('users/:id/permissions')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    'rbac:manage',
    'roles.update',
  )
  perms(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: SchoolIamDirectPermsDto,
  ) {
    return this.iam.setDirectPermissions(user.tid, user, id, body.items);
  }

  @Post('users/:id/logout-all')
  @RequireAnyPermission(...MANAGE)
  logoutAll(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.iam.bulk(user.tid, user, [id], 'logout');
  }

  @Post('users/:id/impersonate')
  @RequireAnyPermission('users:impersonate', 'users.impersonate')
  impersonate(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: SchoolIamImpersonateDto,
    @Req() req: Request,
  ) {
    return this.iam.impersonate(user.tid, user, id, body.reason, {
      ip: extractClientIp(req),
      ua: req.headers['user-agent'],
    });
  }

  @Post('users/:id/test-access')
  @RequireAnyPermission(...VIEW)
  test(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { permission: string },
  ) {
    return this.iam.testAccess(user.tid, user, id, body.permission);
  }

  @Post('users/:id/review')
  @RequireAnyPermission(...MANAGE)
  review(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: SchoolIamReviewDto,
  ) {
    return this.iam.review(user.tid, user, id, body.decision, body.note);
  }

  @Post('users/bulk')
  @RequireAnyPermission(...MANAGE)
  bulk(@CurrentUser() user: JwtUser, @Body() body: SchoolIamBulkDto) {
    return this.iam.bulk(user.tid, user, body.ids, body.action, body.roleSlug);
  }

  @Post('users/import')
  @RequireAnyPermission(...MANAGE)
  importUsers(@CurrentUser() user: JwtUser, @Body() body: SchoolIamImportDto) {
    return this.iam.importUsers(user.tid, user, body.rows, body.confirm);
  }

  @Get('roles')
  @RequireAnyPermission(...VIEW, 'roles.view', 'rbac:manage')
  rolesList(@CurrentUser() user: JwtUser) {
    return this.iam.listRoles(user.tid);
  }

  @Post('roles')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    'rbac:manage',
    'roles.create',
    'roles.update',
  )
  saveRole(@CurrentUser() user: JwtUser, @Body() body: SchoolIamSaveRoleDto) {
    return this.iam.saveRole(user.tid, user, body);
  }

  @Post('roles/:id/clone')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    'rbac:manage',
    'roles.create',
  )
  clone(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.iam.cloneRole(user.tid, user, id);
  }

  @Delete('roles/:id')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    'rbac:manage',
    'roles.delete',
  )
  delRole(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.iam.deactivateRole(user.tid, user, id);
  }

  @Post('invites')
  @RequireAnyPermission(...MANAGE)
  invite(@CurrentUser() user: JwtUser, @Body() body: SchoolIamInviteDto) {
    return this.iam.invite(user.tid, user, body);
  }

  @Get('invites')
  @RequireAnyPermission(...VIEW)
  invites(@CurrentUser() user: JwtUser) {
    return this.iam.listInvites(user.tid);
  }

  @Post('invites/:id/resend')
  @RequireAnyPermission(...MANAGE)
  resend(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.iam.resendInvite(user.tid, user, id);
  }

  @Post('invites/:id/revoke')
  @RequireAnyPermission(...MANAGE)
  revokeInvite(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.iam.revokeInvite(user.tid, user, id);
  }

  @Get('sessions')
  @RequireAnyPermission(...VIEW, 'security.audit.view')
  sessions(@CurrentUser() user: JwtUser, @Query('userId') userId?: string) {
    return this.iam.sessions(user.tid, userId);
  }

  @Delete('sessions/:id')
  @RequireAnyPermission(...MANAGE)
  killSession(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.iam.revokeSession(user.tid, user, id);
  }

  @Get('login-history')
  @RequireAnyPermission(...VIEW, 'security.audit.view')
  history(@CurrentUser() user: JwtUser, @Query('userId') userId?: string) {
    return this.iam.loginHistory(user.tid, userId);
  }

  @Get('audit')
  @RequireAnyPermission(...VIEW, 'security.audit.view')
  audit(@CurrentUser() user: JwtUser) {
    return this.iam.audits(user.tid);
  }

  @Get('alerts')
  @RequireAnyPermission(...VIEW, 'security.audit.view')
  alerts(@CurrentUser() user: JwtUser) {
    return this.iam.alerts(user.tid);
  }

  @Get('security-settings')
  @RequireAnyPermission(...VIEW)
  sec(@CurrentUser() user: JwtUser) {
    return this.iam.securitySettings(user.tid);
  }

  @Patch('security-settings')
  @RequireAnyPermission(...MANAGE)
  saveSec(@CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) {
    return this.iam.saveSecuritySettings(user.tid, user, body);
  }

  @Get('link-options')
  @RequireAnyPermission(...VIEW)
  links(@CurrentUser() user: JwtUser, @Query('q') q?: string) {
    return this.iam.linkOptions(user.tid, q ?? '');
  }
}
