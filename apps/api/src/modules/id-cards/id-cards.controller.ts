import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';

import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';

import { FileInterceptor } from '@nestjs/platform-express';

import { memoryStorage } from 'multer';

import type { Response } from 'express';

import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';

import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';

import {
  BulkGenerateIdCardsDto,
  CompletePrintRequestDto,
  GenerateIdCardDto,
  ReissueIdCardDto,
  RenderIdCardPdfDto,
  ReportLostCardDto,
  UpdateIdCardSettingsDto,
  CreateIdCardTemplateDto,
  UpdateIdCardTemplateDto,
} from './dto/id-cards.dto';

import { IdCardsService } from './id-cards.service';

import { IdCardDocumentService } from './id-card-document.service';

import { IdCardAssetsService } from './id-card-assets.service';

import { ID_CARD_BACKGROUND_MAX_BYTES } from '../../common/uploads/id-card-background.validator';

const ID_CARD_READ = [
  'students:read',
  'students:manage',
  'staff:read',
  'staff:manage',
] as const;

const ID_CARD_MANAGE = ['students:manage', 'staff:manage'] as const;

@ApiBearerAuth()
@ApiTags('id-cards')
@Controller({ path: 'id-cards', version: '1' })
export class IdCardsController {
  constructor(
    private readonly idCards: IdCardsService,
    private readonly idCardDocs: IdCardDocumentService,
    private readonly idCardAssets: IdCardAssetsService,
  ) {}

  @Get('dashboard')
  @RequireAnyPermission(...ID_CARD_READ)
  dashboard(@CurrentUser() user: JwtUser) {
    return this.idCards.getDashboard(user.tid);
  }

  @Get('print-requests')
  @RequireAnyPermission(...ID_CARD_READ)
  listPrintRequests(
    @CurrentUser() user: JwtUser,
    @Query('status') status?: string,
  ) {
    return this.idCards.listPrintRequests(user.tid, status);
  }

  @Patch('print-requests/:id/complete')
  @RequireAnyPermission(...ID_CARD_MANAGE)
  completePrintRequest(
    @CurrentUser() user: JwtUser,

    @Param('id', ParseUUIDPipe) id: string,

    @Body() dto: CompletePrintRequestDto,
  ) {
    return this.idCards.completePrintRequest(user, id, dto.issueId);
  }

  @Post('generate')
  @RequireAnyPermission(...ID_CARD_MANAGE)
  generate(@CurrentUser() user: JwtUser, @Body() dto: GenerateIdCardDto) {
    return this.idCards.generateIssue(user, dto);
  }

  @Post('render-pdf')
  @RequireAnyPermission(...ID_CARD_MANAGE)
  @Header('Content-Type', 'application/pdf')
  async renderPdf(@Body() dto: RenderIdCardPdfDto, @Res() res: Response) {
    const buffer = await this.idCardDocs.renderPdf(
      dto.html,
      dto.pageCount ?? 2,
    );

    res.set({
      'Content-Disposition': 'inline; filename="id-card-cr80.pdf"',

      'Content-Length': buffer.length,
    });

    return res.send(buffer);
  }

  @Post('bulk-generate')
  @RequireAnyPermission(...ID_CARD_MANAGE)
  bulkGenerate(
    @CurrentUser() user: JwtUser,
    @Body() dto: BulkGenerateIdCardsDto,
  ) {
    return this.idCards.bulkGenerate(user, dto);
  }

  @Post('reissue')
  @RequireAnyPermission(...ID_CARD_MANAGE)
  reissue(@CurrentUser() user: JwtUser, @Body() dto: ReissueIdCardDto) {
    return this.idCards.reissue(user, dto);
  }

  @Post('report-lost')
  @RequireAnyPermission(...ID_CARD_MANAGE)
  reportLost(@CurrentUser() user: JwtUser, @Body() dto: ReportLostCardDto) {
    return this.idCards.reportLost(user, dto);
  }

  @Get('issues')
  @RequireAnyPermission(...ID_CARD_READ)
  listIssues(
    @CurrentUser() user: JwtUser,

    @Query('holderType') holderType?: string,

    @Query('status') status?: string,

    @Query('statuses') statuses?: string,

    @Query('studentId') studentId?: string,

    @Query('staffProfileId') staffProfileId?: string,

    @Query('departmentId') departmentId?: string,

    @Query('staffType') staffType?: string,

    @Query('staffOnly') staffOnly?: string,

    @Query('studentOnly') studentOnly?: string,

    @Query('limit') limit?: string,
  ) {
    return this.idCards.listIssues(user.tid, {
      holderType,

      status,

      statuses: statuses
        ?.split(',')
        .map((s) => s.trim())
        .filter(Boolean),

      studentId,

      staffProfileId,

      departmentId,

      staffType,

      staffOnly: staffOnly === 'true' || staffOnly === '1',

      studentOnly: studentOnly === 'true' || studentOnly === '1',

      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('templates/background-upload')
  @RequireAnyPermission(...ID_CARD_MANAGE)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: ID_CARD_BACKGROUND_MAX_BYTES },
    }),
  )
  uploadTemplateBackground(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
    @Query('side') side?: 'front' | 'back',
    @Query('templateId') templateId?: string,
  ) {
    return this.idCardAssets.uploadBackground(user.tid, file, {
      side: side === 'back' ? 'back' : 'front',
      templateId,
    });
  }

  @Get('templates')
  @RequireAnyPermission(...ID_CARD_READ)
  templates(@CurrentUser() user: JwtUser) {
    return this.idCards.listTemplates(user.tid);
  }

  @Post('templates')
  @RequireAnyPermission(...ID_CARD_MANAGE)
  createTemplate(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateIdCardTemplateDto,
  ) {
    return this.idCards.createTemplate(user.tid, dto);
  }

  @Get('templates/:id')
  @RequireAnyPermission(...ID_CARD_READ)
  template(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.idCards.getTemplate(user.tid, id);
  }

  @Patch('templates/:id')
  @RequireAnyPermission(...ID_CARD_MANAGE)
  updateTemplate(
    @CurrentUser() user: JwtUser,

    @Param('id', ParseUUIDPipe) id: string,

    @Body() dto: UpdateIdCardTemplateDto,
  ) {
    return this.idCards.updateTemplate(user.tid, id, dto);
  }

  @Post('templates/:id/duplicate')
  @RequireAnyPermission(...ID_CARD_MANAGE)
  duplicateTemplate(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.idCards.duplicateTemplate(user.tid, id);
  }

  @Post('templates/:id/set-default')
  @RequireAnyPermission(...ID_CARD_MANAGE)
  setDefaultTemplate(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.idCards.setDefaultTemplate(user.tid, id);
  }

  @Get('settings')
  @RequireAnyPermission(...ID_CARD_READ)
  settings(@CurrentUser() user: JwtUser) {
    return this.idCards.getSettings(user.tid);
  }

  @Patch('settings')
  @RequireAnyPermission(...ID_CARD_MANAGE)
  updateSettings(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateIdCardSettingsDto,
  ) {
    return this.idCards.updateSettings(user.tid, dto);
  }

  @Get('reports/summary')
  @RequireAnyPermission(...ID_CARD_READ)
  reports(@CurrentUser() user: JwtUser) {
    return this.idCards.getReports(user.tid);
  }
}
