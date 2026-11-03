import { Controller, Get, Query, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../../common/decorators/require-permissions.decorator';
import {
  CirculationAnalyticsQueryDto,
  CirculationExportQueryDto,
  CirculationReportQueryDto,
} from '../dto/circulation-report.dto';
import { LibraryCirculationReportsService } from './library-circulation-reports.service';

const LIB_REPORTS = ['library:reports', 'library:manage'] as const;

@ApiBearerAuth()
@ApiTags('library-circulation-reports')
@Controller({ path: 'library/reports/circulation', version: '1' })
export class LibraryCirculationReportsController {
  constructor(private readonly reports: LibraryCirculationReportsService) {}

  @Get('options')
  @RequireAnyPermission(...LIB_REPORTS)
  options(@CurrentUser() user: JwtUser) {
    return this.reports.options(user.tid);
  }

  @Get('summary')
  @RequireAnyPermission(...LIB_REPORTS)
  summary(
    @CurrentUser() user: JwtUser,
    @Query() query: CirculationReportQueryDto,
  ) {
    return this.reports.summary(user.tid, query);
  }

  @Get('rows')
  @RequireAnyPermission(...LIB_REPORTS)
  rows(
    @CurrentUser() user: JwtUser,
    @Query() query: CirculationReportQueryDto,
  ) {
    return this.reports.rows(user.tid, query);
  }

  @Get('analytics')
  @RequireAnyPermission(...LIB_REPORTS)
  analytics(
    @CurrentUser() user: JwtUser,
    @Query() query: CirculationAnalyticsQueryDto,
  ) {
    return this.reports.analytics(user.tid, query);
  }

  @Get('export')
  @RequireAnyPermission(...LIB_REPORTS)
  async export(
    @CurrentUser() user: JwtUser,
    @Query() query: CirculationExportQueryDto,
  ) {
    const file = await this.reports.export(user.tid, query);
    return new StreamableFile(file.buffer, {
      type: file.contentType,
      disposition: `attachment; filename="${file.filename}"`,
    });
  }
}
