import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { TenantResolutionService } from '../tenants/tenant-resolution.service';
import { JournalResolutionService } from './services/journal-resolution.service';
import { JournalReviewService } from './services/journal-review.service';

@ApiBearerAuth()
@ApiTags('journals-reviewer')
@Controller({ path: 'journals/portal/reviewer', version: '1' })
export class JournalsReviewerController {
  constructor(
    private readonly reviews: JournalReviewService,
    private readonly resolution: JournalResolutionService,
    private readonly tenantResolution: TenantResolutionService,
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

  private async resolveJournal(req: Request, querySlug?: string) {
    const host = this.resolveHost(req);
    const headerSlug = String(req.headers['x-journal-slug'] ?? '')
      .trim()
      .toLowerCase();
    const slug = headerSlug || querySlug?.trim().toLowerCase() || null;
    return this.resolution.resolveTenantAndJournal({
      host,
      journalSlug: slug,
    });
  }

  @Get('assignments')
  async list(
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
    @Query('journal') journal?: string,
  ) {
    const { journal: j } = await this.resolveJournal(req, journal);
    return this.reviews.listMyAssignments(user, j.id);
  }

  @Get('assignments/:id')
  async get(
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
    @Param('id') id: string,
    @Query('journal') journal?: string,
  ) {
    const { journal: j } = await this.resolveJournal(req, journal);
    return this.reviews.getAssignment(user, j.id, id);
  }

  @Post('assignments/:id/accept')
  async accept(
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
    @Param('id') id: string,
    @Query('journal') journal: string | undefined,
    @Body()
    body: {
      token?: string;
      conflictOfInterest?: boolean;
      conflictOfInterestNotes?: string;
    },
  ) {
    const { journal: j } = await this.resolveJournal(req, journal);
    return this.reviews.respondInvite(user, j.id, id, true, body.token, {
      conflictOfInterest: body.conflictOfInterest,
      conflictOfInterestNotes: body.conflictOfInterestNotes,
    });
  }

  @Post('assignments/:id/decline')
  async decline(
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
    @Param('id') id: string,
    @Query('journal') journal: string | undefined,
    @Body() body: { token?: string },
  ) {
    const { journal: j } = await this.resolveJournal(req, journal);
    return this.reviews.respondInvite(user, j.id, id, false, body.token);
  }

  @Post('assignments/:id/report')
  async report(
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
    @Param('id') id: string,
    @Query('journal') journal: string | undefined,
    @Body()
    body: {
      recommendation: string;
      commentsToEditor?: string;
      commentsToAuthor?: string;
      confidentialNotes?: string;
    },
  ) {
    const { journal: j } = await this.resolveJournal(req, journal);
    return this.reviews.submitReport(user, j.id, id, body);
  }
}
