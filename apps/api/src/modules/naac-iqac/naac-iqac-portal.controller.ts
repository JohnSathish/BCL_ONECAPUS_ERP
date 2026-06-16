import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import {
  CreateDepartmentSubmissionDto,
  CreateFacultyAchievementDto,
  ListQueryDto,
} from './dto/naac-iqac.dto';
import { NaacAchievementService } from './services/naac-achievement.service';
import { NaacDashboardService } from './services/naac-dashboard.service';
import { NaacDepartmentService } from './services/naac-department.service';

const NIQ_PORTAL = [
  'naac-iqac:portal',
  'naac-iqac:collect',
  'naac-iqac:manage',
] as const;

@ApiBearerAuth()
@ApiTags('naac-iqac-portal')
@Controller({ path: 'naac-iqac/me', version: '1' })
export class NaacIqacPortalController {
  constructor(
    private readonly dashboard: NaacDashboardService,
    private readonly achievements: NaacAchievementService,
    private readonly department: NaacDepartmentService,
  ) {}

  @Get('dashboard')
  @RequireAnyPermission(...NIQ_PORTAL)
  portalDashboard(@CurrentUser() user: JwtUser) {
    return this.dashboard.dashboard(user.tid);
  }

  @Get('staff-context')
  @RequireAnyPermission(...NIQ_PORTAL)
  async portalStaffContext(@CurrentUser() user: JwtUser) {
    const staff = await this.achievements.resolveStaffProfile(user);
    return { staff };
  }

  @Get('department')
  @RequireAnyPermission(...NIQ_PORTAL)
  portalDepartment(@CurrentUser() user: JwtUser) {
    return this.department.dashboard(user);
  }

  @Get('achievements')
  @RequireAnyPermission(...NIQ_PORTAL)
  async myAchievements(
    @CurrentUser() user: JwtUser,
    @Query() query: ListQueryDto,
  ) {
    const staff = await this.achievements.resolveStaffProfile(user);
    return this.achievements.listFaculty(user.tid, query.page, query.limit, {
      staffProfileId: staff?.id,
    });
  }

  @Post('achievements')
  @RequireAnyPermission(...NIQ_PORTAL)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  submitAchievement(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateFacultyAchievementDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.achievements.createFaculty(user, dto, file);
  }

  @Post('submissions')
  @RequireAnyPermission(...NIQ_PORTAL)
  submitDepartmentData(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateDepartmentSubmissionDto,
  ) {
    return this.department.createSubmission(user, dto);
  }

  @Post('submissions/:id/submit')
  @RequireAnyPermission(...NIQ_PORTAL)
  submitDepartmentDraft(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.department.submitDraft(user, id);
  }
}
