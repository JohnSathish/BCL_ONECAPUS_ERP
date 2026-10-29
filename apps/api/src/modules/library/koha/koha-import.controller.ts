import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { diskStorage } from 'multer';
import { mkdirSync } from 'fs';
import { unlink } from 'fs/promises';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import {
  CurrentUser,
  type JwtUser,
} from '../../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../../common/decorators/require-permissions.decorator';
import { resolveTenantUploadRoot } from '../../../common/uploads/upload-paths';
import { KohaImportService } from './koha-import.service';
import type { MappingStatus } from './koha-catalogue.mapper';

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const ALLOWED = new Set(['.xlsx', '.csv', '.zip']);

function incomingDir() {
  const dir = join(resolveTenantUploadRoot(), 'library-koha', 'incoming');
  mkdirSync(dir, { recursive: true });
  return dir;
}

@ApiBearerAuth()
@ApiTags('library')
@RequireAnyPermission('library:manage', 'library:settings')
@Controller({ path: 'library/koha-import', version: '1' })
export class KohaImportController {
  constructor(private readonly koha: KohaImportService) {}

  @Get('batches')
  list(@CurrentUser() user: JwtUser) {
    return this.koha.listBatches(user.tid);
  }

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        importName: { type: 'string' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, incomingDir()),
        filename: (_req, file, cb) => {
          const extension = extname(file.originalname || '').toLowerCase();
          cb(
            null,
            `${randomUUID()}${ALLOWED.has(extension) ? extension : '.bin'}`,
          );
        },
      }),
      limits: { fileSize: MAX_FILE_BYTES, files: 1 },
    }),
  )
  async upload(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
    @Body('importName') importName?: string,
  ) {
    if (!file)
      throw new BadRequestException('Choose a catalogue file to upload.');
    const extension = extname(file.originalname || '').toLowerCase();
    if (!ALLOWED.has(extension)) {
      if (file.path) await unlink(file.path).catch(() => undefined);
      throw new BadRequestException(
        extension === '.sql'
          ? 'SQL dumps are not executed. Upload the Koha catalogue workbook or CSV files.'
          : 'Upload an .xlsx workbook, a .csv file, or a .zip of those files.',
      );
    }
    return this.koha.upload(user.tid, user.sub, file, importName);
  }

  @Get(':id')
  get(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.koha.getBatch(user.tid, id);
  }

  @Get(':id/mappings')
  mappings(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.koha.listMappings(user.tid, id);
  }

  @Patch('mappings/:id')
  updateMapping(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body()
    body: { mappingStatus?: MappingStatus; departmentId?: string | null },
  ) {
    if (!body.mappingStatus)
      throw new BadRequestException('Choose a mapping status.');
    return this.koha.updateMapping(user.tid, user.sub, id, {
      mappingStatus: body.mappingStatus,
      departmentId: body.departmentId,
    });
  }

  @Post(':id/dry-run')
  dryRun(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.koha.dryRun(user.tid, user.sub, id);
  }

  @Post(':id/sample')
  sample(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.koha.importSample(user.tid, user.sub, id);
  }

  @Post(':id/import')
  start(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { approved?: boolean },
  ) {
    return this.koha.startImport(
      user.tid,
      user.sub,
      id,
      body.approved === true,
    );
  }

  @Post(':id/retry')
  retry(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.koha.retry(user.tid, user.sub, id);
  }

  @Get(':id/report')
  async report(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Query('kind') kind: string | undefined,
    @Res() res: Response,
  ) {
    const reportKind = kind === 'errors' ? 'errors' : 'validation';
    const csv = await this.koha.reportCsv(user.tid, id, reportKind);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${reportKind === 'errors' ? 'koha-error-report.csv' : 'koha-validation-report.csv'}"`,
    );
    res.send(csv);
  }
}
