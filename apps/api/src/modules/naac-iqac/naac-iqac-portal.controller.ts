import {
  Body,
  Controller,
  Get,
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

  @Get('achievements')
  @RequireAnyPermission(...NIQ_PORTAL)
  myAchievements(@CurrentUser() user: JwtUser, @Query() query: ListQueryDto) {
    return this.achievements.listFaculty(user.tid, query.page, query.limit);
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
}
