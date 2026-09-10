import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  Query,
} from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import {
  SubmitSchoolWebEnquiryDto,
  SchoolWebPresenceHeartbeatDto,
} from './dto/school-web.dto';
import { SchoolWebService } from './school-web.service';
import { SchoolWebPresenceService } from './school-web-presence.service';
import { SchoolWebGalleryService } from './school-web-gallery.service';

@ApiTags('school-web-public')
@Controller({ path: 'school-web/public', version: '1' })
export class SchoolWebPublicController {
  constructor(
    private readonly web: SchoolWebService,
    private readonly presence: SchoolWebPresenceService,
    private readonly gallery: SchoolWebGalleryService,
  ) {}

  private tenantId(loginHost?: string, forwarded?: string, host?: string) {
    return this.web.resolvePublicTenantId(loginHost || forwarded || host);
  }

  @Public()
  @Get('site')
  async site(
    @Headers('x-login-host') loginHost?: string,
    @Headers('x-forwarded-host') forwarded?: string,
    @Headers('host') host?: string,
  ) {
    return this.web.getPublicBundle(
      await this.tenantId(loginHost, forwarded, host),
    );
  }

  @Public()
  @Get('pages/:slug')
  async page(
    @Param('slug') slug: string,
    @Headers('x-login-host') loginHost?: string,
    @Headers('x-forwarded-host') forwarded?: string,
    @Headers('host') host?: string,
  ) {
    return this.web.getPublishedPage(
      await this.tenantId(loginHost, forwarded, host),
      slug,
    );
  }

  @Public()
  @Get('notices')
  async notices(
    @Headers('x-login-host') loginHost?: string,
    @Headers('x-forwarded-host') forwarded?: string,
    @Headers('host') host?: string,
  ) {
    return this.web.listPublishedNotices(
      await this.tenantId(loginHost, forwarded, host),
    );
  }

  @Public()
  @Get('notices/:slug')
  async notice(
    @Param('slug') slug: string,
    @Headers('x-login-host') loginHost?: string,
    @Headers('x-forwarded-host') forwarded?: string,
    @Headers('host') host?: string,
  ) {
    return this.web.getPublishedNotice(
      await this.tenantId(loginHost, forwarded, host),
      slug,
    );
  }

  @Public()
  @Get('events')
  async events(
    @Headers('x-login-host') loginHost?: string,
    @Headers('x-forwarded-host') forwarded?: string,
    @Headers('host') host?: string,
  ) {
    return this.web.listPublishedEvents(
      await this.tenantId(loginHost, forwarded, host),
    );
  }

  @Public()
  @Get('events/:slug')
  async event(
    @Param('slug') slug: string,
    @Headers('x-login-host') loginHost?: string,
    @Headers('x-forwarded-host') forwarded?: string,
    @Headers('host') host?: string,
  ) {
    return this.web.getPublishedEvent(
      await this.tenantId(loginHost, forwarded, host),
      slug,
    );
  }

  @Public()
  @Get('gallery')
  async galleryList(
    @Headers('x-login-host') loginHost?: string,
    @Headers('x-forwarded-host') forwarded?: string,
    @Headers('host') host?: string,
    @Query('q') q?: string,
    @Query('categoryId') categoryId?: string,
    @Query('tagId') tagId?: string,
    @Query('page') page?: string,
  ) {
    return this.gallery.listPublic(
      await this.tenantId(loginHost, forwarded, host),
      {
        q,
        categoryId,
        tagId,
        page: page ? Number(page) : 1,
      },
    );
  }

  @Public()
  @Get('gallery/:slug')
  async galleryAlbum(
    @Param('slug') slug: string,
    @Headers('x-login-host') loginHost?: string,
    @Headers('x-forwarded-host') forwarded?: string,
    @Headers('host') host?: string,
  ) {
    return this.gallery.getPublic(
      await this.tenantId(loginHost, forwarded, host),
      slug,
    );
  }

  @Public()
  @Post('presence')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async presenceHeartbeat(
    @Body() dto: SchoolWebPresenceHeartbeatDto,
    @Req() req: Request,
    @Headers('x-login-host') loginHost?: string,
    @Headers('x-forwarded-host') forwarded?: string,
    @Headers('host') host?: string,
  ) {
    const tenantId = await this.tenantId(loginHost, forwarded, host);
    const site = await this.web.getSite(tenantId);
    return this.presence.heartbeat(
      tenantId,
      site.extrasJson,
      dto.sessionId,
      dto.path,
      req,
    );
  }

  @Public()
  @Post('enquiries')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async enquire(
    @Body() dto: SubmitSchoolWebEnquiryDto,
    @Headers('x-login-host') loginHost?: string,
    @Headers('x-forwarded-host') forwarded?: string,
    @Headers('host') host?: string,
  ) {
    return this.web.submitEnquiry(
      await this.tenantId(loginHost, forwarded, host),
      dto,
    );
  }
}
