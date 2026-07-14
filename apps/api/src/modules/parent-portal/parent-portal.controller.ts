import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { ParentPortalService } from './services/parent-portal.service';

@ApiBearerAuth()
@ApiTags('parent-portal')
@RequireModule('parentPortal')
@Controller({ path: 'parent-portal', version: '1' })
export class ParentPortalController {
  constructor(private readonly portal: ParentPortalService) {}

  @Get('links')
  @RequireAnyPermission('parent-portal:read', 'parent-portal:manage')
  listLinks(
    @CurrentUser() user: JwtUser,
    @Query('parentUserId') parentUserId?: string,
  ) {
    return this.portal.listLinks(user.tid, parentUserId);
  }

  @Post('links')
  @RequirePermissions('parent-portal:manage')
  createLink(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      parentUserId: string;
      studentId: string;
      relationship?: string;
      isPrimary?: boolean;
    },
  ) {
    return this.portal.createLink(user, body);
  }

  @Delete('links/:id')
  @RequirePermissions('parent-portal:manage')
  deleteLink(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.portal.deleteLink(user.tid, id);
  }

  @Get('me/wards')
  @RequireAnyPermission('parent:portal:self', 'parent-portal:read')
  myWards(@CurrentUser() user: JwtUser) {
    return this.portal.myWards(user);
  }

  @Get('me/wards/:studentId')
  @RequireAnyPermission('parent:portal:self', 'parent-portal:read')
  wardSummary(
    @CurrentUser() user: JwtUser,
    @Param('studentId') studentId: string,
  ) {
    return this.portal.wardSummary(user, studentId);
  }
}
