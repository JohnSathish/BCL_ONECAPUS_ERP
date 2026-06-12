import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
import { CommunicationCampaignsService } from './services/communication-campaigns.service';
import { CommunicationTemplatesService } from './services/communication-templates.service';
import { UserNotificationsService } from './services/user-notifications.service';

@ApiBearerAuth()
@ApiTags('communication')
@Controller({ path: 'communication', version: '1' })
export class CommunicationController {
  constructor(
    private readonly templates: CommunicationTemplatesService,
    private readonly campaigns: CommunicationCampaignsService,
    private readonly notifications: UserNotificationsService,
  ) {}

  @Get('dashboard')
  @RequireAnyPermission('communication:read', 'communication:manage')
  dashboard(@CurrentUser() user: JwtUser) {
    return this.campaigns.dashboard(user.tid);
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

  @Get('notifications')
  @RequireAnyPermission(
    'notifications:read',
    'communication:read',
    'communication:manage',
  )
  listNotifications(
    @CurrentUser() user: JwtUser,
    @Query('limit') limit?: string,
  ) {
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
