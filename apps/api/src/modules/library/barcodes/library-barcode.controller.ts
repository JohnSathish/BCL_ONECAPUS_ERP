import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  CurrentUser,
  type JwtUser,
} from '../../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../../common/decorators/require-permissions.decorator';
import { exportCatalogueReport } from '../reports/library-catalogue-report.export';
import {
  AlignBarcodesDto,
  BarcodeCopyQueryDto,
  BarcodePreviewDto,
  CreateBarcodeJobDto,
  LabelSettingsDto,
  UpdateBarcodeJobDto,
} from './library-barcode.dto';
import { LibraryBarcodeService } from './library-barcode.service';

@ApiBearerAuth()
@ApiTags('library')
@RequireAnyPermission(
  'library:manage',
  'library:circulate',
  'library:reports',
  'library:settings',
)
@Controller({ path: 'library/barcodes', version: '1' })
export class LibraryBarcodeController {
  constructor(private readonly barcodes: LibraryBarcodeService) {}

  @Get('summary')
  summary(@CurrentUser() user: JwtUser) {
    return this.barcodes.summary(user.tid);
  }

  @Get('settings')
  settings(@CurrentUser() user: JwtUser) {
    return this.barcodes.getSettings(user.tid);
  }

  @Put('settings')
  @RequireAnyPermission('library:settings', 'library:manage')
  saveSettings(@CurrentUser() user: JwtUser, @Body() dto: LabelSettingsDto) {
    return this.barcodes.saveSettings(user.tid, dto);
  }

  @Get('copies/ids')
  copyIds(@CurrentUser() user: JwtUser, @Query() query: BarcodeCopyQueryDto) {
    return this.barcodes.copyIds(user.tid, query);
  }

  @Get('copies')
  copies(@CurrentUser() user: JwtUser, @Query() query: BarcodeCopyQueryDto) {
    return this.barcodes.copies(user.tid, query);
  }

  @Post('align')
  @RequireAnyPermission('library:manage')
  align(@CurrentUser() user: JwtUser, @Body() dto: AlignBarcodesDto) {
    return this.barcodes.alignBarcodes(user.tid, user.sub, dto);
  }

  @Post('preview')
  @RequireAnyPermission('library:manage', 'library:circulate')
  preview(@CurrentUser() user: JwtUser, @Body() dto: BarcodePreviewDto) {
    return this.barcodes.preview(user.tid, dto.copyIds);
  }

  @Post('jobs')
  @RequireAnyPermission('library:manage', 'library:circulate')
  createJob(@CurrentUser() user: JwtUser, @Body() dto: CreateBarcodeJobDto) {
    return this.barcodes.createJob(user.tid, user, dto);
  }

  @Get('jobs')
  jobs(@CurrentUser() user: JwtUser, @Query('page') page?: string) {
    const parsed = Number(page);
    return this.barcodes.jobs(
      user.tid,
      Number.isFinite(parsed) && parsed > 0 ? parsed : 1,
    );
  }

  @Patch('jobs/:id')
  @RequireAnyPermission('library:manage', 'library:circulate')
  updateJob(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateBarcodeJobDto,
  ) {
    return this.barcodes.updateJob(user.tid, id, dto);
  }

  @Get('reports')
  reports() {
    return this.barcodes.definitions();
  }

  @Get('reports/:key/export')
  async download(
    @CurrentUser() user: JwtUser,
    @Param('key') key: string,
    @Query() query: BarcodeCopyQueryDto,
    @Query('format') format: string,
    @Res() res: Response,
  ) {
    const kind = format === 'csv' || format === 'pdf' ? format : 'xlsx';
    const payload = await this.barcodes.report(user.tid, key, {
      ...query,
      page: 1,
      limit: kind === 'pdf' ? 400 : 10000,
    });
    if (payload.total > payload.rows.length) {
      payload.notes = [
        ...payload.notes,
        `This file contains ${payload.rows.length} of ${payload.total} rows. Narrow the filters for a shorter list.`,
      ];
    }
    const file = await exportCatalogueReport(payload, kind);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${key}.${file.extension}"`,
    );
    res.send(file.body);
  }

  @Get('reports/:key')
  report(
    @CurrentUser() user: JwtUser,
    @Param('key') key: string,
    @Query() query: BarcodeCopyQueryDto,
  ) {
    return this.barcodes.report(user.tid, key, query);
  }
}
