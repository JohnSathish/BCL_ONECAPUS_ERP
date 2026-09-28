import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import {
  CurrentUser,
  type JwtUser,
} from '../../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../../common/decorators/require-permissions.decorator';
import {
  AdminQuestionPaperQueryDto,
  CreateQuestionBankMasterDto,
  QuestionBankMasterQueryDto,
  QuestionBankSettingsDto,
  UpdateQuestionBankMasterDto,
  UpdateQuestionPaperStatusDto,
  UpsertQuestionPaperDto,
} from './website-question-bank.dto';
import { WebsiteQuestionBankService } from './website-question-bank.service';

const pdfUpload = () =>
  FileInterceptor('file', {
    storage: memoryStorage(),
    limits: {
      fileSize: WebsiteQuestionBankService.hardMaxUploadMb() * 1024 * 1024,
      files: 1,
    },
  });

@ApiBearerAuth()
@ApiTags('website-admin')
@Controller({ path: 'website/admin/question-bank', version: '1' })
export class WebsiteQuestionBankAdminController {
  constructor(private readonly questionBank: WebsiteQuestionBankService) {}

  @Get('settings')
  @RequireAnyPermission('website:read', 'website:edit', 'website:manage')
  settings(@CurrentUser() user: JwtUser) {
    return this.questionBank.getSettings(user.tid);
  }

  @Patch('settings')
  @RequireAnyPermission('website:edit', 'website:manage')
  updateSettings(
    @CurrentUser() user: JwtUser,
    @Body() dto: QuestionBankSettingsDto,
  ) {
    return this.questionBank.updateSettings(user, dto);
  }

  @Get('masters')
  @RequireAnyPermission('website:read', 'website:edit', 'website:manage')
  masters(
    @CurrentUser() user: JwtUser,
    @Query() query: QuestionBankMasterQueryDto,
  ) {
    return this.questionBank.listMasters(user.tid, query.kind);
  }

  @Post('masters')
  @RequireAnyPermission('website:edit', 'website:manage')
  createMaster(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateQuestionBankMasterDto,
  ) {
    return this.questionBank.createMaster(user, dto);
  }

  @Patch('masters/:masterId')
  @RequireAnyPermission('website:edit', 'website:manage')
  updateMaster(
    @CurrentUser() user: JwtUser,
    @Param('masterId', ParseUUIDPipe) masterId: string,
    @Body() dto: UpdateQuestionBankMasterDto,
  ) {
    return this.questionBank.updateMaster(user, masterId, dto);
  }

  @Delete('masters/:masterId')
  @RequireAnyPermission('website:edit', 'website:manage')
  deleteMaster(
    @CurrentUser() user: JwtUser,
    @Param('masterId', ParseUUIDPipe) masterId: string,
  ) {
    return this.questionBank.deleteMaster(user, masterId);
  }

  @Get('papers')
  @RequireAnyPermission('website:read', 'website:edit', 'website:manage')
  papers(
    @CurrentUser() user: JwtUser,
    @Query() query: AdminQuestionPaperQueryDto,
  ) {
    return this.questionBank.listAdminPapers(user.tid, query);
  }

  @Get('papers/:paperId')
  @RequireAnyPermission('website:read', 'website:edit', 'website:manage')
  paper(
    @CurrentUser() user: JwtUser,
    @Param('paperId', ParseUUIDPipe) paperId: string,
  ) {
    return this.questionBank.getAdminPaper(user.tid, paperId);
  }

  @Post('papers')
  @RequireAnyPermission('website:edit', 'website:manage')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(pdfUpload())
  createPaper(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpsertQuestionPaperDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.questionBank.createPaper(user, dto, file);
  }

  @Patch('papers/:paperId')
  @RequireAnyPermission('website:edit', 'website:manage')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(pdfUpload())
  updatePaper(
    @CurrentUser() user: JwtUser,
    @Param('paperId', ParseUUIDPipe) paperId: string,
    @Body() dto: UpsertQuestionPaperDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.questionBank.updatePaper(user, paperId, dto, file);
  }

  @Patch('papers/:paperId/status')
  @RequireAnyPermission('website:edit', 'website:manage')
  updateStatus(
    @CurrentUser() user: JwtUser,
    @Param('paperId', ParseUUIDPipe) paperId: string,
    @Body() dto: UpdateQuestionPaperStatusDto,
  ) {
    return this.questionBank.setPaperStatus(user, paperId, dto.status);
  }

  @Delete('papers/:paperId')
  @RequireAnyPermission('website:edit', 'website:manage')
  deletePaper(
    @CurrentUser() user: JwtUser,
    @Param('paperId', ParseUUIDPipe) paperId: string,
  ) {
    return this.questionBank.deletePaper(user, paperId);
  }

  @Get('papers/:paperId/file')
  @RequireAnyPermission('website:read', 'website:edit', 'website:manage')
  async file(
    @CurrentUser() user: JwtUser,
    @Param('paperId', ParseUUIDPipe) paperId: string,
  ) {
    const { buffer, fileName } = await this.questionBank.getAdminFile(
      user.tid,
      paperId,
    );
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `inline; filename="${fileName}"`,
      length: buffer.length,
    });
  }
}
