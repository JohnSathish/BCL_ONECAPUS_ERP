import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { TenantResolutionService } from '../tenants/tenant-resolution.service';
import { JournalCitationService } from './services/journal-citation.service';
import { JournalContentService } from './services/journal-content.service';
import { JournalDiscoveryService } from './services/journal-discovery.service';
import { JournalResolutionService } from './services/journal-resolution.service';
import { JournalsService } from './services/journals.service';

@ApiTags('journals-portal')
@Controller({ path: 'journals/portal', version: '1' })
export class JournalsPortalController {
  constructor(
    private readonly journals: JournalsService,
    private readonly content: JournalContentService,
    private readonly resolution: JournalResolutionService,
    private readonly tenantResolution: TenantResolutionService,
    private readonly citations: JournalCitationService,
    private readonly discovery: JournalDiscoveryService,
  ) {}

  private resolveHost(req: Request): string {
    const loginHost = String(req.headers['x-login-host'] ?? '').trim();
    if (loginHost) return loginHost;
    return (
      this.tenantResolution.extractHostFromHeaders(
        req.headers.host,
        req.headers['x-forwarded-host'],
      ) || 'transient.demo.localhost'
    );
  }

  private journalSlugFromRequest(
    req: Request,
    querySlug?: string,
  ): string | null {
    const headerSlug = String(req.headers['x-journal-slug'] ?? '')
      .trim()
      .toLowerCase();
    if (headerSlug) return headerSlug;
    if (querySlug?.trim()) return querySlug.trim().toLowerCase();
    return this.resolution.extractSlugFromHost(this.resolveHost(req));
  }

  private async resolveContext(req: Request, querySlug?: string) {
    const host = this.resolveHost(req);
    const slug = this.journalSlugFromRequest(req, querySlug);
    return this.resolution.resolveTenantAndJournal({ host, journalSlug: slug });
  }

  @Public()
  @Get('info')
  async info(@Req() req: Request, @Query('journal') journal?: string) {
    const { tenant, journal: j } = await this.resolveContext(req, journal);
    return this.journals.getPortalInfo(tenant.id, j.id);
  }

  @Public()
  @Get('pages/:key')
  async page(
    @Req() req: Request,
    @Param('key') key: string,
    @Query('journal') journal?: string,
  ) {
    const { tenant, journal: j } = await this.resolveContext(req, journal);
    const page = await this.journals.getPage(tenant.id, j.id, key);
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  @Public()
  @Get('board')
  async board(
    @Req() req: Request,
    @Query('journal') journal?: string,
    @Query('boardType') boardType?: string,
    @Query('scope') scope?: string,
  ) {
    const { tenant, journal: j } = await this.resolveContext(req, journal);
    if (scope === 'advisory') {
      return this.journals.listBoard(tenant.id, j.id, {
        boardType: 'ADVISORY',
      });
    }
    if (scope === 'editorial') {
      return this.journals.listBoard(tenant.id, j.id, {
        excludeTypes: [
          'ADVISORY',
          'CHIEF_PATRON',
          'PATRON',
          'PUBLISHER',
          'OFFICE',
        ],
      });
    }
    return this.journals.listBoard(tenant.id, j.id, {
      ...(boardType ? { boardType } : {}),
    });
  }

  @Public()
  @Get('downloads')
  async downloads(
    @Req() req: Request,
    @Query('journal') journal?: string,
    @Query('category') category?: string,
  ) {
    const { tenant, journal: j } = await this.resolveContext(req, journal);
    return this.content.listDownloads(tenant.id, j.id, {
      publishedOnly: true,
      category,
    });
  }

  @Public()
  @Get('redirect-lookup')
  async redirectLookup(
    @Req() req: Request,
    @Query('path') path: string,
    @Query('journal') journal?: string,
  ) {
    const { tenant, journal: j } = await this.resolveContext(req, journal);
    if (!path?.trim()) throw new NotFoundException('path required');
    const row = await this.content.findRedirect(tenant.id, j.id, path);
    if (!row) throw new NotFoundException('No redirect');
    return row;
  }

  @Public()
  @Get('issues')
  async issues(@Req() req: Request, @Query('journal') journal?: string) {
    const { tenant, journal: j } = await this.resolveContext(req, journal);
    return this.journals.listIssues(tenant.id, j.id);
  }

  @Public()
  @Get('issues/:id')
  async issue(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('journal') journal?: string,
  ) {
    const { tenant, journal: j } = await this.resolveContext(req, journal);
    const row = await this.journals.getIssue(tenant.id, j.id, id);
    if (!row) throw new NotFoundException('Issue not found');
    return row;
  }

  @Public()
  @Get('articles')
  async articles(
    @Req() req: Request,
    @Query('journal') journal?: string,
    @Query('q') q?: string,
    @Query('year') year?: string,
    @Query('keyword') keyword?: string,
    @Query('author') author?: string,
  ) {
    const { tenant, journal: j } = await this.resolveContext(req, journal);
    return this.journals.listArticles(tenant.id, j.id, {
      q,
      year: year ? Number(year) : undefined,
      keyword,
      author,
    });
  }

  @Public()
  @Get('articles/top')
  async top(
    @Req() req: Request,
    @Query('journal') journal?: string,
    @Query('by') by?: string,
    @Query('limit') limit?: string,
  ) {
    const { tenant, journal: j } = await this.resolveContext(req, journal);
    return this.journals.listTopArticles(
      tenant.id,
      j.id,
      by === 'downloads' ? 'downloads' : 'views',
      limit ? Number(limit) : 5,
    );
  }

  @Public()
  @Get('articles/:id')
  async article(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('journal') journal?: string,
  ) {
    const { tenant, journal: j } = await this.resolveContext(req, journal);
    const row = await this.journals.getArticle(tenant.id, j.id, id);
    if (!row) throw new NotFoundException('Article not found');
    return row;
  }

  @Public()
  @Post('articles/:id/view')
  async view(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('journal') journal?: string,
  ) {
    const { tenant, journal: j } = await this.resolveContext(req, journal);
    return this.journals.incrementView(tenant.id, j.id, id);
  }

  @Public()
  @Post('articles/:id/download')
  async download(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('journal') journal?: string,
  ) {
    const { tenant, journal: j } = await this.resolveContext(req, journal);
    return this.journals.incrementDownload(tenant.id, j.id, id);
  }

  @Public()
  @Get('sitemap')
  async sitemap(@Req() req: Request, @Query('journal') journal?: string) {
    const { tenant, journal: j } = await this.resolveContext(req, journal);
    return this.discovery.sitemapEntries(tenant.id, j.id);
  }

  @Public()
  @Get('oai')
  async oai(
    @Req() req: Request,
    @Res() res: Response,
    @Query('verb') verb?: string,
    @Query('metadataPrefix') metadataPrefix?: string,
    @Query('identifier') identifier?: string,
    @Query('journal') journal?: string,
  ) {
    const { tenant, journal: j } = await this.resolveContext(req, journal);
    const host = this.resolveHost(req);
    const proto = String(req.headers['x-forwarded-proto'] ?? 'https').split(
      ',',
    )[0];
    const baseUrl = process.env.JOURNALS_PUBLIC_URL || `${proto}://${host}`;
    const result = await this.discovery.oai(tenant.id, j.id, {
      verb,
      metadataPrefix,
      identifier,
      baseUrl,
    });
    res.setHeader('Content-Type', result.contentType);
    return res.send(result.body);
  }

  @Public()
  @Get('articles/:id/cite')
  async cite(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
    @Query('journal') journal?: string,
    @Query('format') format?: string,
  ) {
    const { tenant, journal: j } = await this.resolveContext(req, journal);
    const fmt = format === 'ris' || format === 'crossref-xml' ? format : 'csl';
    const cited = await this.citations.citeArticle(tenant.id, j.id, id, fmt);
    res.setHeader('Content-Type', cited.contentType);
    if (typeof cited.body === 'string') {
      return res.send(cited.body);
    }
    return res.json(cited.body);
  }
}
