import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { CommitCourseImportDto } from './dto/course-import.dto';
import { CourseImportService } from './import/course-import.service';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

@ApiBearerAuth()
@ApiTags('programs-courses')
@RequirePermissions('academic:manage')
@Controller({ path: 'programs-courses/courses/import', version: '1' })
export class CourseImportController {
  constructor(private readonly courseImport: CourseImportService) {}

  @Get('template')
  async downloadTemplate(@Res() res: Response) {
    const buffer = await this.courseImport.buildTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="Course_Import_Template.xlsx"',
    );
    res.send(buffer);
  }

  @Post('validate')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_BYTES },
    }),
  )
  async validate(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No file uploaded');
    }
    return this.courseImport.validateUpload(
      user.tid,
      user.sub,
      file.originalname ?? 'upload.xlsx',
      file.buffer,
    );
  }

  @Post('commit')
  commit(@CurrentUser() user: JwtUser, @Body() dto: CommitCourseImportDto) {
    return this.courseImport.commit(user.tid, user.sub, dto.batchId, dto.mode);
  }

  @Get('batches')
  listBatches(
    @CurrentUser() user: JwtUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.courseImport.listBatches(user.tid, query);
  }

  @Get('batches/:id')
  getBatch(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.courseImport.getBatch(id, user.tid);
  }

  @Get('batches/:id/preview')
  preview(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.courseImport.getPreview(
      id,
      user.tid,
      query.page,
      query.limit ?? 200,
    );
  }

  @Get('batches/:id/error-report')
  async errorReport(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const buffer = await this.courseImport.buildErrorReport(id, user.tid);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="Import_Error_Report.xlsx"',
    );
    res.send(buffer);
  }
}
