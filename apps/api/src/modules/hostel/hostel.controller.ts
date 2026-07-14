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
import { HostelService } from './services/hostel.service';

@ApiBearerAuth()
@ApiTags('hostel')
@RequireModule('hostel')
@Controller({ path: 'hostel', version: '1' })
export class HostelController {
  constructor(private readonly hostel: HostelService) {}

  @Get('blocks')
  @RequireAnyPermission('hostel:read', 'hostel:manage')
  listBlocks(@CurrentUser() user: JwtUser) {
    return this.hostel.listBlocks(user.tid);
  }

  @Post('blocks')
  @RequirePermissions('hostel:manage')
  createBlock(
    @CurrentUser() user: JwtUser,
    @Body()
    body: { code: string; name: string; gender?: string; capacity?: number },
  ) {
    return this.hostel.createBlock(user, body);
  }

  @Post('rooms')
  @RequirePermissions('hostel:manage')
  createRoom(
    @CurrentUser() user: JwtUser,
    @Body() body: { blockId: string; roomNo: string; capacity?: number },
  ) {
    return this.hostel.createRoom(user, body);
  }

  @Get('allotments')
  @RequireAnyPermission('hostel:read', 'hostel:manage')
  listAllotments(
    @CurrentUser() user: JwtUser,
    @Query('roomId') roomId?: string,
  ) {
    return this.hostel.listAllotments(user.tid, roomId);
  }

  @Post('allotments')
  @RequirePermissions('hostel:manage')
  allot(
    @CurrentUser() user: JwtUser,
    @Body()
    body: { roomId: string; studentId: string; allottedAt?: string },
  ) {
    return this.hostel.allot(user, body);
  }

  @Post('allotments/:id/vacate')
  @RequirePermissions('hostel:manage')
  vacate(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.hostel.vacate(user.tid, id);
  }
}
