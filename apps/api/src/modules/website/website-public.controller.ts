import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { extractRequestHost } from '../../common/utils/request-host';
import { TenantResolutionService } from '../tenants/tenant-resolution.service';
import { WebsiteAdminService } from './website-admin.service';
import { WebsiteAcademicService } from './website-academic.service';
import { WebsiteCmsEnterpriseService } from './website-cms-enterprise.service';
import { WebsiteService } from './website.service';
import { WebsiteAcademicPlannerService } from './website-academic-planner.service';
import { WebsitePopupService } from './website-popup.service';
import {
  CreateWebsiteBloodDonorDto,
  CreateWebsiteFyugInterestDto,
  CreateWebsiteNewsletterDto,
} from './dto/website.dto';

@ApiTags('website-public')
@Controller({ path: 'website/public', version: '1' })
export class WebsitePublicController {
  constructor(
    private readonly website: WebsiteService,
    private readonly admin: WebsiteAdminService,
    private readonly tenants: TenantResolutionService,
    private readonly academic: WebsiteAcademicService,
    private readonly enterprise: WebsiteCmsEnterpriseService,
    private readonly planner: WebsiteAcademicPlannerService,
    private readonly popupService: WebsitePopupService,
  ) {}

  private async resolveTenant(req: Request, tenantSlug?: string) {
    if (tenantSlug?.trim()) return this.tenants.resolveSlug(tenantSlug);
    return this.tenants.resolveHost(extractRequestHost(req));
  }

  @Public()
  @Get('site')
  async site(@Req() req: Request, @Query('tenant') tenantSlug?: string) {
    const tenant = await this.resolveTenant(req, tenantSlug);
    return this.website.getPublicSite(tenant.id);
  }

  @Public()
  @Get('hero-slides')
  async heroSlides(@Req() req: Request, @Query('tenant') tenantSlug?: string) {
    const tenant = await this.resolveTenant(req, tenantSlug);
    return this.admin.listPublicHeroSlides(tenant.id);
  }

  @Public()
  @Get('homepage')
  async homepage(@Req() req: Request, @Query('tenant') tenantSlug?: string) {
    const tenant = await this.resolveTenant(req, tenantSlug);
    return this.enterprise.getPublicHomepage(tenant.id);
  }

  @Public()
  @Get('notices')
  async notices(@Req() req: Request, @Query('tenant') tenantSlug?: string) {
    const tenant = await this.resolveTenant(req, tenantSlug);
    return this.enterprise.listPublicNotices(tenant.id);
  }

  @Public()
  @Get('announcements')
  async announcements(
    @Req() req: Request,
    @Query('tenant') tenantSlug?: string,
    @Query('ticker') ticker?: string,
  ) {
    const tenant = await this.resolveTenant(req, tenantSlug);
    return this.enterprise.listPublicAnnouncements(tenant.id, {
      ticker: ticker === '1' || ticker === 'true',
    });
  }

  @Public()
  @Get('announcements/:slug')
  async announcementBySlug(
    @Req() req: Request,
    @Param('slug') slug: string,
    @Query('tenant') tenantSlug?: string,
  ) {
    const tenant = await this.resolveTenant(req, tenantSlug);
    const row = await this.enterprise.listPublicAnnouncements(tenant.id, {
      slug,
    });
    if (!row) {
      throw new NotFoundException('Announcement not found');
    }
    return row;
  }

  @Public()
  @Get('popups')
  async popups(
    @Req() req: Request,
    @Query('tenant') tenantSlug?: string,
    @Query('page') page?: string,
  ) {
    const tenant = await this.resolveTenant(req, tenantSlug);
    return this.popupService.listPublicActive(tenant.id, page);
  }

  @Public()
  @Get('menus')
  async menus(
    @Req() req: Request,
    @Query('tenant') tenantSlug?: string,
    @Query('location') location?: string,
  ) {
    const tenant = await this.resolveTenant(req, tenantSlug);
    return this.enterprise.listPublicMenus(tenant.id, location);
  }

  @Public()
  @Get('events/upcoming')
  async upcomingEvents(
    @Req() req: Request,
    @Query('tenant') tenantSlug?: string,
  ) {
    const tenant = await this.resolveTenant(req, tenantSlug);
    return this.enterprise.listUpcomingEvents(tenant.id);
  }

  @Public()
  @Get('academic-planner')
  async academicPlanner(
    @Req() req: Request,
    @Query('tenant') tenantSlug?: string,
    @Query('slug') slug?: string,
  ) {
    const tenant = await this.resolveTenant(req, tenantSlug);
    const row = await this.planner.getPublicPlanner(tenant.id, slug);
    if (!row) {
      throw new NotFoundException('Academic calendar is not published yet');
    }
    return row;
  }

  @Public()
  @Get('seo/sitemap-entries')
  async sitemapEntries(
    @Req() req: Request,
    @Query('tenant') tenantSlug?: string,
  ) {
    const tenant = await this.resolveTenant(req, tenantSlug);
    return this.enterprise.listSitemapEntries(tenant.id);
  }

  @Public()
  @Get('page')
  async page(
    @Req() req: Request,
    @Query('path') path: string,
    @Query('tenant') tenantSlug?: string,
  ) {
    const tenant = await this.resolveTenant(req, tenantSlug);
    return this.website.getPublicPage(tenant.id, path || '/');
  }

  @Public()
  @Get('committees/:code/members')
  async committeeMembers(
    @Req() req: Request,
    @Param('code') code: string,
    @Query('tenant') tenantSlug?: string,
  ) {
    const tenant = await this.resolveTenant(req, tenantSlug);
    return this.website.getPublicCommitteeMembers(tenant.id, code);
  }

  @Public()
  @Get('pages')
  async pages(@Req() req: Request, @Query('tenant') tenantSlug?: string) {
    const tenant = await this.resolveTenant(req, tenantSlug);
    return this.website.listPublicPages(tenant.id);
  }

  @Public()
  @Get('redirect')
  async redirect(
    @Req() req: Request,
    @Query('path') path: string,
    @Query('tenant') tenantSlug?: string,
  ) {
    const tenant = await this.resolveTenant(req, tenantSlug);
    return this.website.findPublicRedirect(tenant.id, path);
  }

  @Public()
  @Get('preview')
  preview(@Query('token') token: string) {
    return this.admin.resolvePreview(token);
  }

  @Public()
  @Get('preview/:token')
  async previewHtml(@Param('token') token: string, @Res() response: Response) {
    const html = await this.admin.renderPreviewHtml(token);
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'; font-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    );
    response.setHeader('Cache-Control', 'no-store, private');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.type('html').send(html);
  }

  @Public()
  @Get('content/:typeSlug')
  async content(
    @Req() req: Request,
    @Param('typeSlug') typeSlug: string,
    @Query('entry') entrySlug?: string,
    @Query('tenant') tenantSlug?: string,
  ) {
    const tenant = await this.resolveTenant(req, tenantSlug);
    return this.admin.publicContent(tenant.id, typeSlug, entrySlug);
  }

  @Public()
  @Post('blood-donors')
  async createBloodDonor(
    @Req() req: Request,
    @Body() body: CreateWebsiteBloodDonorDto,
    @Query('tenant') tenantSlug?: string,
  ) {
    const tenant = await this.resolveTenant(req, tenantSlug);
    return this.website.createPublicBloodDonor(tenant.id, body);
  }

  @Public()
  @Post('newsletter')
  async createNewsletterSubscriber(
    @Req() req: Request,
    @Body() body: CreateWebsiteNewsletterDto,
    @Query('tenant') tenantSlug?: string,
  ) {
    const tenant = await this.resolveTenant(req, tenantSlug);
    return this.website.createPublicNewsletterSubscriber(tenant.id, body);
  }

  @Public()
  @Get('fyug-interest/window')
  async fyugInterestWindow(
    @Req() req: Request,
    @Query('tenant') tenantSlug?: string,
  ) {
    const tenant = await this.resolveTenant(req, tenantSlug);
    return this.website.getFyugInterestRegistrationWindow(tenant.id);
  }

  @Public()
  @Post('fyug-interest')
  @UseInterceptors(
    FileInterceptor('photograph', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  async createFyugInterest(
    @Req() req: Request,
    @Body() body: CreateWebsiteFyugInterestDto,
    @UploadedFile() photograph: Express.Multer.File | undefined,
    @Query('tenant') tenantSlug?: string,
  ) {
    const tenant = await this.resolveTenant(req, tenantSlug);
    return this.website.createPublicFyugInterest(tenant.id, body, photograph);
  }

  @Public()
  @Get('academic/departments')
  async academicDepartments(
    @Req() req: Request,
    @Query('tenant') tenantSlug?: string,
    @Query('q') q?: string,
    @Query('category') category?: string,
  ) {
    const tenant = await this.resolveTenant(req, tenantSlug);
    return this.academic.listDepartments(tenant.id, { q, category });
  }

  @Public()
  @Get('academic/departments/:slug')
  async academicDepartment(
    @Req() req: Request,
    @Param('slug') slug: string,
    @Query('tenant') tenantSlug?: string,
  ) {
    const tenant = await this.resolveTenant(req, tenantSlug);
    return this.academic.getDepartment(tenant.id, slug);
  }

  @Public()
  @Get('academic/faculty/:slug')
  async academicFaculty(
    @Req() req: Request,
    @Param('slug') slug: string,
    @Query('tenant') tenantSlug?: string,
  ) {
    const tenant = await this.resolveTenant(req, tenantSlug);
    return this.academic.getFaculty(tenant.id, slug);
  }

  @Public()
  @Get('academic/search')
  async academicSearch(
    @Req() req: Request,
    @Query('q') q?: string,
    @Query('tenant') tenantSlug?: string,
  ) {
    const tenant = await this.resolveTenant(req, tenantSlug);
    return this.academic.search(tenant.id, q);
  }
}
