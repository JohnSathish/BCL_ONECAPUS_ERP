import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import {
  extractClientIp,
  extractRequestHost,
} from '../../../common/utils/request-host';
import { TenantResolutionService } from '../../tenants/tenant-resolution.service';
import {
  PublicQuestionPaperQueryDto,
  PublicTenantQueryDto,
  QuestionPaperFileQueryDto,
} from './website-question-bank.dto';
import { WebsiteQuestionBankService } from './website-question-bank.service';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

@ApiTags('website-public')
@Controller({ path: 'website/public/question-bank', version: '1' })
export class WebsiteQuestionBankPublicController {
  constructor(
    private readonly questionBank: WebsiteQuestionBankService,
    private readonly tenants: TenantResolutionService,
  ) {}

  private async resolveTenant(req: Request, tenantSlug?: string) {
    if (tenantSlug?.trim()) return this.tenants.resolveSlug(tenantSlug);
    return this.tenants.resolveHost(extractRequestHost(req));
  }

  private assertSlug(slug: string) {
    if (!SLUG_PATTERN.test(slug) || slug.length > 160) {
      throw new NotFoundException('Question paper not found');
    }
  }

  @Public()
  @Get('filters')
  async filters(@Req() req: Request, @Query() query: PublicTenantQueryDto) {
    const tenant = await this.resolveTenant(req, query.tenant);
    return this.questionBank.publicFilters(tenant.id);
  }

  @Public()
  @Get('papers')
  async papers(
    @Req() req: Request,
    @Query() query: PublicQuestionPaperQueryDto,
  ) {
    const tenant = await this.resolveTenant(req, query.tenant);
    return this.questionBank.listPublicPapers(tenant.id, query);
  }

  @Public()
  @Get('sitemap')
  async sitemap(@Req() req: Request, @Query() query: PublicTenantQueryDto) {
    const tenant = await this.resolveTenant(req, query.tenant);
    return this.questionBank.listPublicSitemap(tenant.id);
  }

  @Public()
  @Get('papers/:slug')
  async paper(
    @Req() req: Request,
    @Param('slug') slug: string,
    @Query() query: PublicTenantQueryDto,
  ) {
    this.assertSlug(slug);
    const tenant = await this.resolveTenant(req, query.tenant);
    return this.questionBank.getPublicPaper(tenant.id, slug);
  }

  @Public()
  @Get('papers/:slug/file')
  async file(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('slug') slug: string,
    @Query() query: QuestionPaperFileQueryDto,
  ) {
    this.assertSlug(slug);
    const tenant = await this.resolveTenant(req, query.tenant);
    const { stream, bytes, fileName, downloadMode } =
      await this.questionBank.getPublicFile(
        tenant.id,
        slug,
        extractClientIp(req),
      );
    const forceDownload =
      query.download === '1' || query.download === 'true'
        ? true
        : query.download === '0' || query.download === 'false'
          ? false
          : downloadMode === 'DOWNLOAD';
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(stream, {
      type: 'application/pdf',
      disposition: `${forceDownload ? 'attachment' : 'inline'}; filename="${fileName}"`,
      ...(bytes ? { length: bytes } : {}),
    });
  }
}
