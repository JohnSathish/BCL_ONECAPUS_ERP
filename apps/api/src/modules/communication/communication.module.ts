import { Module } from '@nestjs/common';
import { CommunicationController } from './communication.controller';
import { CommunicationAnalyticsService } from './services/communication-analytics.service';
import { CommunicationApprovalService } from './services/communication-approval.service';
import { CommunicationAudienceSegmentService } from './services/communication-audience-segment.service';
import { CommunicationAudienceService } from './services/communication-audience.service';
import { CommunicationAutomationService } from './services/communication-automation.service';
import { CommunicationCampaignsService } from './services/communication-campaigns.service';
import { CommunicationDashboardService } from './services/communication-dashboard.service';
import { CommunicationDeliveryService } from './services/communication-delivery.service';
import { CommunicationEmailService } from './services/communication-email.service';
import { CommunicationSmsService } from './services/communication-sms.service';
import { CommunicationSchedulerService } from './services/communication-scheduler.service';
import { CommunicationSettingsService } from './services/communication-settings.service';
import { CommunicationTemplateRendererService } from './services/communication-template-renderer.service';
import { CommunicationTemplatesService } from './services/communication-templates.service';
import { CommunicationTriggerService } from './services/communication-trigger.service';
import { CommunicationWhatsAppService } from './services/communication-whatsapp.service';
import { UserNotificationsService } from './services/user-notifications.service';
import { CommunicationNotificationProcessor } from './processors/communication-notification.processor';
import { FcmPushService } from './services/fcm-push.service';

@Module({
  controllers: [CommunicationController],
  providers: [
    CommunicationTemplatesService,
    CommunicationCampaignsService,
    CommunicationDashboardService,
    CommunicationAnalyticsService,
    CommunicationSettingsService,
    CommunicationApprovalService,
    CommunicationAutomationService,
    CommunicationAudienceSegmentService,
    CommunicationAudienceService,
    CommunicationDeliveryService,
    CommunicationEmailService,
    CommunicationSmsService,
    CommunicationWhatsAppService,
    CommunicationTemplateRendererService,
    CommunicationTriggerService,
    CommunicationSchedulerService,
    UserNotificationsService,
    CommunicationNotificationProcessor,
    FcmPushService,
  ],
  exports: [
    CommunicationDeliveryService,
    CommunicationTriggerService,
    UserNotificationsService,
    CommunicationEmailService,
    CommunicationSmsService,
    CommunicationWhatsAppService,
    FcmPushService,
  ],
})
export class CommunicationModule {}
