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
} from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import {
  ListLoginHistoryQueryDto,
  ListSessionsQueryDto,
  UpdateSecuritySettingsDto,
} from '../dto/security.dto';
import { SecurityService } from '../services/security.service';

@ApiBearerAuth()
@ApiTags('admin-security')
@Controller({ path: 'admin/security', version: '1' })
export class SecurityController {
  constructor(private readonly security: SecurityService) {}

  @Get('settings')
  @RequirePermissions('sessions:manage')
  getSettings(@CurrentUser() user: JwtUser) {
    return this.security.getSettings(user.tid);
  }

  @Patch('settings')
  @RequirePermissions('sessions:manage')
  updateSettings(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateSecuritySettingsDto,
  ) {
    return this.security.updateSettings(user.tid, dto, user.sub);
  }

  @Get('sessions')
  @RequirePermissions('sessions:manage')
  listSessions(
    @CurrentUser() user: JwtUser,
    @Query() query: ListSessionsQueryDto,
  ) {
    return this.security.listActiveSessions(user.tid, query);
  }

  @Post('sessions/:id/revoke')
  @RequirePermissions('sessions:manage')
  revokeSession(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.security.revokeSession(user.tid, id, user.sub);
  }

  @Post('users/:userId/sessions/revoke-all')
  @RequirePermissions('sessions:manage')
  revokeAll(@CurrentUser() user: JwtUser, @Param('userId') userId: string) {
    return this.security.revokeAllUserSessions(user.tid, userId, user.sub);
  }

  @Get('login-history')
  @RequirePermissions('sessions:manage')
  loginHistory(
    @CurrentUser() user: JwtUser,
    @Query() query: ListLoginHistoryQueryDto,
  ) {
    return this.security.listLoginHistory(user.tid, query);
  }
}
