import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../../common/decorators/require-permissions.decorator';
import {
  CreateAccessPointDto,
  CreateKioskDeviceDto,
  UpdateAccessPointDto,
} from '../dto/campus-access.dto';
import { AccessPointService } from '../services/access-point.service';
import { CampusAccessDashboardService } from '../services/campus-access-dashboard.service';
import { buildKioskUrl, generateKioskToken } from '../utils/kiosk-token.util';

@ApiTags('campus-access')
@Controller({ path: 'admin/campus-access', version: '1' })
export class CampusAccessAdminController {
  constructor(
    private readonly accessPoints: AccessPointService,
    private readonly dashboardService: CampusAccessDashboardService,
  ) {}

  @Get('access-points')
  @RequireAnyPermission('cams:read', 'cams:manage')
  listPoints(@CurrentUser() user: JwtUser) {
    return this.accessPoints.list(user.tid);
  }

  @Post('access-points')
  @RequireAnyPermission('cams:manage')
  createPoint(@CurrentUser() user: JwtUser, @Body() dto: CreateAccessPointDto) {
    return this.accessPoints.create(user.tid, dto);
  }

  @Get('access-points/:id')
  @RequireAnyPermission('cams:read', 'cams:manage')
  getPoint(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.accessPoints.getById(user.tid, id);
  }

  @Patch('access-points/:id')
  @RequireAnyPermission('cams:manage')
  updatePoint(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateAccessPointDto,
  ) {
    return this.accessPoints.update(user.tid, id, dto);
  }

  @Post('access-points/:id/devices')
  @RequireAnyPermission('cams:manage')
  async createDevice(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CreateKioskDeviceDto,
  ) {
    const { token, hash, prefix } = generateKioskToken();
    const point = await this.accessPoints.getById(user.tid, id);
    const device = await this.accessPoints.createDevice(
      user.tid,
      id,
      dto.name,
      token,
      hash,
      prefix,
    );
    return {
      device: {
        id: device.id,
        name: device.name,
        tokenPrefix: device.tokenPrefix,
      },
      kioskUrl: buildKioskUrl(point.code, token),
      token,
    };
  }

  @Get('dashboard')
  @RequireAnyPermission('cams:read', 'cams:manage', 'cams:reports')
  dashboard(@CurrentUser() user: JwtUser) {
    return this.dashboardService.dashboard(user.tid);
  }
}
