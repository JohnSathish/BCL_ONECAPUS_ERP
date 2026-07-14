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
import { InternshipService } from './services/internship.service';

@ApiBearerAuth()
@ApiTags('internship')
@RequireModule('internship')
@Controller({ path: 'internship', version: '1' })
export class InternshipController {
  constructor(private readonly internship: InternshipService) {}

  @Get('companies')
  @RequireAnyPermission('internship:read', 'internship:manage')
  listCompanies(@CurrentUser() user: JwtUser) {
    return this.internship.listCompanies(user.tid);
  }

  @Post('companies')
  @RequirePermissions('internship:manage')
  createCompany(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      name: string;
      contactEmail?: string;
      contactPhone?: string;
      address?: string;
    },
  ) {
    return this.internship.createCompany(user, body);
  }

  @Get('placements')
  @RequireAnyPermission('internship:read', 'internship:manage')
  listPlacements(
    @CurrentUser() user: JwtUser,
    @Query('companyId') companyId?: string,
  ) {
    return this.internship.listPlacements(user.tid, companyId);
  }

  @Post('placements')
  @RequirePermissions('internship:manage')
  createPlacement(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      companyId: string;
      studentId: string;
      mentorStaffId?: string;
      title: string;
      startDate?: string;
      endDate?: string;
      status?: string;
    },
  ) {
    return this.internship.createPlacement(user, body);
  }

  @Patch('placements/:id')
  @RequirePermissions('internship:manage')
  updatePlacement(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body()
    body: {
      status?: string;
      evaluationScore?: number;
      evaluationNotes?: string;
      endDate?: string;
    },
  ) {
    return this.internship.updatePlacement(user.tid, id, body);
  }
}
