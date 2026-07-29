import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import {
  WebsitePopupService,
  type WebsitePopupDto,
} from './website-popup.service';

@ApiBearerAuth()
@ApiTags('website-admin')
@Controller({ path: 'website/admin/popups', version: '1' })
export class WebsitePopupAdminController {
  constructor(private readonly popups: WebsitePopupService) {}

  @Get()
  @RequireAnyPermission('website:read', 'website:edit', 'website:manage')
  list(@CurrentUser() user: JwtUser) {
    return this.popups.listAdmin(user.tid);
  }

  @Post()
  @RequireAnyPermission('website:edit', 'website:manage')
  create(@CurrentUser() user: JwtUser, @Body() body: WebsitePopupDto) {
    return this.popups.create(user, body);
  }

  @Patch(':popupId')
  @RequireAnyPermission('website:edit', 'website:manage')
  update(
    @CurrentUser() user: JwtUser,
    @Param('popupId') popupId: string,
    @Body() body: Partial<WebsitePopupDto>,
  ) {
    return this.popups.update(user, popupId, body);
  }

  @Delete(':popupId')
  @RequireAnyPermission('website:edit', 'website:manage')
  remove(@CurrentUser() user: JwtUser, @Param('popupId') popupId: string) {
    return this.popups.delete(user, popupId);
  }

  @Patch(':popupId/status')
  @RequireAnyPermission('website:edit', 'website:manage')
  updateStatus(
    @CurrentUser() user: JwtUser,
    @Param('popupId') popupId: string,
    @Body() body: { status: string },
  ) {
    return this.popups.updateStatus(user, popupId, body.status);
  }

  @Post(':popupId/duplicate')
  @RequireAnyPermission('website:edit', 'website:manage')
  duplicate(@CurrentUser() user: JwtUser, @Param('popupId') popupId: string) {
    return this.popups.duplicate(user, popupId);
  }

  @Post(':popupId/preview')
  @RequireAnyPermission('website:read', 'website:edit', 'website:manage')
  preview(@CurrentUser() user: JwtUser, @Param('popupId') popupId: string) {
    return this.popups.preview(user, popupId);
  }
}
