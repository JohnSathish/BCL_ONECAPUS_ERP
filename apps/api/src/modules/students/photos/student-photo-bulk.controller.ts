import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { Request, Response } from 'express';
import {
  CurrentUser,
  type JwtUser,
} from '../../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../../common/decorators/require-permissions.decorator';
import {
  PhotoBulkApplyDto,
  PhotoBulkDeleteDto,
  PhotoBulkPreviewDto,
  PhotoIdentifierExportQueryDto,
} from './dto/student-photo-bulk.dto';
import { StudentPhotoBulkService } from './student-photo-bulk.service';

const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;

function clientIp(req: Request) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim();
  return req.ip;
}

@ApiBearerAuth()
@ApiTags('students-photo-bulk')
@Controller({ path: 'students/photos/bulk', version: '1' })
export class StudentPhotoBulkController {
  constructor(private readonly photoBulk: StudentPhotoBulkService) {}

  @Post('preview')
  @RequireAnyPermission('students:photos:upload', 'students:manage')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', 5000, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 5000 },
    }),
  )
  preview(
    @CurrentUser() user: JwtUser,
    @Body() dto: PhotoBulkPreviewDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: Request,
  ) {
    return this.photoBulk.preview(user, dto, files ?? [], clientIp(req));
  }

  @Post('upload')
  @RequireAnyPermission('students:photos:upload', 'students:manage')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', 5000, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 5000 },
    }),
  )
  upload(
    @CurrentUser() user: JwtUser,
    @Body() dto: PhotoBulkPreviewDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: Request,
  ) {
    return this.photoBulk.preview(user, dto, files ?? [], clientIp(req));
  }

  @Post('apply')
  @RequireAnyPermission(
    'students:photos:upload',
    'students:photos:replace',
    'students:manage',
  )
  apply(@CurrentUser() user: JwtUser, @Body() dto: PhotoBulkApplyDto) {
    return this.photoBulk.apply(user, dto);
  }

  @Get('jobs')
  @RequireAnyPermission('students:photos:upload', 'students:manage')
  list(@CurrentUser() user: JwtUser) {
    return this.photoBulk.listBatches(user.tid);
  }

  @Get('jobs/:id')
  @RequireAnyPermission('students:photos:upload', 'students:manage')
  get(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.photoBulk.getBatch(user.tid, id);
  }

  @Get('report/:id')
  @RequireAnyPermission('students:photos:reports', 'students:manage')
  async report(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const report = await this.photoBulk.downloadReport(user.tid, id);
    return res.download(report.path, `student-photo-upload-${id}.csv`);
  }

  @Get('identifier-list.csv')
  @RequireAnyPermission(
    'students:photos:upload',
    'students:export',
    'students:manage',
  )
  async identifiers(
    @CurrentUser() user: JwtUser,
    @Query() query: PhotoIdentifierExportQueryDto,
    @Res() res: Response,
  ) {
    const csv = await this.photoBulk.exportIdentifiers(user, query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="student-photo-identifiers.csv"',
    );
    return res.send(csv);
  }

  @Delete('photos')
  @RequirePermissions('students:photos:delete')
  deletePhotos(@CurrentUser() user: JwtUser, @Body() dto: PhotoBulkDeleteDto) {
    return this.photoBulk.deletePhotos(user, dto);
  }

  @Post('photos/reprocess')
  @RequireAnyPermission('students:photos:replace', 'students:manage')
  reprocessPhotos(
    @CurrentUser() user: JwtUser,
    @Body() dto: PhotoBulkDeleteDto,
  ) {
    return this.photoBulk.reprocessPhotos(user, dto);
  }
}
