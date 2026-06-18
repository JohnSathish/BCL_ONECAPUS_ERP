import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import {
  CommunicationCampaignDto,
  CommunicationTemplateDto,
  DeliveryLogQueryDto,
  NotificationPreferenceDto,
  PreviewAudienceDto,
  UpdateCommunicationTemplateDto,
} from './dto/communication.dto';
import { CommunicationAnalyticsService } from './services/communication-analytics.service';
import { CommunicationApprovalService } from './services/communication-approval.service';
import { CommunicationAudienceSegmentService } from './services/communication-audience-segment.service';
import { CommunicationAutomationService } from './services/communication-automation.service';
import { CommunicationCampaignsService } from './services/communication-campaigns.service';
import { CommunicationDashboardService } from './services/communication-dashboard.service';
import { CommunicationDeliveryService } from './services/communication-delivery.service';
import { CommunicationEmailService } from './services/communication-email.service';
import { CommunicationSettingsService } from './services/communication-settings.service';
import { CommunicationTemplatesService } from './services/communication-templates.service';
import { CommunicationWhatsAppService } from './services/communication-whatsapp.service';
import { UserNotificationsService } from './services/user-notifications.service';

@ApiBearerAuth()
@ApiTags('communication')
@Controller({ path: 'communication', version: '1' })
export class CommunicationController {
  constructor(
    private readonly templates: CommunicationTemplatesService,
    private readonly campaigns: CommunicationCampaignsService,
    private readonly dashboard: CommunicationDashboardService,
    private readonly analytics: CommunicationAnalyticsService,
    private readonly settings: CommunicationSettingsService,
    private readonly approvals: CommunicationApprovalService,
    private readonly automation: CommunicationAutomationService,
    private readonly segments: CommunicationAudienceSegmentService,
    private readonly delivery: CommunicationDeliveryService,
    private readonly email: CommunicationEmailService,
    private readonly whatsapp: CommunicationWhatsAppService,
    private readonly notifications: UserNotificationsService,
  ) {}

  @Get('dashboard')
  @RequireAnyPermission('communication:read', 'communication:manage')
  dashboardView(@CurrentUser() user: JwtUser) {
    return this.dashboard.dashboard(user.tid);
  }

  @Get('channel-health')
  @RequireAnyPermission('communication:read', 'communication:manage')
  channelHealth(@CurrentUser() user: JwtUser) {
    return this.dashboard.channelHealth(user.tid);
  }

  @Get('analytics')
  @RequireAnyPermission('communication:read', 'communication:manage')
  analyticsSummary(
    @CurrentUser() user: JwtUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.summary(user.tid, from, to);
  }

  @Get('reports/export')
  @RequireAnyPermission('communication:read', 'communication:manage')
  async exportReports(
    @CurrentUser() user: JwtUser,
    @Query('format') format: string,
    @Query() query: DeliveryLogQueryDto & { from?: string; to?: string },
    @Res() res: Response,
  ) {
    const rows = await this.analytics.exportLogs(user.tid, query);
    if (format === 'csv') {
      const header = 'Time,Channel,Status,Campaign,Recipient,Error\n';
      const body = rows
        .map((r) =>
          [
            r.createdAt.toISOString(),
            r.channel,
            r.status,
            r.campaign?.name ?? '',
            r.recipient?.displayName ?? r.recipient?.email ?? '',
            (r.errorMessage ?? '').replace(/,/g, ';'),
          ].join(','),
        )
        .join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=communication-report.csv',
      );
      return res.send(header + body);
    }
    return res.json(rows);
  }

  @Get('settings')
  @RequirePermissions('communication:manage')
  getSettings(@CurrentUser() user: JwtUser) {
    return this.settings.get(user.tid);
  }

  @Post('settings')
  @RequirePermissions('communication:manage')
  saveSettings(
    @CurrentUser() user: JwtUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.settings.upsert(user, body);
  }

  @Get('automation-rules')
  @RequireAnyPermission('communication:read', 'communication:manage')
  listAutomation(@CurrentUser() user: JwtUser) {
    return this.automation.list(user.tid);
  }

  @Post('automation-rules/seed-defaults')
  @RequirePermissions('communication:manage')
  seedAutomation(@CurrentUser() user: JwtUser) {
    return this.automation.seedDefaults(user.tid);
  }

  @Patch('automation-rules/:id/toggle')
  @RequirePermissions('communication:manage')
  toggleAutomation(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body('isEnabled') isEnabled: boolean,
  ) {
    return this.automation.toggle(user, id, isEnabled);
  }

  @Get('audience-segments')
  @RequireAnyPermission('communication:read', 'communication:manage')
  listSegments(@CurrentUser() user: JwtUser) {
    return this.segments.list(user.tid);
  }

  @Post('audience-segments')
  @RequirePermissions('communication:manage')
  createSegment(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      name: string;
      audienceType: string;
      filters: Record<string, unknown>;
    },
  ) {
    return this.segments.create(user, body);
  }

  @Delete('audience-segments/:id')
  @RequirePermissions('communication:manage')
  removeSegment(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.segments.remove(user, id);
  }

  @Get('approvals')
  @RequireAnyPermission('communication:read', 'communication:manage')
  listApprovals(
    @CurrentUser() user: JwtUser,
    @Query('status') status?: string,
  ) {
    return this.approvals.list(user.tid, status);
  }

  @Post('approvals/submit/:campaignId')
  @RequirePermissions('communication:manage')
  submitApproval(
    @CurrentUser() user: JwtUser,
    @Param('campaignId') campaignId: string,
  ) {
    return this.approvals.submit(user, campaignId);
  }

  @Post('approvals/:id/approve')
  @RequirePermissions('communication:manage')
  approveMessage(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body('note') note?: string,
  ) {
    return this.approvals.approve(user, id, note);
  }

  @Post('approvals/:id/reject')
  @RequirePermissions('communication:manage')
  rejectMessage(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body('note') note?: string,
  ) {
    return this.approvals.reject(user, id, note);
  }

  @Get('whatsapp/templates')
  @RequireAnyPermission('communication:read', 'communication:manage')
  whatsappTemplates(@CurrentUser() user: JwtUser) {
    return this.whatsapp.listTemplates(user.tid);
  }

  @Post('channels/email/test')
  @RequirePermissions('communication:manage')
  testEmail(
    @CurrentUser() user: JwtUser,
    @Body() body: { to: string; subject?: string },
  ) {
    return this.email.send({
      to: body.to,
      subject: body.subject ?? 'OneCampus Communication Test',
      text: 'This is a test email from the Communication Center.',
    });
  }

  @Public()
  @Get('track/open/:logId')
  trackOpen(@Param('logId') logId: string, @Res() res: Response) {
    void this.delivery.trackOpen(logId);
    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    res.setHeader('Content-Type', 'image/png');
    return res.send(pixel);
  }

  @Public()
  @Get('track/click/:logId')
  async trackClick(
    @Param('logId') logId: string,
    @Query('url') url: string,
    @Res() res: Response,
  ) {
    await this.delivery.trackClick(logId);
    return res.redirect(url || '/');
  }

  @Get('templates')
  @RequireAnyPermission('communication:read', 'communication:manage')
  listTemplates(
    @CurrentUser() user: JwtUser,
    @Query('category') category?: string,
  ) {
    return this.templates.list(user.tid, category);
  }

  @Post('templates')
  @RequirePermissions('communication:manage')
  createTemplate(
    @CurrentUser() user: JwtUser,
    @Body() dto: CommunicationTemplateDto,
  ) {
    return this.templates.create(user, dto);
  }

  @Post('templates/seed-defaults')
  @RequirePermissions('communication:manage')
  seedTemplates(@CurrentUser() user: JwtUser) {
    return this.templates.seedDefaults(user);
  }

  @Get('templates/:id')
  @RequireAnyPermission('communication:read', 'communication:manage')
  getTemplate(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.templates.get(user.tid, id);
  }

  @Patch('templates/:id')
  @RequirePermissions('communication:manage')
  updateTemplate(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateCommunicationTemplateDto,
  ) {
    return this.templates.update(user, id, dto);
  }

  @Delete('templates/:id')
  @RequirePermissions('communication:manage')
  removeTemplate(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.templates.remove(user, id);
  }

  @Get('campaigns')
  @RequireAnyPermission('communication:read', 'communication:manage')
  listCampaigns(
    @CurrentUser() user: JwtUser,
    @Query('status') status?: string,
  ) {
    return this.campaigns.list(user.tid, status);
  }

  @Post('campaigns')
  @RequirePermissions('communication:manage')
  createCampaign(
    @CurrentUser() user: JwtUser,
    @Body() dto: CommunicationCampaignDto,
  ) {
    return this.campaigns.create(user, dto);
  }

  @Post('campaigns/preview-audience')
  @RequireAnyPermission('communication:read', 'communication:manage')
  previewAudience(
    @CurrentUser() user: JwtUser,
    @Body() dto: PreviewAudienceDto,
  ) {
    return this.campaigns.previewAudience(user, dto);
  }

  @Get('campaigns/:id')
  @RequireAnyPermission('communication:read', 'communication:manage')
  getCampaign(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.campaigns.get(user.tid, id);
  }

  @Post('campaigns/:id/send')
  @RequirePermissions('communication:manage')
  sendCampaign(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.campaigns.send(user, id);
  }

  @Post('campaigns/:id/cancel')
  @RequirePermissions('communication:manage')
  cancelCampaign(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.campaigns.cancel(user, id);
  }

  @Get('campaigns/:id/recipients')
  @RequireAnyPermission('communication:read', 'communication:manage')
  campaignRecipients(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.campaigns.recipients(user.tid, id);
  }

  @Get('delivery-logs')
  @RequireAnyPermission('communication:read', 'communication:manage')
  deliveryLogs(
    @CurrentUser() user: JwtUser,
    @Query() query: DeliveryLogQueryDto,
  ) {
    return this.campaigns.deliveryLogs(user.tid, query);
  }

  @Post('delivery-logs/:id/retry')
  @RequirePermissions('communication:manage')
  retryDelivery(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.campaigns.retryDelivery(user, id);
  }

  @Get('notifications')
  @RequireAnyPermission(
    'notifications:read',
    'communication:read',
    'communication:manage',
  )
  listNotifications(
    @CurrentUser() user: JwtUser,
    @Query('limit') limit?: string,
    @Query('filter') filter?: 'all' | 'unread' | 'archived',
  ) {
    if (filter) {
      return this.notifications.listInbox(
        user,
        filter,
        limit ? Number(limit) : 50,
      );
    }
    return this.notifications.list(user, limit ? Number(limit) : 30);
  }

  @Get('notifications/unread-count')
  @RequireAnyPermission(
    'notifications:read',
    'communication:read',
    'communication:manage',
  )
  unreadCount(@CurrentUser() user: JwtUser) {
    return this.notifications.unreadCount(user);
  }

  @Post('notifications/:id/read')
  @RequireAnyPermission(
    'notifications:read',
    'communication:read',
    'communication:manage',
  )
  markRead(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.notifications.markRead(user, id);
  }

  @Post('notifications/:id/dismiss')
  @RequireAnyPermission(
    'notifications:read',
    'communication:read',
    'communication:manage',
  )
  dismissNotification(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.notifications.dismiss(user, id);
  }

  @Post('notifications/:id/archive')
  @RequireAnyPermission(
    'notifications:read',
    'communication:read',
    'communication:manage',
  )
  archiveNotification(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.notifications.archive(user, id);
  }

  @Post('notifications/read-all')
  @RequireAnyPermission(
    'notifications:read',
    'communication:read',
    'communication:manage',
  )
  markAllRead(@CurrentUser() user: JwtUser) {
    return this.notifications.markAllRead(user);
  }

  @Get('notifications/preferences')
  @RequireAnyPermission(
    'notifications:read',
    'communication:read',
    'communication:manage',
  )
  getPreferences(@CurrentUser() user: JwtUser) {
    return this.notifications.getPreferences(user);
  }

  @Post('notifications/preferences')
  @RequireAnyPermission(
    'notifications:read',
    'communication:read',
    'communication:manage',
  )
  upsertPreference(
    @CurrentUser() user: JwtUser,
    @Body() dto: NotificationPreferenceDto,
  ) {
    return this.notifications.upsertPreference(
      user,
      dto.channel,
      dto.enabled,
      dto.settings,
    );
  }
}
