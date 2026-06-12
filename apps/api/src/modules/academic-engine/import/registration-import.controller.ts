import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
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
} from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { CommitRegistrationImportDto } from '../dto/registration-import.dto';
import { RegistrationImportService } from './registration-import.service';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

@ApiBearerAuth()
@ApiTags('academic-engine')
@RequirePermissions('academic-engine:manage')
@Controller({ path: 'academic-engine/registrations/import', version: '1' })
export class RegistrationImportController {
  constructor(private readonly registrationImport: RegistrationImportService) {}

  @Get('template')
  async downloadTemplate(@Res() res: Response) {
    const buffer = await this.registrationImport.buildTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="Registration_Import_Template.xlsx"',
    );
    res.send(buffer);
  }

  @Get('template/wide')
  async downloadWideTemplate(@Res() res: Response) {
    const buffer = await this.registrationImport.buildWideTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="Registration_Wide_Import_Template.xlsx"',
    );
    res.send(buffer);
  }

  @Post('validate')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        semesterId: { type: 'string' },
        semesterSequence: { type: 'integer' },
        submitAfterImport: { type: 'boolean' },
        freezeAfterImport: { type: 'boolean' },
      },
      required: ['file', 'semesterId', 'semesterSequence'],
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
    @Body('semesterId') semesterId: string,
    @Body('semesterSequence') semesterSequence: string,
    @Body('submitAfterImport') submitAfterImport?: string,
    @Body('freezeAfterImport') freezeAfterImport?: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No file uploaded');
    }
    if (!semesterId?.trim()) {
      throw new BadRequestException('semesterId is required');
    }
    const seq = Number(semesterSequence);
    if (!Number.isFinite(seq) || seq < 1) {
      throw new BadRequestException(
        'semesterSequence must be a positive integer',
      );
    }

    return this.registrationImport.validateUpload(
      user.tid,
      user.sub,
      file.originalname ?? 'upload.xlsx',
      file.buffer,
      {
        semesterId: semesterId.trim(),
        semesterSequence: seq,
        submitAfterImport: submitAfterImport === 'true',
        freezeAfterImport: freezeAfterImport === 'true',
      },
    );
  }

  @Post('commit')
  commit(
    @CurrentUser() user: JwtUser,
    @Body() dto: CommitRegistrationImportDto,
  ) {
    return this.registrationImport.commit(
      user.tid,
      user.sub,
      dto.batchId,
      dto.mode ?? 'VALID_ONLY',
      {
        semesterId: dto.semesterId,
        semesterSequence: dto.semesterSequence,
        submitAfterImport: dto.submitAfterImport,
        freezeAfterImport: dto.freezeAfterImport,
      },
    );
  }

  @Get('batches/:id/error-report')
  async errorReport(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const buffer = await this.registrationImport.buildErrorReport(id, user.tid);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="Registration_Import_Error_Report.xlsx"',
    );
    res.send(buffer);
  }
}
