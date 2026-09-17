import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import {
  SCHOOL_SIS_PERMISSION_MANAGE,
  SCHOOL_SIS_PERMISSION_READ,
} from './school-sis.constants';
import { SchoolSisAccountSecurityService } from './school-sis-account-security.service';

const VIEW = [
  SCHOOL_SIS_PERMISSION_READ,
  SCHOOL_SIS_PERMISSION_MANAGE,
  'users:read',
  'users.view',
] as const;
const MANAGE = [
  SCHOOL_SIS_PERMISSION_MANAGE,
  'users:manage',
  'users.update',
] as const;

@ApiBearerAuth()
@ApiTags('school-sis-account-security')
@Controller({ path: 'school-sis/account-security', version: '1' })
export class SchoolSisAccountSecurityController {
  constructor(private readonly security: SchoolSisAccountSecurityService) {}

  @Get('settings')
  @RequireAnyPermission(...VIEW)
  settings(@CurrentUser() user: JwtUser) {
    return this.security.settings(user.tid);
  }

  @Patch('settings')
  @RequireAnyPermission(...MANAGE)
  saveSettings(
    @CurrentUser() user: JwtUser,
    @Body() body: Record<string, number | boolean>,
  ) {
    return this.security.saveSettings(user.tid, user, body);
  }

  @Get('students')
  @RequireAnyPermission(...VIEW)
  students(
    @CurrentUser() user: JwtUser,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('sectionId') sectionId?: string,
  ) {
    return this.security.listStudents(user.tid, q, status, sectionId);
  }

  @Post('users/:userId/activation-code')
  @RequireAnyPermission(...MANAGE)
  issue(@CurrentUser() user: JwtUser, @Param('userId') userId: string) {
    return this.security.issueCode(user.tid, user, userId);
  }

  @Post('bulk-codes')
  @RequireAnyPermission(...MANAGE)
  bulk(@CurrentUser() user: JwtUser, @Body() body: { sectionId?: string }) {
    return this.security.bulkCodes(
      user.tid,
      user,
      String(body.sectionId || ''),
    );
  }

  @Post('users/:userId/unlock')
  @RequireAnyPermission(...MANAGE)
  unlock(@CurrentUser() user: JwtUser, @Param('userId') userId: string) {
    return this.security.unlock(user.tid, user, userId);
  }

  @Post('users/:userId/disable')
  @RequireAnyPermission(...MANAGE)
  disable(@CurrentUser() user: JwtUser, @Param('userId') userId: string) {
    return this.security.disable(user.tid, user, userId);
  }

  @Post('users/:userId/revoke-sessions')
  @RequireAnyPermission(...MANAGE)
  revoke(@CurrentUser() user: JwtUser, @Param('userId') userId: string) {
    return this.security.revokeSessions(user.tid, user, userId);
  }

  @Post('users/:userId/reset-password')
  @RequireAnyPermission(...MANAGE)
  resetPassword(@CurrentUser() user: JwtUser, @Param('userId') userId: string) {
    return this.security.resetPassword(user.tid, user, userId);
  }

  @Get('events')
  @RequireAnyPermission(...VIEW)
  events(@CurrentUser() user: JwtUser, @Query('userId') userId?: string) {
    return this.security.events(user.tid, userId);
  }
}
