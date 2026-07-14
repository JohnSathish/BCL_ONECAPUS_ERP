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
import { PlacementService } from './services/placement.service';

@ApiBearerAuth()
@ApiTags('placement')
@RequireModule('placement')
@Controller({ path: 'placement', version: '1' })
export class PlacementController {
  constructor(private readonly placement: PlacementService) {}

  @Get('recruiters')
  @RequireAnyPermission('placement:read', 'placement:manage')
  listRecruiters(@CurrentUser() user: JwtUser) {
    return this.placement.listRecruiters(user.tid);
  }

  @Post('recruiters')
  @RequirePermissions('placement:manage')
  createRecruiter(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      name: string;
      contactEmail?: string;
      contactPhone?: string;
      industry?: string;
      website?: string;
    },
  ) {
    return this.placement.createRecruiter(user, body);
  }

  @Get('drives')
  @RequireAnyPermission('placement:read', 'placement:manage')
  listDrives(
    @CurrentUser() user: JwtUser,
    @Query('recruiterId') recruiterId?: string,
  ) {
    return this.placement.listDrives(user.tid, recruiterId);
  }

  @Post('drives')
  @RequirePermissions('placement:manage')
  createDrive(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      recruiterId: string;
      title: string;
      driveDate?: string;
      jobRole?: string;
      packageLpa?: number;
      eligibility?: Record<string, unknown>;
      status?: string;
    },
  ) {
    return this.placement.createDrive(user, body);
  }

  @Get('applications')
  @RequireAnyPermission('placement:read', 'placement:manage')
  listApplications(
    @CurrentUser() user: JwtUser,
    @Query('driveId') driveId?: string,
  ) {
    return this.placement.listApplications(user.tid, driveId);
  }

  @Post('applications')
  @RequirePermissions('placement:manage')
  apply(
    @CurrentUser() user: JwtUser,
    @Body() body: { driveId: string; studentId: string; status?: string },
  ) {
    return this.placement.apply(user, body);
  }

  @Patch('applications/:id/status')
  @RequirePermissions('placement:manage')
  updateStatus(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.placement.updateApplicationStatus(user.tid, id, body.status);
  }
}
