import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
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
import { VisitorManagementService } from './services/visitor-management.service';

@ApiBearerAuth()
@ApiTags('visitor-management')
@RequireModule('visitorManagement')
@Controller({ path: 'visitor-management', version: '1' })
export class VisitorManagementController {
  constructor(private readonly visitors: VisitorManagementService) {}

  @Get('visits')
  @RequireAnyPermission('visitor-management:read', 'visitor-management:manage')
  list(@CurrentUser() user: JwtUser, @Query('status') status?: string) {
    return this.visitors.list(user.tid, status);
  }

  @Post('visits/check-in')
  @RequirePermissions('visitor-management:manage')
  checkIn(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      visitorName: string;
      phone?: string;
      photoUrl?: string;
      vehicleNumber?: string;
      hostUserId?: string;
      hostName?: string;
      purpose?: string;
    },
  ) {
    return this.visitors.checkIn(user, body);
  }

  @Post('visits/:id/check-out')
  @RequirePermissions('visitor-management:manage')
  checkOut(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.visitors.checkOut(user.tid, id);
  }
}
