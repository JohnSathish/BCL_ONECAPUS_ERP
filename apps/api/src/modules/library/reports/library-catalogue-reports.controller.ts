import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  CurrentUser,
  type JwtUser,
} from '../../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../../common/decorators/require-permissions.decorator';
import { CatalogueReportQueryDto } from '../dto/catalogue-report.dto';
import { exportCatalogueReport } from './library-catalogue-report.export';
import { LibraryCatalogueReportsService } from './library-catalogue-reports.service';

@ApiBearerAuth()
@ApiTags('library')
@RequireAnyPermission('library:reports', 'library:manage', 'library:read')
@Controller({ path: 'library/catalogue-reports', version: '1' })
export class LibraryCatalogueReportsController {
  constructor(private readonly reports: LibraryCatalogueReportsService) {}

  @Get()
  definitions() {
    return this.reports.definitions();
  }

  @Get('options')
  options(@CurrentUser() user: JwtUser) {
    return this.reports.options(user.tid);
  }

  @Get('dashboard')
  dashboard(@CurrentUser() user: JwtUser) {
    return this.reports.dashboard(user.tid);
  }

  @Get(':key/export')
  async download(
    @CurrentUser() user: JwtUser,
    @Param('key') key: string,
    @Query() query: CatalogueReportQueryDto,
    @Query('format') format: string,
    @Res() res: Response,
  ) {
    const kind = format === 'csv' || format === 'pdf' ? format : 'xlsx';
    const payload = await this.reports.run(
      user.tid,
      key,
      { ...query, page: 1, limit: kind === 'pdf' ? 400 : 10000 },
      canSeeBorrowers(user),
    );
    if (payload.total > payload.rows.length) {
      payload.notes = [
        ...payload.notes,
        `This file contains ${payload.rows.length} of ${payload.total} rows. Narrow the filters for a shorter list.`,
      ];
    }
    const file = await exportCatalogueReport(payload, kind);
    const name = `${key}.${file.extension}`;
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.send(file.body);
  }

  @Get(':key')
  run(
    @CurrentUser() user: JwtUser,
    @Param('key') key: string,
    @Query() query: CatalogueReportQueryDto,
  ) {
    return this.reports.run(user.tid, key, query, canSeeBorrowers(user));
  }
}

function canSeeBorrowers(user: JwtUser) {
  const permissions = user.permissions ?? [];
  return (
    permissions.includes('library:manage') ||
    permissions.includes('library:circulate')
  );
}
