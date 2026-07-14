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
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import { RequireModule } from '../licensing/decorators/require-module.decorator';
import { HelpdeskService } from './services/helpdesk.service';

@ApiBearerAuth()
@ApiTags('helpdesk')
@RequireModule('helpdesk')
@Controller({ path: 'helpdesk', version: '1' })
export class HelpdeskController {
  constructor(private readonly helpdesk: HelpdeskService) {}

  @Post('tickets')
  @RequireAnyPermission('helpdesk:read', 'helpdesk:manage')
  create(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      category?: string;
      subject: string;
      description?: string;
      priority?: string;
    },
  ) {
    return this.helpdesk.create(user, body);
  }

  @Get('tickets')
  @RequireAnyPermission('helpdesk:read', 'helpdesk:manage')
  list(
    @CurrentUser() user: JwtUser,
    @Query('status') status?: string,
    @Query('assigneeUserId') assigneeUserId?: string,
  ) {
    return this.helpdesk.list(user.tid, { status, assigneeUserId });
  }

  @Get('tickets/:id')
  @RequireAnyPermission('helpdesk:read', 'helpdesk:manage')
  get(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.helpdesk.get(user.tid, id);
  }

  @Post('tickets/:id/assign')
  @RequirePermissions('helpdesk:manage')
  assign(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { assigneeUserId: string },
  ) {
    return this.helpdesk.assign(user, id, body.assigneeUserId);
  }

  @Post('tickets/:id/comments')
  @RequireAnyPermission('helpdesk:read', 'helpdesk:manage')
  comment(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { body: string; isInternal?: boolean },
  ) {
    return this.helpdesk.comment(user, id, body.body, body.isInternal);
  }

  @Patch('tickets/:id/status')
  @RequirePermissions('helpdesk:manage')
  transition(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.helpdesk.transition(user, id, body.status);
  }
}
