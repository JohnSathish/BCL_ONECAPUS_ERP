import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import {
  CreateWebsitePageDto,
  ListWebsitePagesQueryDto,
  PublishWebsitePageDto,
  UpdateWebsitePageDto,
  UpdateWebsiteSiteDto,
  UploadWebsiteMediaDto,
  UpsertWebsiteRedirectDto,
} from './dto/website.dto';
import { WebsiteAdminService } from './website-admin.service';
import { WebsiteService } from './website.service';

@ApiBearerAuth()
@ApiTags('website-management')
@Controller({ path: 'website', version: '1' })
export class WebsiteManagementController {
  constructor(
    private readonly website: WebsiteService,
    private readonly admin: WebsiteAdminService,
  ) {}

  @Get('site')
  @RequireAnyPermission('website:read', 'website:manage', 'website:publish')
  site(@CurrentUser() user: JwtUser) {
    return this.website.getOrCreateSite(user.tid, user.sub);
  }

  @Patch('site')
  @RequirePermissions('website:manage')
  updateSite(@CurrentUser() user: JwtUser, @Body() dto: UpdateWebsiteSiteDto) {
    return this.website.updateSite(user, dto);
  }

  @Post('seed-defaults')
  @RequirePermissions('website:manage', 'website:publish')
  async seedDefaults(@CurrentUser() user: JwtUser) {
    const pages = await this.website.seedDefaults(user);
    const foundation = await this.admin.seedDefaults(user);
    return {
      message:
        'Website CMS catalogue imported. Pages, menus, homepage, news and notices are ready.',
      ...pages,
      foundation,
    };
  }

  @Post('import-catalogue')
  @RequirePermissions('website:manage', 'website:publish')
  async importCatalogue(@CurrentUser() user: JwtUser) {
    return this.seedDefaults(user);
  }

  @Get('pages')
  @RequireAnyPermission('website:read', 'website:manage', 'website:publish')
  pages(
    @CurrentUser() user: JwtUser,
    @Query() query: ListWebsitePagesQueryDto,
  ) {
    return this.website.listPages(user.tid, query);
  }

  @Post('pages')
  @RequirePermissions('website:manage')
  createPage(@CurrentUser() user: JwtUser, @Body() dto: CreateWebsitePageDto) {
    return this.website.createPage(user, dto);
  }

  @Get('pages/:pageId')
  @RequireAnyPermission('website:read', 'website:manage', 'website:publish')
  page(@CurrentUser() user: JwtUser, @Param('pageId') pageId: string) {
    return this.website.getPage(user.tid, pageId);
  }

  @Patch('pages/:pageId')
  @RequirePermissions('website:manage')
  updatePage(
    @CurrentUser() user: JwtUser,
    @Param('pageId') pageId: string,
    @Body() dto: UpdateWebsitePageDto,
  ) {
    return this.website.updatePage(user, pageId, dto);
  }

  @Post('pages/:pageId/revisions/:revisionId/restore')
  @RequirePermissions('website:manage')
  restoreRevision(
    @CurrentUser() user: JwtUser,
    @Param('pageId') pageId: string,
    @Param('revisionId') revisionId: string,
  ) {
    return this.website.restoreRevision(user, pageId, revisionId);
  }

  @Post('pages/:pageId/publish')
  @RequirePermissions('website:publish')
  publishPage(
    @CurrentUser() user: JwtUser,
    @Param('pageId') pageId: string,
    @Body() dto: PublishWebsitePageDto,
  ) {
    return this.website.publishPage(user, pageId, dto.revisionId);
  }

  @Post('pages/:pageId/unpublish')
  @RequirePermissions('website:publish')
  unpublishPage(@CurrentUser() user: JwtUser, @Param('pageId') pageId: string) {
    return this.website.unpublishPage(user, pageId);
  }

  @Delete('pages/:pageId')
  @RequirePermissions('website:manage')
  archivePage(@CurrentUser() user: JwtUser, @Param('pageId') pageId: string) {
    return this.website.archivePage(user, pageId);
  }

  @Get('media')
  @RequireAnyPermission('website:read', 'website:manage')
  media(@CurrentUser() user: JwtUser, @Query('kind') kind?: string) {
    return this.website.listMedia(user.tid, kind);
  }

  @Post('media')
  @RequirePermissions('website:manage')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  uploadMedia(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadWebsiteMediaDto,
  ) {
    return this.website.uploadMedia(
      user,
      file,
      dto.kind ?? 'IMAGE',
      dto.altText,
    );
  }

  @Delete('media/:mediaId')
  @RequirePermissions('website:manage')
  deleteMedia(@CurrentUser() user: JwtUser, @Param('mediaId') mediaId: string) {
    return this.website.deleteMedia(user, mediaId);
  }

  @Get('redirects')
  @RequireAnyPermission('website:read', 'website:manage')
  redirects(@CurrentUser() user: JwtUser) {
    return this.website.listRedirects(user.tid);
  }

  @Post('redirects')
  @RequirePermissions('website:manage')
  upsertRedirect(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpsertWebsiteRedirectDto,
  ) {
    return this.website.upsertRedirect(user, dto);
  }

  @Delete('redirects/:redirectId')
  @RequirePermissions('website:manage')
  deleteRedirect(
    @CurrentUser() user: JwtUser,
    @Param('redirectId') redirectId: string,
  ) {
    return this.website.deleteRedirect(user, redirectId);
  }
}
