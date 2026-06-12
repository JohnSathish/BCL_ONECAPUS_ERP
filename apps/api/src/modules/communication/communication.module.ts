import { Module } from '@nestjs/common';
import { CommunicationController } from './communication.controller';
import { CommunicationAudienceService } from './services/communication-audience.service';
import { CommunicationCampaignsService } from './services/communication-campaigns.service';
import { CommunicationDeliveryService } from './services/communication-delivery.service';
import { CommunicationEmailService } from './services/communication-email.service';
import { CommunicationSchedulerService } from './services/communication-scheduler.service';
import { CommunicationTemplateRendererService } from './services/communication-template-renderer.service';
import { CommunicationTemplatesService } from './services/communication-templates.service';
import { CommunicationTriggerService } from './services/communication-trigger.service';
import { UserNotificationsService } from './services/user-notifications.service';
import { CommunicationNotificationProcessor } from './processors/communication-notification.processor';

@Module({
  controllers: [CommunicationController],
  providers: [
    CommunicationTemplatesService,
    CommunicationCampaignsService,
    CommunicationAudienceService,
    CommunicationDeliveryService,
    CommunicationEmailService,
    CommunicationTemplateRendererService,
    CommunicationTriggerService,
    CommunicationSchedulerService,
    UserNotificationsService,
    CommunicationNotificationProcessor,
  ],
  exports: [
    CommunicationDeliveryService,
    CommunicationTriggerService,
    UserNotificationsService,
    CommunicationEmailService,
  ],
})
export class CommunicationModule {}
