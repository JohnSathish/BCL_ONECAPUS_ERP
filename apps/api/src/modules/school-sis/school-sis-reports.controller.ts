import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import { extractClientIp } from '../../common/utils/request-host';
import {
  SCHOOL_SIS_PERMISSION_MANAGE,
  SCHOOL_SIS_PERMISSION_READ,
} from './school-sis.constants';
import { SchoolSisReportsService } from './school-sis-reports.service';
import { SchoolReportExportDto } from './dto/school-report.dto';

const VIEW = [
  SCHOOL_SIS_PERMISSION_READ,
  SCHOOL_SIS_PERMISSION_MANAGE,
  'reports.view',
  'fees.reports.export',
] as const;

@ApiBearerAuth()
@ApiTags('school-sis-reports')
@Controller({ path: 'school-sis/reports', version: '1' })
export class SchoolSisReportsController {
  constructor(private readonly reports: SchoolSisReportsService) {}

  @Get('catalog')
  @RequireAnyPermission(...VIEW)
  catalog(@CurrentUser() user: JwtUser) {
    return this.reports.catalog(user);
  }

  @Get('preview')
  @RequireAnyPermission(...VIEW)
  preview(
    @CurrentUser() user: JwtUser,
    @Query('key') key: string,
    @Query() query: Record<string, string>,
  ) {
    const { key: _k, ...filters } = query;
    return this.reports.preview(user.tid, user, key, filters);
  }

  @Post('export')
  @RequireAnyPermission(...VIEW, 'reports.export.pdf', 'reports.export.excel')
  async export(
    @CurrentUser() user: JwtUser,
    @Body() body: SchoolReportExportDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const file = await this.reports.export(user.tid, user, {
      ...body,
      ip: extractClientIp(req),
    });
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    res.send(file.buffer);
  }

  @Get('design')
  @RequireAnyPermission(...VIEW)
  design(@CurrentUser() user: JwtUser) {
    return this.reports.design(user.tid);
  }

  @Patch('design')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  saveDesign(
    @CurrentUser() user: JwtUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.reports.saveDesign(user.tid, user, body);
  }

  @Get('audit')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    'security.audit.view',
    'reports.view',
  )
  audit(@CurrentUser() user: JwtUser) {
    return this.reports.audits(user.tid);
  }
}
