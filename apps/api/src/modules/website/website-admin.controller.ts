import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import {
  AdminWebsitePageDto,
  CreateWebsiteContentTypeDto,
  CreateWebsitePreviewDto,
  PublishWebsiteDto,
  ReorderWebsiteSectionsDto,
  UpdateStaffWebsiteVisibilityDto,
  UpdateWebsiteHeroSlideDto,
  UpdateWebsiteMediaDto,
  UpdateWebsiteMenuDto,
  UpsertWebsiteDepartmentProfileDto,
  ReorderWebsiteHeroSlidesDto,
  WebsiteContentEntryDto,
  WebsiteSectionDto,
  WebsiteSettingsDto,
} from './dto/website-admin.dto';
import {
  ListWebsiteBloodDonorsQueryDto,
  ListWebsiteFyugInterestsQueryDto,
  ListWebsiteNewsletterQueryDto,
  UpdateWebsiteNewsletterStatusDto,
} from './dto/website.dto';
import { WebsiteAdminService } from './website-admin.service';
import { WebsiteAcademicService } from './website-academic.service';
import { WebsiteCmsEnterpriseService } from './website-cms-enterprise.service';
import { WebsiteService } from './website.service';
import { WebsiteFyugInterestDocumentService } from './services/website-fyug-interest-document.service';
import { WebsiteAcademicPlannerService } from './website-academic-planner.service';

@ApiBearerAuth()
@ApiTags('website-admin')
@Controller({ path: 'website/admin', version: '1' })
export class WebsiteAdminController {
  constructor(
    private readonly admin: WebsiteAdminService,
    private readonly website: WebsiteService,
    private readonly academic: WebsiteAcademicService,
    private readonly enterprise: WebsiteCmsEnterpriseService,
    private readonly fyugDocuments: WebsiteFyugInterestDocumentService,
    private readonly planner: WebsiteAcademicPlannerService,
  ) {}

  @Get('dashboard')
  @RequireAnyPermission('website:read', 'website:edit', 'website:manage')
  dashboard(@CurrentUser() user: JwtUser) {
    return this.enterprise.enhancedDashboard(user.tid);
  }

  @Get('settings')
  @RequireAnyPermission('website:read', 'website:edit', 'website:manage')
  settings(@CurrentUser() user: JwtUser) {
    return this.admin.settings(user.tid);
  }

  @Patch('settings')
  @RequireAnyPermission('website:edit', 'website:manage')
  updateSettings(
    @CurrentUser() user: JwtUser,
    @Body() dto: WebsiteSettingsDto,
  ) {
    return this.admin.updateSettings(user, dto);
  }

  @Get('pages')
  @RequireAnyPermission('website:read', 'website:edit', 'website:manage')
  pages(@CurrentUser() user: JwtUser) {
    return this.admin.pages(user.tid);
  }

  @Post('pages')
  @RequireAnyPermission('website:edit', 'website:manage')
  createPage(@CurrentUser() user: JwtUser, @Body() dto: AdminWebsitePageDto) {
    return this.admin.createPage(user, dto);
  }

  @Patch('pages/:pageId')
  @RequireAnyPermission('website:edit', 'website:manage')
  updatePage(
    @CurrentUser() user: JwtUser,
    @Param('pageId') pageId: string,
    @Body() dto: AdminWebsitePageDto,
  ) {
    return this.admin.updatePage(user, pageId, dto);
  }

  @Post('pages/:pageId/sections')
  @RequireAnyPermission('website:edit', 'website:manage')
  createSection(
    @CurrentUser() user: JwtUser,
    @Param('pageId') pageId: string,
    @Body() dto: WebsiteSectionDto,
  ) {
    return this.admin.createSection(user, pageId, dto);
  }

  @Patch('pages/:pageId/sections/:sectionId')
  @RequireAnyPermission('website:edit', 'website:manage')
  updateSection(
    @CurrentUser() user: JwtUser,
    @Param('pageId') pageId: string,
    @Param('sectionId') sectionId: string,
    @Body() dto: WebsiteSectionDto,
  ) {
    return this.admin.updateSection(user, pageId, sectionId, dto);
  }

  @Put('pages/:pageId/sections/reorder')
  @RequireAnyPermission('website:edit', 'website:manage')
  reorderSections(
    @CurrentUser() user: JwtUser,
    @Param('pageId') pageId: string,
    @Body() dto: ReorderWebsiteSectionsDto,
  ) {
    return this.admin.reorderSections(user, pageId, dto.sectionIds);
  }

  @Get('menus')
  @RequireAnyPermission('website:read', 'website:edit', 'website:manage')
  menus(@CurrentUser() user: JwtUser) {
    return this.admin.menus(user.tid);
  }

  @Patch('menus/:menuId')
  @RequireAnyPermission('website:edit', 'website:manage')
  updateMenu(
    @CurrentUser() user: JwtUser,
    @Param('menuId') menuId: string,
    @Body() dto: UpdateWebsiteMenuDto,
  ) {
    return this.admin.updateMenu(user, menuId, dto);
  }

  @Get('content-types')
  @RequireAnyPermission('website:read', 'website:edit', 'website:manage')
  contentTypes(@CurrentUser() user: JwtUser) {
    return this.admin.contentTypes(user.tid);
  }

  @Post('content-types')
  @RequireAnyPermission('website:edit', 'website:manage')
  createContentType(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateWebsiteContentTypeDto,
  ) {
    return this.admin.createContentType(user, dto);
  }

  @Get('content-types/:contentTypeId/entries')
  @RequireAnyPermission('website:read', 'website:edit', 'website:manage')
  entries(
    @CurrentUser() user: JwtUser,
    @Param('contentTypeId') contentTypeId: string,
  ) {
    return this.admin.entries(user.tid, contentTypeId, false);
  }

  @Get('content-types/:contentTypeId/entries/trash')
  @RequireAnyPermission('website:read', 'website:edit', 'website:manage')
  entriesTrash(
    @CurrentUser() user: JwtUser,
    @Param('contentTypeId') contentTypeId: string,
  ) {
    return this.admin.entries(user.tid, contentTypeId, true);
  }

  @Post('content-types/:contentTypeId/entries')
  @RequireAnyPermission('website:edit', 'website:manage')
  createEntry(
    @CurrentUser() user: JwtUser,
    @Param('contentTypeId') contentTypeId: string,
    @Body() dto: WebsiteContentEntryDto,
  ) {
    return this.admin.createEntry(user, contentTypeId, dto);
  }

  @Patch('content-entries/:entryId')
  @RequireAnyPermission('website:edit', 'website:manage')
  updateEntry(
    @CurrentUser() user: JwtUser,
    @Param('entryId') entryId: string,
    @Body() dto: WebsiteContentEntryDto,
  ) {
    return this.admin.updateEntry(user, entryId, dto);
  }

  @Delete('content-entries/:entryId')
  @RequireAnyPermission('website:edit', 'website:manage')
  trashEntry(@CurrentUser() user: JwtUser, @Param('entryId') entryId: string) {
    return this.admin.trashEntry(user, entryId);
  }

  @Post('content-entries/:entryId/restore')
  @RequireAnyPermission('website:edit', 'website:manage')
  restoreEntry(
    @CurrentUser() user: JwtUser,
    @Param('entryId') entryId: string,
  ) {
    return this.admin.restoreEntry(user, entryId);
  }

  @Post('content-entries/:entryId/preview')
  @RequireAnyPermission('website:read', 'website:edit', 'website:manage')
  previewEntry(
    @CurrentUser() user: JwtUser,
    @Param('entryId') entryId: string,
  ) {
    return this.admin.previewContentEntry(user, entryId);
  }

  @Get('media')
  @RequireAnyPermission('website:read', 'website:media', 'website:manage')
  media(@CurrentUser() user: JwtUser) {
    return this.admin.media(user.tid);
  }

  @Post('media')
  @RequireAnyPermission('website:media', 'website:manage')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  uploadMedia(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('altText') altText?: string,
    @Body('kind') kind?: string,
  ) {
    return this.admin.uploadMedia(
      user,
      file,
      altText,
      kind?.toUpperCase() === 'DOCUMENT' ? 'DOCUMENT' : 'IMAGE',
    );
  }

  @Patch('media/:mediaId')
  @RequireAnyPermission('website:media', 'website:manage')
  updateMedia(
    @CurrentUser() user: JwtUser,
    @Param('mediaId') mediaId: string,
    @Body() dto: UpdateWebsiteMediaDto,
  ) {
    return this.admin.updateMedia(user, mediaId, dto);
  }

  @Delete('media/:mediaId')
  @RequireAnyPermission('website:media', 'website:manage')
  deleteMedia(@CurrentUser() user: JwtUser, @Param('mediaId') mediaId: string) {
    return this.website.deleteMedia(user, mediaId);
  }

  @Get('hero-slides')
  @RequireAnyPermission(
    'website:read',
    'website:edit',
    'website:manage',
    'website:media',
  )
  heroSlides(@CurrentUser() user: JwtUser) {
    return this.admin.listHeroSlides(user.tid);
  }

  @Post('hero-slides')
  @RequireAnyPermission('website:edit', 'website:manage', 'website:media')
  @UseInterceptors(
    FileInterceptor('desktop', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  createHeroSlide(
    @CurrentUser() user: JwtUser,
    @UploadedFile() desktop: Express.Multer.File | undefined,
    @Body('altText') altText?: string,
    @Body('mobileUrl') mobileUrl?: string,
  ) {
    return this.admin.createHeroSlide(user, desktop, altText, mobileUrl);
  }

  @Post('hero-slides/:slideId/mobile')
  @RequireAnyPermission('website:edit', 'website:manage', 'website:media')
  @UseInterceptors(
    FileInterceptor('mobile', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadHeroSlideMobile(
    @CurrentUser() user: JwtUser,
    @Param('slideId') slideId: string,
    @UploadedFile() mobile: Express.Multer.File | undefined,
  ) {
    return this.admin.uploadHeroSlideMobile(user, slideId, mobile);
  }

  @Patch('hero-slides/:slideId')
  @RequireAnyPermission('website:edit', 'website:manage', 'website:media')
  updateHeroSlide(
    @CurrentUser() user: JwtUser,
    @Param('slideId') slideId: string,
    @Body() dto: UpdateWebsiteHeroSlideDto,
  ) {
    return this.admin.updateHeroSlide(user, slideId, dto);
  }

  @Put('hero-slides/reorder')
  @RequireAnyPermission('website:edit', 'website:manage', 'website:media')
  reorderHeroSlides(
    @CurrentUser() user: JwtUser,
    @Body() dto: ReorderWebsiteHeroSlidesDto,
  ) {
    return this.admin.reorderHeroSlides(user, dto.slideIds);
  }

  @Delete('hero-slides/:slideId')
  @RequireAnyPermission('website:edit', 'website:manage', 'website:media')
  deleteHeroSlide(
    @CurrentUser() user: JwtUser,
    @Param('slideId') slideId: string,
  ) {
    return this.admin.deleteHeroSlide(user, slideId);
  }

  @Get('revisions')
  @RequireAnyPermission('website:read', 'website:edit', 'website:manage')
  revisions(@CurrentUser() user: JwtUser) {
    return this.admin.revisions(user.tid);
  }

  @Post('revisions/:revisionId/restore')
  @RequireAnyPermission('website:edit', 'website:manage')
  restoreRevision(
    @CurrentUser() user: JwtUser,
    @Param('revisionId') revisionId: string,
  ) {
    return this.admin.restoreRevision(user, revisionId);
  }

  @Post('preview')
  @RequireAnyPermission('website:read', 'website:edit', 'website:manage')
  preview(@CurrentUser() user: JwtUser, @Body() dto: CreateWebsitePreviewDto) {
    return this.admin.createPreview(user, dto.pageId);
  }

  @Post('publish')
  @RequireAnyPermission('website:publish')
  publish(@CurrentUser() user: JwtUser, @Body() dto: PublishWebsiteDto) {
    return this.admin.publish(user, dto);
  }

  @Get('academic/departments')
  @RequireAnyPermission('website:read', 'website:edit', 'website:manage')
  academicDepartments(@CurrentUser() user: JwtUser) {
    return this.academic.listProfilesForAdmin(user.tid);
  }

  @Put('academic/departments/:departmentId')
  @RequireAnyPermission('website:edit', 'website:manage')
  upsertAcademicDepartment(
    @CurrentUser() user: JwtUser,
    @Param('departmentId') departmentId: string,
    @Body() dto: UpsertWebsiteDepartmentProfileDto,
  ) {
    return this.academic.upsertDepartmentProfile(user.tid, departmentId, dto);
  }

  @Patch('academic/staff/:staffId')
  @RequireAnyPermission('website:edit', 'website:manage')
  updateStaffWebsite(
    @CurrentUser() user: JwtUser,
    @Param('staffId') staffId: string,
    @Body() dto: UpdateStaffWebsiteVisibilityDto,
  ) {
    return this.academic.updateStaffWebsiteVisibility(user.tid, staffId, dto);
  }

  @Post('academic/publish-all')
  @RequireAnyPermission('website:manage', 'website:publish')
  publishAllAcademic(@CurrentUser() user: JwtUser) {
    return this.academic.publishAcademicDepartments(user.tid);
  }

  @Get('homepage-layout')
  @RequireAnyPermission('website:read', 'website:edit', 'website:manage')
  homepageLayout(@CurrentUser() user: JwtUser) {
    return this.enterprise.ensureHomepageLayout(user.tid, user.sub);
  }

  @Get('homepage-content')
  @RequireAnyPermission('website:read', 'website:edit', 'website:manage')
  homepageContent(@CurrentUser() user: JwtUser) {
    return this.enterprise.getHomepageContent(user.tid);
  }

  @Put('homepage-content')
  @RequireAnyPermission('website:edit', 'website:manage')
  updateHomepageContent(
    @CurrentUser() user: JwtUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.enterprise.updateHomepageContent(user, body as never);
  }

  @Put('homepage-layout')
  @RequireAnyPermission('website:edit', 'website:manage')
  updateHomepageLayout(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      sections: Array<{
        sectionKey: string;
        enabled?: boolean;
        position?: number;
        settings?: Record<string, unknown>;
        label?: string;
      }>;
    },
  ) {
    return this.enterprise.updateHomepageLayout(user, body.sections ?? []);
  }

  @Get('notices')
  @RequireAnyPermission(
    'website:read',
    'website:notices:read',
    'website:notices:edit',
    'website:manage',
  )
  notices(@CurrentUser() user: JwtUser) {
    return this.enterprise.listNotices(user.tid);
  }

  @Get('notices/trash')
  @RequireAnyPermission(
    'website:read',
    'website:notices:read',
    'website:notices:edit',
    'website:manage',
  )
  noticesTrash(@CurrentUser() user: JwtUser) {
    return this.enterprise.listNotices(user.tid, { trash: true });
  }

  @Post('notices')
  @RequireAnyPermission(
    'website:notices:edit',
    'website:edit',
    'website:manage',
  )
  createNotice(
    @CurrentUser() user: JwtUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.enterprise.createNotice(user, body as never);
  }

  @Patch('notices/:noticeId')
  @RequireAnyPermission(
    'website:notices:edit',
    'website:edit',
    'website:manage',
  )
  updateNotice(
    @CurrentUser() user: JwtUser,
    @Param('noticeId') noticeId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.enterprise.updateNotice(user, noticeId, body as never);
  }

  @Delete('notices/:noticeId')
  @RequireAnyPermission(
    'website:notices:edit',
    'website:edit',
    'website:manage',
  )
  trashNotice(
    @CurrentUser() user: JwtUser,
    @Param('noticeId') noticeId: string,
  ) {
    return this.enterprise.trashNotice(user, noticeId);
  }

  @Post('notices/:noticeId/restore')
  @RequireAnyPermission(
    'website:notices:edit',
    'website:edit',
    'website:manage',
  )
  restoreNotice(
    @CurrentUser() user: JwtUser,
    @Param('noticeId') noticeId: string,
  ) {
    return this.enterprise.restoreNotice(user, noticeId);
  }

  @Get('announcements')
  @RequireAnyPermission(
    'website:read',
    'website:announcements:read',
    'website:announcements:edit',
    'website:manage',
  )
  announcements(@CurrentUser() user: JwtUser) {
    return this.enterprise.listAnnouncements(user.tid);
  }

  @Get('announcements/trash')
  @RequireAnyPermission(
    'website:read',
    'website:announcements:read',
    'website:announcements:edit',
    'website:manage',
  )
  announcementsTrash(@CurrentUser() user: JwtUser) {
    return this.enterprise.listAnnouncements(user.tid, { trash: true });
  }

  @Post('announcements')
  @RequireAnyPermission(
    'website:announcements:edit',
    'website:edit',
    'website:manage',
  )
  createAnnouncement(
    @CurrentUser() user: JwtUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.enterprise.createAnnouncement(user, body as never);
  }

  @Patch('announcements/:announcementId')
  @RequireAnyPermission(
    'website:announcements:edit',
    'website:edit',
    'website:manage',
  )
  updateAnnouncement(
    @CurrentUser() user: JwtUser,
    @Param('announcementId') announcementId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.enterprise.updateAnnouncement(
      user,
      announcementId,
      body as never,
    );
  }

  @Delete('announcements/:announcementId')
  @RequireAnyPermission(
    'website:announcements:edit',
    'website:edit',
    'website:manage',
  )
  trashAnnouncement(
    @CurrentUser() user: JwtUser,
    @Param('announcementId') announcementId: string,
  ) {
    return this.enterprise.trashAnnouncement(user, announcementId);
  }

  @Post('announcements/:announcementId/restore')
  @RequireAnyPermission(
    'website:announcements:edit',
    'website:edit',
    'website:manage',
  )
  restoreAnnouncement(
    @CurrentUser() user: JwtUser,
    @Param('announcementId') announcementId: string,
  ) {
    return this.enterprise.restoreAnnouncement(user, announcementId);
  }

  @Post('pages/:pageId/duplicate')
  @RequireAnyPermission('website:edit', 'website:manage')
  duplicatePage(@CurrentUser() user: JwtUser, @Param('pageId') pageId: string) {
    return this.enterprise.duplicatePage(user, pageId);
  }

  @Delete('pages/:pageId')
  @RequireAnyPermission('website:edit', 'website:manage')
  trashPage(@CurrentUser() user: JwtUser, @Param('pageId') pageId: string) {
    return this.enterprise.trashPage(user, pageId);
  }

  @Post('pages/:pageId/restore')
  @RequireAnyPermission('website:edit', 'website:manage')
  restorePage(@CurrentUser() user: JwtUser, @Param('pageId') pageId: string) {
    return this.enterprise.restorePage(user, pageId);
  }

  @Get('calendar-items')
  @RequireAnyPermission('website:read', 'website:edit', 'website:manage')
  calendarItems(@CurrentUser() user: JwtUser) {
    return this.enterprise.getCalendarItems(user.tid);
  }

  @Put('calendar-items')
  @RequireAnyPermission('website:edit', 'website:manage')
  updateCalendarItems(
    @CurrentUser() user: JwtUser,
    @Body() body: { items: Array<Record<string, unknown>> },
  ) {
    return this.enterprise.updateCalendarItems(user, body.items ?? []);
  }

  @Get('academic-planner/years')
  @RequireAnyPermission('website:read', 'website:edit', 'website:manage')
  listPlannerYears(@CurrentUser() user: JwtUser) {
    return this.planner.listYears(user.tid);
  }

  @Post('academic-planner/years')
  @RequireAnyPermission('website:edit', 'website:manage')
  createPlannerYear(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      title: string;
      slug?: string;
      startDate: string;
      endDate: string;
      status?: string;
    },
  ) {
    return this.planner.createYear(user, body);
  }

  @Get('academic-planner/years/:yearId')
  @RequireAnyPermission('website:read', 'website:edit', 'website:manage')
  getPlannerYear(
    @CurrentUser() user: JwtUser,
    @Param('yearId') yearId: string,
    @Query('month') month?: string,
  ) {
    return this.planner.getYearDetail(user.tid, yearId, month);
  }

  @Patch('academic-planner/years/:yearId')
  @RequireAnyPermission('website:edit', 'website:manage')
  updatePlannerYear(
    @CurrentUser() user: JwtUser,
    @Param('yearId') yearId: string,
    @Body()
    body: Partial<{
      title: string;
      slug: string;
      startDate: string;
      endDate: string;
      status: string;
      isVisible: boolean;
    }>,
  ) {
    return this.planner.updateYear(user, yearId, body);
  }

  @Delete('academic-planner/years/:yearId')
  @RequireAnyPermission('website:edit', 'website:manage')
  trashPlannerYear(
    @CurrentUser() user: JwtUser,
    @Param('yearId') yearId: string,
  ) {
    return this.planner.trashYear(user, yearId);
  }

  @Post('academic-planner/years/:yearId/ensure-month')
  @RequireAnyPermission('website:edit', 'website:manage')
  ensurePlannerMonth(
    @CurrentUser() user: JwtUser,
    @Param('yearId') yearId: string,
    @Body() body: { year: number; month: number },
  ) {
    return this.planner.ensureMonth(user, yearId, body.year, body.month);
  }

  @Post('academic-planner/years/:yearId/ensure-all-months')
  @RequireAnyPermission('website:edit', 'website:manage')
  ensurePlannerAllMonths(
    @CurrentUser() user: JwtUser,
    @Param('yearId') yearId: string,
  ) {
    return this.planner.ensureAllMonths(user, yearId);
  }

  @Put('academic-planner/years/:yearId/months/:monthKey')
  @RequireAnyPermission('website:edit', 'website:manage')
  savePlannerMonth(
    @CurrentUser() user: JwtUser,
    @Param('yearId') yearId: string,
    @Param('monthKey') monthKey: string,
    @Body()
    body: {
      days: Array<{
        id?: string;
        date: string;
        statusLabel?: string;
        description?: string;
        isWorkingDay?: boolean;
        isHighlighted?: boolean;
      }>;
    },
  ) {
    return this.planner.updateMonthDays(
      user,
      yearId,
      monthKey,
      body.days ?? [],
    );
  }

  @Patch('academic-planner/days/:dayId')
  @RequireAnyPermission('website:edit', 'website:manage')
  updatePlannerDay(
    @CurrentUser() user: JwtUser,
    @Param('dayId') dayId: string,
    @Body()
    body: Partial<{
      statusLabel: string;
      description: string;
      isWorkingDay: boolean;
      isHighlighted: boolean;
    }>,
  ) {
    return this.planner.updateDay(user, dayId, body);
  }

  @Get('content-sources')
  @RequireAnyPermission('website:read', 'website:edit', 'website:manage')
  contentSources(@CurrentUser() user: JwtUser) {
    return this.enterprise.getContentSources(user.tid);
  }

  @Put('content-sources')
  @RequireAnyPermission(
    'website:edit',
    'website:manage',
    'website:departments:edit',
  )
  updateContentSources(
    @CurrentUser() user: JwtUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.enterprise.updateContentSources(user, body);
  }

  @Get('media-folders')
  @RequireAnyPermission('website:read', 'website:media', 'website:manage')
  mediaFolders(@CurrentUser() user: JwtUser) {
    return this.enterprise.listMediaFolders(user.tid);
  }

  @Post('media-folders')
  @RequireAnyPermission('website:media', 'website:edit', 'website:manage')
  createMediaFolder(
    @CurrentUser() user: JwtUser,
    @Body() body: { name: string; parentId?: string | null },
  ) {
    return this.enterprise.createMediaFolder(user, body);
  }

  @Patch('media/:mediaId/meta')
  @RequireAnyPermission('website:media', 'website:edit', 'website:manage')
  updateMediaMeta(
    @CurrentUser() user: JwtUser,
    @Param('mediaId') mediaId: string,
    @Body()
    body: {
      altText?: string | null;
      caption?: string | null;
      tags?: string[];
      folderId?: string | null;
    },
  ) {
    return this.enterprise.updateMediaMeta(user, mediaId, body);
  }

  @Get('appearance')
  @RequireAnyPermission(
    'website:read',
    'website:edit',
    'website:manage',
    'website:seo',
  )
  appearance(@CurrentUser() user: JwtUser) {
    return this.enterprise.getThemePresets(user.tid);
  }

  @Put('appearance')
  @RequireAnyPermission('website:edit', 'website:manage', 'website:seo')
  updateAppearance(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      activeThemePresetId?: string;
      themePresets?: unknown[];
      footerWidgets?: Record<string, unknown>;
      seoDefaults?: Record<string, unknown>;
    },
  ) {
    return this.enterprise.updateAppearance(user, body);
  }

  @Post('revalidate')
  @RequireAnyPermission('website:publish', 'website:manage')
  revalidate(@CurrentUser() user: JwtUser, @Body() body: { paths?: string[] }) {
    return this.enterprise.requestRevalidation(user, body.paths);
  }

  @Get('redirects')
  @RequireAnyPermission('website:edit', 'website:manage', 'website:seo')
  redirects(@CurrentUser() user: JwtUser) {
    return this.website.listRedirects(user.tid);
  }

  @Get('blood-donors')
  @RequireAnyPermission('website:read', 'website:edit', 'website:manage')
  bloodDonors(
    @CurrentUser() user: JwtUser,
    @Query() query: ListWebsiteBloodDonorsQueryDto,
  ) {
    return this.website.listBloodDonors(user.tid, query);
  }

  @Get('newsletter')
  @RequireAnyPermission('website:read', 'website:edit', 'website:manage')
  newsletterSubscribers(
    @CurrentUser() user: JwtUser,
    @Query() query: ListWebsiteNewsletterQueryDto,
  ) {
    return this.website.listNewsletterSubscribers(user.tid, query);
  }

  @Patch('newsletter/:subscriberId')
  @RequireAnyPermission('website:edit', 'website:manage')
  updateNewsletterSubscriber(
    @CurrentUser() user: JwtUser,
    @Param('subscriberId') subscriberId: string,
    @Body() body: UpdateWebsiteNewsletterStatusDto,
  ) {
    return this.website.updateNewsletterSubscriberStatus(
      user.tid,
      subscriberId,
      body.status,
    );
  }

  @Delete('newsletter/:subscriberId')
  @RequireAnyPermission('website:edit', 'website:manage')
  deleteNewsletterSubscriber(
    @CurrentUser() user: JwtUser,
    @Param('subscriberId') subscriberId: string,
  ) {
    return this.website.deleteNewsletterSubscriber(user.tid, subscriberId);
  }

  @Get('fyug-interest')
  @RequireAnyPermission('website:read', 'website:edit', 'website:manage')
  fyugInterests(
    @CurrentUser() user: JwtUser,
    @Query() query: ListWebsiteFyugInterestsQueryDto,
  ) {
    return this.website.listFyugInterests(user.tid, query);
  }

  @Get('fyug-interest/stats')
  @RequireAnyPermission('website:read', 'website:edit', 'website:manage')
  fyugInterestStats(@CurrentUser() user: JwtUser) {
    return this.website.getFyugInterestStats(user.tid);
  }

  @Get('fyug-interest/export.xlsx')
  @RequireAnyPermission('website:read', 'website:edit', 'website:manage')
  async exportFyugInterests(
    @CurrentUser() user: JwtUser,
    @Res() res: Response,
  ) {
    const buffer = await this.website.exportFyugInterestsExcel(user.tid);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="fyug-interest-registrations.xlsx"',
    );
    res.send(buffer);
  }

  @Get('fyug-interest/:id/application.pdf')
  @RequireAnyPermission('website:read', 'website:edit', 'website:manage')
  async fyugApplicationPdf(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const row = await this.fyugDocuments.getInterest(user.tid, id);
    const buffer = await this.fyugDocuments.renderPdfBuffer(user.tid, id);
    const appNo = row.applicationNumber || row.id.slice(0, 8);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="fyug-application-${appNo}.pdf"`,
    );
    res.send(buffer);
  }
}
