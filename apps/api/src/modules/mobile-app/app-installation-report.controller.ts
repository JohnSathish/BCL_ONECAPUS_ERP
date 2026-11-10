import { Controller, Get, Query, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import { AppInstallationReportService } from './app-installation-report.service';
import {
  AppInstallationExportQueryDto,
  AppInstallationReportQueryDto,
} from './dto/app-installation-report.dto';

const INSTALL_REPORT = [
  'mobile:settings:read',
  'mobile:settings:manage',
] as const;

@ApiBearerAuth()
@ApiTags('mobile-app')
@Controller({ path: 'mobile-app/installation-report', version: '1' })
export class AppInstallationReportController {
  constructor(private readonly reports: AppInstallationReportService) {}

  @Get()
  @RequireAnyPermission(...INSTALL_REPORT)
  report(
    @CurrentUser() user: JwtUser,
    @Query() query: AppInstallationReportQueryDto,
  ) {
    return this.reports.report(user.tid, query);
  }

  @Get('export')
  @RequireAnyPermission(...INSTALL_REPORT)
  async export(
    @CurrentUser() user: JwtUser,
    @Query() query: AppInstallationExportQueryDto,
  ) {
    const file = await this.reports.export(user.tid, query);
    return new StreamableFile(file.buffer, {
      type: file.contentType,
      disposition: `attachment; filename="${file.filename}"`,
    });
  }
}
