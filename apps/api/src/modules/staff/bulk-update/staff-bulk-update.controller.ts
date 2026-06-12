import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import {
  CurrentUser,
  type JwtUser,
} from '../../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../../common/decorators/require-permissions.decorator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import {
  StaffBulkUpdateApplyDto,
  StaffBulkUpdatePreviewDto,
  StaffBulkUpdateRowsDto,
  StaffBulkUpdateTemplateQueryDto,
} from './dto/staff-bulk-update.dto';
import { StaffBulkUpdateService } from './staff-bulk-update.service';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function clientIp(req: Request) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim();
  return req.ip;
}

@ApiBearerAuth()
@ApiTags('staff-bulk-update')
@Controller({ path: 'staff/bulk-update', version: '1' })
export class StaffBulkUpdateController {
  constructor(private readonly bulkUpdate: StaffBulkUpdateService) {}

  @Get('fields')
  @RequireAnyPermission('staff:bulk-update', 'staff:manage')
  getFields() {
    return this.bulkUpdate.getFields();
  }

  @Get('template')
  @RequireAnyPermission('staff:bulk-update', 'staff:manage')
  async downloadTemplate(
    @CurrentUser() user: JwtUser,
    @Query() query: StaffBulkUpdateTemplateQueryDto,
    @Res() res: Response,
  ) {
    const fieldKeys = query.fields
      .split(',')
      .map((field) => field.trim())
      .filter(Boolean);
    const buffer = await this.bulkUpdate.buildTemplate(
      user.tid,
      fieldKeys,
      query.matchingKey ?? 'employeeCode',
      query,
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="Staff_Bulk_Update_Template.xlsx"',
    );
    res.send(buffer);
  }

  @Get('batches')
  @RequireAnyPermission('staff:bulk-update', 'staff:manage')
  listBatches(
    @CurrentUser() user: JwtUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.bulkUpdate.listBatches(user.tid, query.limit ?? 20);
  }

  @Get('batches/:id')
  @RequireAnyPermission('staff:bulk-update', 'staff:manage')
  getBatch(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.bulkUpdate.getBatch(user.tid, id);
  }

  @Get('batches/:id/error-report')
  @RequireAnyPermission('staff:bulk-update', 'staff:manage')
  async downloadErrorReport(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const buffer = await this.bulkUpdate.buildErrorReport(user.tid, id);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="Staff_Bulk_Update_Error_Report.xlsx"',
    );
    res.send(buffer);
  }

  @Post('preview')
  @RequireAnyPermission('staff:bulk-update', 'staff:manage')
  preview(
    @CurrentUser() user: JwtUser,
    @Body() dto: StaffBulkUpdatePreviewDto,
    @Req() req: Request,
  ) {
    return this.bulkUpdate.preview(user, dto, clientIp(req));
  }

  @Post('apply')
  @RequireAnyPermission('staff:bulk-update', 'staff:manage')
  apply(
    @CurrentUser() user: JwtUser,
    @Body() dto: StaffBulkUpdateApplyDto,
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
  @RequirePermissions('staff:bulk-update:rollback')
  rollback(@CurrentUser() user: JwtUser, @Param('batchId') batchId: string) {
    return this.bulkUpdate.rollback(user, batchId);
  }

  @Post('rows-preview')
  @RequireAnyPermission('staff:bulk-update', 'staff:manage')
  rowsPreview(
    @CurrentUser() user: JwtUser,
    @Body() dto: StaffBulkUpdateRowsDto,
  ) {
    return this.bulkUpdate.importRowsPreview(
      user,
      dto.fieldKeys,
      dto.rows,
      dto.matchingKey ?? 'employeeCode',
    );
  }

  @Post('upload-preview')
  @RequireAnyPermission('staff:bulk-update', 'staff:manage')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_BYTES },
    }),
  )
  async uploadPreview(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: Omit<StaffBulkUpdateRowsDto, 'rows'>,
  ) {
    if (!file?.buffer?.length)
      throw new BadRequestException('No file uploaded');
    const rows = await this.bulkUpdate.parseWorkbook(
      file.buffer,
      file.originalname,
    );
    return this.bulkUpdate.importRowsPreview(
      user,
      Array.isArray(dto.fieldKeys)
        ? dto.fieldKeys
        : String(dto.fieldKeys ?? '')
            .split(',')
            .filter(Boolean),
      rows,
      dto.matchingKey ?? 'employeeCode',
    );
  }
}
