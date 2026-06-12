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
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import { extractClientIp } from '../../common/utils/request-host';
import {
  CreateQuestionPaperDto,
  QuestionBankSettingsDto,
  QuestionPaperApprovalDto,
  QuestionPaperQueryDto,
  UpdateQuestionPaperDto,
} from './dto/question-bank.dto';
import { QuestionBankAnalyticsService } from './services/question-bank-analytics.service';
import { QuestionPaperBulkImportService } from './services/question-paper-bulk-import.service';
import { QuestionPaperWorkflowService } from './services/question-paper-workflow.service';
import { QuestionPapersService } from './services/question-papers.service';

const QB_READ = [
  'question-bank:read',
  'question-bank:manage',
  'question-bank:download',
  'question-bank:contribute',
] as const;
const QB_DOWNLOAD = [
  'question-bank:download',
  'question-bank:read',
  'question-bank:manage',
  'question-bank:contribute',
] as const;
const QB_CONTRIBUTE = [
  'question-bank:contribute',
  'question-bank:manage',
] as const;
const QB_MANAGE = ['question-bank:manage'] as const;
const QB_APPROVE = [
  'question-bank:approve',
  'question-bank:publish',
  'question-bank:manage',
] as const;
const QB_PUBLISH = ['question-bank:publish', 'question-bank:manage'] as const;
const QB_REPORTS = ['question-bank:reports', 'question-bank:manage'] as const;

@ApiBearerAuth()
@ApiTags('question-bank')
@Controller({ path: 'question-bank', version: '1' })
export class QuestionBankController {
  constructor(
    private readonly papers: QuestionPapersService,
    private readonly workflow: QuestionPaperWorkflowService,
    private readonly analytics: QuestionBankAnalyticsService,
    private readonly bulk: QuestionPaperBulkImportService,
  ) {}

  @Get('dashboard')
  @RequireAnyPermission(...QB_READ)
  dashboard(@CurrentUser() user: JwtUser) {
    return this.analytics.dashboard(user.tid);
  }

  @Get('papers')
  @RequireAnyPermission(...QB_DOWNLOAD)
  list(@CurrentUser() user: JwtUser, @Query() query: QuestionPaperQueryDto) {
    return this.papers.list(user, query);
  }

  @Get('papers/:id')
  @RequireAnyPermission(...QB_DOWNLOAD)
  get(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.papers.getById(user, id);
  }

  @Post('papers')
  @RequireAnyPermission(...QB_CONTRIBUTE)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  create(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateQuestionPaperDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.papers.create(user, dto, file);
  }

  @Patch('papers/:id')
  @RequireAnyPermission(...QB_CONTRIBUTE)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateQuestionPaperDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.papers.update(user, id, dto, file);
  }

  @Delete('papers/:id')
  @RequireAnyPermission(...QB_CONTRIBUTE)
  archive(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.papers.archive(user, id);
  }

  @Post('papers/:id/submit')
  @RequireAnyPermission(...QB_CONTRIBUTE)
  submit(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.workflow.submit(user, id);
  }

  @Post('papers/:id/publish')
  @RequireAnyPermission(...QB_PUBLISH)
  publish(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.workflow.publish(user, id);
  }

  @Post('approvals/:id/action')
  @RequireAnyPermission(...QB_APPROVE)
  approvalAction(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: QuestionPaperApprovalDto,
  ) {
    return this.workflow.actOnApproval(user, id, dto);
  }

  @Get('approvals/pending')
  @RequireAnyPermission(...QB_APPROVE)
  pendingApprovals(
    @CurrentUser() user: JwtUser,
    @Query('roleSlug') roleSlug?: string,
  ) {
    return this.workflow.listPendingApprovals(user.tid, roleSlug);
  }

  @Get('papers/:id/download')
  @RequireAnyPermission(...QB_DOWNLOAD)
  async download(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const { stream, fileName } = await this.papers.download(
      user,
      id,
      extractClientIp(req),
    );
    return new StreamableFile(stream, {
      type: 'application/octet-stream',
      disposition: `attachment; filename="${fileName}"`,
    });
  }

  @Get('papers/:id/preview')
  @RequireAnyPermission(...QB_DOWNLOAD)
  async preview(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const { stream, fileName } = await this.papers.preview(
      user,
      id,
      extractClientIp(req),
    );
    return new StreamableFile(stream, {
      type: 'application/pdf',
      disposition: `inline; filename="${fileName}"`,
    });
  }

  @Get('me/papers')
  @RequirePermissions('question-bank:download')
  myPapers(
    @CurrentUser() user: JwtUser,
    @Query() query: QuestionPaperQueryDto,
  ) {
    return this.papers.listMyPapers(user, query);
  }

  @Get('me/bookmarks')
  @RequirePermissions('question-bank:download')
  bookmarks(@CurrentUser() user: JwtUser) {
    return this.papers.listBookmarks(user);
  }

  @Post('me/bookmarks/:paperId')
  @RequirePermissions('question-bank:download')
  addBookmark(@CurrentUser() user: JwtUser, @Param('paperId') paperId: string) {
    return this.papers.addBookmark(user, paperId);
  }

  @Delete('me/bookmarks/:paperId')
  @RequirePermissions('question-bank:download')
  removeBookmark(
    @CurrentUser() user: JwtUser,
    @Param('paperId') paperId: string,
  ) {
    return this.papers.removeBookmark(user, paperId);
  }

  @Post('bulk/preview')
  @RequireAnyPermission(...QB_MANAGE)
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
  @RequireAnyPermission(...QB_MANAGE)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('zip', { storage: memoryStorage() }))
  bulkCommit(
    @CurrentUser() user: JwtUser,
    @Body('rows') rowsJson: string,
    @UploadedFile() zip?: Express.Multer.File,
  ) {
    const rows = JSON.parse(rowsJson) as Record<string, unknown>[];
    return this.bulk.commit(user, rows, zip);
  }

  @Get('bulk/template')
  @RequireAnyPermission(...QB_MANAGE)
  async bulkTemplate(@CurrentUser() _user: JwtUser) {
    const buffer = await this.bulk.buildTemplateWorkbook();
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="question-bank-template.xlsx"',
    });
  }

  @Get('reports/summary')
  @RequireAnyPermission(...QB_REPORTS)
  reports(@CurrentUser() user: JwtUser) {
    return this.analytics.reportsSummary(user.tid);
  }

  @Get('audit-logs')
  @RequireAnyPermission(...QB_MANAGE)
  auditLogs(@CurrentUser() user: JwtUser) {
    return this.papers.auditLogs(user.tid);
  }

  @Get('settings')
  @RequireAnyPermission(...QB_MANAGE)
  settings(@CurrentUser() user: JwtUser) {
    return this.papers.getSettings(user.tid);
  }

  @Patch('settings')
  @RequireAnyPermission(...QB_MANAGE)
  updateSettings(
    @CurrentUser() user: JwtUser,
    @Body() dto: QuestionBankSettingsDto,
  ) {
    return this.papers.updateSettings(user, dto);
  }
}
