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
import { AlumniService } from './services/alumni.service';

@ApiBearerAuth()
@ApiTags('alumni')
@RequireModule('alumni')
@Controller({ path: 'alumni', version: '1' })
export class AlumniController {
  constructor(private readonly alumni: AlumniService) {}

  @Get()
  @RequireAnyPermission('alumni:read', 'alumni:manage')
  list(
    @CurrentUser() user: JwtUser,
    @Query('q') q?: string,
    @Query('graduationYear') graduationYear?: string,
  ) {
    return this.alumni.list(user.tid, {
      q,
      graduationYear: graduationYear ? Number(graduationYear) : undefined,
    });
  }

  @Get(':id')
  @RequireAnyPermission('alumni:read', 'alumni:manage')
  async get(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.alumni.get(user.tid, id);
  }

  @Post()
  @RequirePermissions('alumni:manage')
  create(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      studentId?: string;
      userId?: string;
      fullName: string;
      graduationYear?: number;
      programme?: string;
      email?: string;
      phone?: string;
      currentOrg?: string;
      currentRole?: string;
      mentorshipOptIn?: boolean;
    },
  ) {
    return this.alumni.create(user, body);
  }

  @Patch(':id')
  @RequirePermissions('alumni:manage')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body()
    body: Partial<{
      fullName: string;
      graduationYear: number;
      programme: string;
      email: string;
      phone: string;
      currentOrg: string;
      currentRole: string;
      mentorshipOptIn: boolean;
      status: string;
    }>,
  ) {
    return this.alumni.update(user.tid, id, body);
  }
}
