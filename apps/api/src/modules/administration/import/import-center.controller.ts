import {
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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ImportEngine } from '../../../common/import/import-engine';
import type { ImportModule } from '../../../common/import/import.types';
import {
  CurrentUser,
  type JwtUser,
} from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { PortalUsersImportHandler } from './portal-users-import.handler';
import { StaffImportHandler } from '../../staff/import/staff-import.handler';
import { ImportCenterService } from './import-center.service';

const MODULE_META: Record<
  string,
  {
    label: string;
    description: string;
    validatePath: string;
    templatePath: string;
  }
> = {
  STUDENT_MASTER: {
    label: 'Students',
    description: 'Bulk import student records',
    validatePath: '/v1/students/import/validate',
    templatePath: '/v1/students/import/template',
  },
  COURSE_MASTER: {
    label: 'Courses',
    description: 'Bulk import course master',
    validatePath: '/v1/courses/import/validate',
    templatePath: '/v1/courses/import/template',
  },
  REGISTRATION_IMPORT: {
    label: 'Subject Registrations',
    description: 'Bulk import semester registrations',
    validatePath: '/v1/academic-engine/import/registration/validate',
    templatePath: '/v1/academic-engine/import/registration/template',
  },
  PORTAL_USERS: {
    label: 'Portal Users',
    description: 'Bulk import portal login accounts',
    validatePath: '/v1/admin/import-export/PORTAL_USERS/validate',
    templatePath: '/v1/admin/import-export/PORTAL_USERS/template',
  },
  STAFF: {
    label: 'Staff',
    description: 'Bulk import staff profiles and portal accounts',
    validatePath: '/v1/admin/import-export/STAFF/validate',
    templatePath: '/v1/admin/import-export/STAFF/template',
  },
  QUESTION_BANK: {
    label: 'Question Bank',
    description: 'Bulk import previous year question papers (Excel + ZIP)',
    validatePath: '/v1/question-bank/bulk/preview',
    templatePath: '/v1/question-bank/bulk/template',
  },
};

@ApiBearerAuth()
@ApiTags('admin-import-export')
@Controller({ path: 'admin/import-export', version: '1' })
export class ImportCenterController {
  constructor(
    private readonly engine: ImportEngine,
    private readonly importCenter: ImportCenterService,
    private readonly portalUsersHandler: PortalUsersImportHandler,
    private readonly staffHandler: StaffImportHandler,
  ) {}

  private handlerFor(module: ImportModule) {
    if (module === 'PORTAL_USERS') return this.portalUsersHandler;
    if (module === 'STAFF') return this.staffHandler;
    throw new Error(
      `Import handler not registered in import center: ${module}`,
    );
  }

  @Get('modules')
  @RequirePermissions('imports:manage')
  listModules() {
    return Object.entries(MODULE_META).map(([id, meta]) => ({
      id,
      ...meta,
      available:
        id === 'PORTAL_USERS' || id === 'STAFF' || id === 'STUDENT_MASTER',
    }));
  }

  @Get('batches')
  @RequirePermissions('imports:manage')
  async listBatches(
    @CurrentUser() user: JwtUser,
    @Query('module') module?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const l = Math.min(50, Math.max(1, parseInt(limit ?? '20', 10) || 20));
    return this.importCenter.listBatches(user.tid, module, p, l);
  }

  @Get(':module/template')
  @RequirePermissions('imports:manage')
  async template(@Param('module') module: string, @Res() res: Response) {
    const handler = this.handlerFor(module as ImportModule);
    const buffer = await handler.buildTemplateWorkbook();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${module}-template.xlsx"`,
    );
    res.send(buffer);
  }

  @Post(':module/validate')
  @RequirePermissions('imports:manage')
  @UseInterceptors(FileInterceptor('file'))
  async validate(
    @CurrentUser() user: JwtUser,
    @Param('module') module: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const handler = this.handlerFor(module as ImportModule);
    if (!file?.buffer) throw new Error('File is required');
    return this.engine.validateUpload(
      handler,
      user.tid,
      user.sub,
      file.originalname,
      file.buffer,
    );
  }

  @Post(':module/commit')
  @RequirePermissions('imports:manage')
  async commit(
    @CurrentUser() user: JwtUser,
    @Param('module') module: string,
    @Query('batchId') batchId: string,
    @Query('mode') mode?: 'VALID_ONLY' | 'STRICT',
  ) {
    return this.importCenter.commit(
      user.tid,
      user.sub,
      module as ImportModule,
      batchId,
      mode ?? 'VALID_ONLY',
    );
  }
}
