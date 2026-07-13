import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { memoryStorage } from 'multer';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import { extractClientIp } from '../../common/utils/request-host';
import {
  AddSyllabusVersionDto,
  AskSyllabusDto,
  CreateSyllabusDocumentDto,
  ExtractSyllabusHintsDto,
  SyllabusApprovalDto,
  SyllabusCourseLookupQueryDto,
  SyllabusDocumentQueryDto,
  SyllabusPreflightQueryDto,
  SyllabusSettingsDto,
  UpdateSyllabusDocumentDto,
} from './dto/syllabus-repository.dto';
import { SyllabusAnalyticsService } from './services/syllabus-analytics.service';
import { SyllabusBulkImportService } from './services/syllabus-bulk-import.service';
import { SyllabusDocumentsService } from './services/syllabus-documents.service';
import { SyllabusWorkflowService } from './services/syllabus-workflow.service';

const SR_READ = [
  'syllabus-repository:read',
  'syllabus-repository:manage',
  'syllabus-repository:download',
  'syllabus-repository:contribute',
  'academic:read',
  'academic:manage',
] as const;
const SR_DOWNLOAD = [
  'syllabus-repository:download',
  'syllabus-repository:read',
  'syllabus-repository:manage',
  'syllabus-repository:contribute',
  'academic:read',
  'academic:manage',
] as const;
const SR_CONTRIBUTE = [
  'syllabus-repository:contribute',
  'syllabus-repository:manage',
  'academic:manage',
] as const;
const SR_MANAGE = ['syllabus-repository:manage', 'academic:manage'] as const;
const SR_APPROVE = [
  'syllabus-repository:approve',
  'syllabus-repository:publish',
  'syllabus-repository:manage',
  'academic:manage',
] as const;
const SR_PUBLISH = [
  'syllabus-repository:publish',
  'syllabus-repository:manage',
  'academic:manage',
] as const;

@ApiBearerAuth()
@ApiTags('syllabus-repository')
@Controller({ path: 'syllabus-repository', version: '1' })
export class SyllabusRepositoryController {
  constructor(
    private readonly documents: SyllabusDocumentsService,
    private readonly workflow: SyllabusWorkflowService,
    private readonly analytics: SyllabusAnalyticsService,
    private readonly bulk: SyllabusBulkImportService,
  ) {}

  @Get('dashboard')
  @RequireAnyPermission(...SR_READ)
  dashboard(@CurrentUser() user: JwtUser) {
    return this.analytics.dashboard(user.tid);
  }

  @Get('settings')
  @RequireAnyPermission(...SR_DOWNLOAD)
  settings(@CurrentUser() user: JwtUser) {
    return this.documents.getSettings(user.tid);
  }

  @Patch('settings')
  @RequireAnyPermission(...SR_MANAGE)
  updateSettings(
    @CurrentUser() user: JwtUser,
    @Body() dto: SyllabusSettingsDto,
  ) {
    return this.documents.updateSettings(user, dto);
  }

  @Get('courses/lookup')
  @RequireAnyPermission(...SR_DOWNLOAD)
  lookupCourse(
    @CurrentUser() user: JwtUser,
    @Query() query: SyllabusCourseLookupQueryDto,
  ) {
    if (
      query.q ||
      query.departmentId ||
      query.semesterNo != null ||
      query.subjectType
    ) {
      return this.documents.searchCourses(user.tid, query);
    }
    if (!query.code?.trim()) {
      return this.documents.searchCourses(user.tid, { ...query, q: '' });
    }
    return this.documents.lookupCourse(user.tid, query.code);
  }

  @Get('documents')
  @RequireAnyPermission(...SR_DOWNLOAD)
  list(@CurrentUser() user: JwtUser, @Query() query: SyllabusDocumentQueryDto) {
    return this.documents.list(user, query);
  }

  @Get('documents/preflight')
  @RequireAnyPermission(...SR_CONTRIBUTE)
  preflight(
    @CurrentUser() user: JwtUser,
    @Query() query: SyllabusPreflightQueryDto,
  ) {
    return this.documents.preflight(user.tid, query);
  }

  @Post('documents/extract-hints')
  @RequireAnyPermission(...SR_CONTRIBUTE)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  extractHints(
    @CurrentUser() user: JwtUser,
    @Body() dto: ExtractSyllabusHintsDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.documents.extractHints(user.tid, file, dto);
  }

  @Get('documents/:id')
  @RequireAnyPermission(...SR_DOWNLOAD)
  get(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.documents.getById(user, id);
  }

  @Post('documents')
  @RequireAnyPermission(...SR_CONTRIBUTE)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  create(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateSyllabusDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.documents.create(user, dto, file);
  }

  @Patch('documents/:id')
  @RequireAnyPermission(...SR_CONTRIBUTE)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateSyllabusDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.documents.update(user, id, dto, file);
  }

  @Delete('documents/:id')
  @RequireAnyPermission(...SR_CONTRIBUTE)
  archive(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.documents.archive(user, id);
  }

  @Post('documents/:id/submit')
  @RequireAnyPermission(...SR_CONTRIBUTE)
  submit(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.workflow.submit(user, id);
  }

  @Post('documents/:id/publish')
  @RequireAnyPermission(...SR_PUBLISH)
  publish(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.workflow.publish(user, id);
  }

  @Get('approvals/pending')
  @RequireAnyPermission(...SR_APPROVE)
  pendingApprovals(
    @CurrentUser() user: JwtUser,
    @Query('roleSlug') roleSlug?: string,
  ) {
    return this.workflow.listPendingApprovals(user.tid, roleSlug);
  }

  @Post('approvals/:id/action')
  @RequireAnyPermission(...SR_APPROVE)
  approvalAction(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SyllabusApprovalDto,
  ) {
    return this.workflow.actOnApproval(user, id, dto);
  }

  @Get('documents/:id/versions')
  @RequireAnyPermission(...SR_DOWNLOAD)
  listVersions(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.documents.listVersions(user, id);
  }

  @Post('documents/:id/versions')
  @RequireAnyPermission(...SR_CONTRIBUTE)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  addVersion(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: AddSyllabusVersionDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.documents.addVersion(user, id, file, {
      changeNote: dto.changeNote,
    });
  }

  @Get('documents/:id/download')
  @RequireAnyPermission(...SR_DOWNLOAD)
  async download(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const { stream, fileName } = await this.documents.download(
      user,
      id,
      extractClientIp(req),
    );
    return new StreamableFile(stream, {
      type: 'application/octet-stream',
      disposition: `attachment; filename="${fileName}"`,
    });
  }

  @Get('documents/:id/preview')
  @RequireAnyPermission(...SR_DOWNLOAD)
  async preview(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const { stream, fileName } = await this.documents.preview(
      user,
      id,
      extractClientIp(req),
    );
    return new StreamableFile(stream, {
      type: 'application/pdf',
      disposition: `inline; filename="${fileName}"`,
    });
  }

  @Get('documents/:id/versions/:versionNo/download')
  @RequireAnyPermission(...SR_DOWNLOAD)
  async downloadVersion(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('versionNo') versionNo: string,
    @Req() req: Request,
  ) {
    const { stream, fileName } = await this.documents.downloadVersion(
      user,
      id,
      Number(versionNo),
      extractClientIp(req),
    );
    return new StreamableFile(stream, {
      type: 'application/octet-stream',
      disposition: `attachment; filename="${fileName}"`,
    });
  }

  @Get('me/documents')
  @RequireAnyPermission(...SR_DOWNLOAD)
  myDocuments(@CurrentUser() user: JwtUser) {
    return this.documents.listForStudentMe(user);
  }

  @Get('me/bookmarks')
  @RequireAnyPermission(...SR_DOWNLOAD)
  bookmarks(@CurrentUser() user: JwtUser) {
    return this.documents.listMyBookmarks(user);
  }

  @Post('documents/:id/bookmark')
  @RequireAnyPermission(...SR_DOWNLOAD)
  toggleBookmark(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.documents.toggleBookmark(user, id);
  }

  @Post('documents/:id/ask')
  @RequireAnyPermission(...SR_DOWNLOAD)
  ask(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: AskSyllabusDto,
  ) {
    return this.documents.askAboutDocument(user, id, dto.question);
  }

  @Get('bulk/template')
  @RequireAnyPermission(...SR_MANAGE)
  async bulkTemplate() {
    const buffer = await this.bulk.buildTemplateWorkbook();
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="syllabus-repository-template.xlsx"',
    });
  }

  @Post('bulk/preview')
  @RequireAnyPermission(...SR_MANAGE)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'excel', maxCount: 1 },
        { name: 'zip', maxCount: 1 },
      ],
      { storage: memoryStorage() },
    ),
  )
  bulkPreview(
    @CurrentUser() user: JwtUser,
    @UploadedFiles()
    files: { excel?: Express.Multer.File[]; zip?: Express.Multer.File[] },
  ) {
    return this.bulk.preview(user, files.excel?.[0]!, files.zip?.[0]);
  }

  @Post('bulk/commit')
  @RequireAnyPermission(...SR_MANAGE)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'excel', maxCount: 1 },
        { name: 'zip', maxCount: 1 },
      ],
      { storage: memoryStorage() },
    ),
  )
  async bulkCommit(
    @CurrentUser() user: JwtUser,
    @Body('rows') rowsJson: string | undefined,
    @UploadedFiles()
    files: { excel?: Express.Multer.File[]; zip?: Express.Multer.File[] },
  ) {
    const rows = rowsJson
      ? (JSON.parse(rowsJson) as Record<string, unknown>[])
      : (await this.bulk.preview(user, files.excel?.[0]!, files.zip?.[0])).rows
          .filter((row) => row.status === 'VALID' && row.normalized)
          .map((row) => row.normalized!);
    return this.bulk.commit(user, rows, files.zip?.[0]);
  }
}
