import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import {
  SCHOOL_WEB_PERMISSION_ENQUIRIES,
  SCHOOL_WEB_PERMISSION_MANAGE,
  SCHOOL_WEB_PERMISSION_MEDIA,
  SCHOOL_WEB_PERMISSION_PUBLISH,
  SCHOOL_WEB_PERMISSION_READ,
} from './school-web.constants';
import {
  PatchEnquiryStatusDto,
  PatchHomepageSectionDto,
  PatchSchoolWebSiteDto,
  ReplaceSchoolWebMenuDto,
  UpsertSchoolWebEventDto,
  UpsertSchoolWebNoticeDto,
  UpsertSchoolWebPageDto,
} from './dto/school-web.dto';
import { SchoolWebService } from './school-web.service';
import { SchoolWebPresenceService } from './school-web-presence.service';
import {
  HERO_SLIDE_MAX,
  HERO_UPLOAD_MAX_BYTES,
} from './school-web-gallery.util';

@ApiBearerAuth()
@ApiTags('school-web')
@Controller({ path: 'school-web', version: '1' })
export class SchoolWebController {
  constructor(
    private readonly web: SchoolWebService,
    private readonly presence: SchoolWebPresenceService,
  ) {}

  @Get('site')
  @RequireAnyPermission(
    SCHOOL_WEB_PERMISSION_READ,
    SCHOOL_WEB_PERMISSION_MANAGE,
  )
  site(@CurrentUser() user: JwtUser) {
    return this.web.getSite(user.tid);
  }

  @Patch('site')
  @RequireAnyPermission(SCHOOL_WEB_PERMISSION_MANAGE)
  patchSite(@CurrentUser() user: JwtUser, @Body() dto: PatchSchoolWebSiteDto) {
    return this.web.patchSite(user.tid, user.sub, dto);
  }

  @Get('menus')
  @RequireAnyPermission(
    SCHOOL_WEB_PERMISSION_READ,
    SCHOOL_WEB_PERMISSION_MANAGE,
  )
  menus(@CurrentUser() user: JwtUser) {
    return this.web.listMenus(user.tid);
  }

  @Put('menus')
  @RequireAnyPermission(SCHOOL_WEB_PERMISSION_MANAGE)
  replaceMenu(
    @CurrentUser() user: JwtUser,
    @Body() dto: ReplaceSchoolWebMenuDto,
  ) {
    return this.web.replaceMenu(user.tid, user.sub, dto);
  }

  @Get('homepage')
  @RequireAnyPermission(
    SCHOOL_WEB_PERMISSION_READ,
    SCHOOL_WEB_PERMISSION_MANAGE,
  )
  homepage(@CurrentUser() user: JwtUser) {
    return this.web.listHomepage(user.tid);
  }

  @Post('homepage/hero/images')
  @RequireAnyPermission(
    SCHOOL_WEB_PERMISSION_MEDIA,
    SCHOOL_WEB_PERMISSION_MANAGE,
  )
  @UseInterceptors(
    FilesInterceptor('files', HERO_SLIDE_MAX, {
      storage: memoryStorage(),
      limits: { fileSize: HERO_UPLOAD_MAX_BYTES },
    }),
  )
  uploadHero(
    @CurrentUser() user: JwtUser,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.web.uploadHeroImages(user.tid, user.sub, files ?? []);
  }

  @Patch('homepage/:key')
  @RequireAnyPermission(SCHOOL_WEB_PERMISSION_MANAGE)
  patchHome(
    @CurrentUser() user: JwtUser,
    @Param('key') key: string,
    @Body() dto: PatchHomepageSectionDto,
  ) {
    return this.web.patchHomepageSection(user.tid, key, user.sub, dto);
  }

  @Get('pages')
  @RequireAnyPermission(
    SCHOOL_WEB_PERMISSION_READ,
    SCHOOL_WEB_PERMISSION_MANAGE,
  )
  pages(@CurrentUser() user: JwtUser) {
    return this.web.listPages(user.tid);
  }

  @Post('pages')
  @RequireAnyPermission(
    SCHOOL_WEB_PERMISSION_MANAGE,
    SCHOOL_WEB_PERMISSION_PUBLISH,
  )
  upsertPage(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpsertSchoolWebPageDto,
  ) {
    return this.web.upsertPage(user.tid, user.sub, dto);
  }

  @Get('notices')
  @RequireAnyPermission(
    SCHOOL_WEB_PERMISSION_READ,
    SCHOOL_WEB_PERMISSION_MANAGE,
  )
  notices(@CurrentUser() user: JwtUser) {
    return this.web.listNoticesOffice(user.tid);
  }

  @Post('notices')
  @RequireAnyPermission(
    SCHOOL_WEB_PERMISSION_MANAGE,
    SCHOOL_WEB_PERMISSION_PUBLISH,
  )
  upsertNotice(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpsertSchoolWebNoticeDto,
  ) {
    return this.web.upsertNotice(user.tid, user.sub, dto);
  }

  @Get('events')
  @RequireAnyPermission(
    SCHOOL_WEB_PERMISSION_READ,
    SCHOOL_WEB_PERMISSION_MANAGE,
  )
  events(@CurrentUser() user: JwtUser) {
    return this.web.listEventsOffice(user.tid);
  }

  @Post('events')
  @RequireAnyPermission(
    SCHOOL_WEB_PERMISSION_MANAGE,
    SCHOOL_WEB_PERMISSION_PUBLISH,
  )
  upsertEvent(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpsertSchoolWebEventDto,
  ) {
    return this.web.upsertEvent(user.tid, user.sub, dto);
  }

  @Get('enquiries')
  @RequireAnyPermission(
    SCHOOL_WEB_PERMISSION_ENQUIRIES,
    SCHOOL_WEB_PERMISSION_MANAGE,
  )
  enquiries(@CurrentUser() user: JwtUser) {
    return this.web.listEnquiries(user.tid);
  }

  @Patch('enquiries/:id')
  @RequireAnyPermission(
    SCHOOL_WEB_PERMISSION_ENQUIRIES,
    SCHOOL_WEB_PERMISSION_MANAGE,
  )
  patchEnquiry(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: PatchEnquiryStatusDto,
  ) {
    return this.web.patchEnquiry(user.tid, id, user.sub, dto);
  }

  @Get('visitors/stats')
  @RequireAnyPermission(
    SCHOOL_WEB_PERMISSION_READ,
    SCHOOL_WEB_PERMISSION_MANAGE,
  )
  async visitorStats(@CurrentUser() user: JwtUser) {
    const site = await this.web.getSite(user.tid);
    return this.presence.stats(user.tid, site.extrasJson);
  }

  @Get('seo/audit')
  @RequireAnyPermission(
    SCHOOL_WEB_PERMISSION_READ,
    SCHOOL_WEB_PERMISSION_MANAGE,
  )
  seoAudit(@CurrentUser() user: JwtUser) {
    return this.web.getSeoAudit(user.tid);
  }

  @Get('audit')
  @RequireAnyPermission(
    SCHOOL_WEB_PERMISSION_READ,
    SCHOOL_WEB_PERMISSION_MANAGE,
  )
  audit(@CurrentUser() user: JwtUser) {
    return this.web.listAudit(user.tid);
  }
}
