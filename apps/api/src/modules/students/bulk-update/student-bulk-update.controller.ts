import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  CurrentUser,
  type JwtUser,
} from '../../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../../common/decorators/require-permissions.decorator';
import {
  BulkUpdateApplyDto,
  BulkUpdateCsvImportDto,
  BulkUpdatePreviewDto,
} from './dto/bulk-update.dto';
import { StudentBulkUpdateService } from './student-bulk-update.service';

function clientIp(req: Request) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim();
  return req.ip;
}

@ApiBearerAuth()
@ApiTags('students-bulk-update')
@Controller({ path: 'students/bulk-update', version: '1' })
export class StudentBulkUpdateController {
  constructor(private readonly bulkUpdate: StudentBulkUpdateService) {}

  @Get('fields')
  @RequireAnyPermission('students:bulk-update', 'students:manage')
  getFields() {
    return this.bulkUpdate.getFields();
  }

  @Get('batches')
  @RequireAnyPermission('students:bulk-update', 'students:manage')
  listBatches(@CurrentUser() user: JwtUser) {
    return this.bulkUpdate.listBatches(user.tid);
  }

  @Get('batches/:id')
  @RequireAnyPermission('students:bulk-update', 'students:manage')
  getBatch(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.bulkUpdate.getBatch(user.tid, id);
  }

  @Post('preview')
  @RequireAnyPermission('students:bulk-update', 'students:manage')
  preview(
    @CurrentUser() user: JwtUser,
    @Body() dto: BulkUpdatePreviewDto,
    @Req() req: Request,
  ) {
    return this.bulkUpdate.preview(user, dto, clientIp(req));
  }

  @Post('apply')
  @RequireAnyPermission('students:bulk-update', 'students:manage')
  apply(
    @CurrentUser() user: JwtUser,
    @Body() dto: BulkUpdateApplyDto,
    @Req() req: Request,
  ) {
    return this.bulkUpdate.apply(
      user,
      dto.batchId,
      dto.forceApply,
      clientIp(req),
    );
  }

  @Post('rollback/:batchId')
  @RequirePermissions('students:bulk-update:rollback')
  rollback(@CurrentUser() user: JwtUser, @Param('batchId') batchId: string) {
    return this.bulkUpdate.rollback(user, batchId);
  }

  @Post('csv-import')
  @RequireAnyPermission('students:bulk-update', 'students:manage')
  csvImport(@CurrentUser() user: JwtUser, @Body() dto: BulkUpdateCsvImportDto) {
    return this.bulkUpdate.importCsvPreview(user, dto.fieldKeys, dto.csvRows);
  }
}
