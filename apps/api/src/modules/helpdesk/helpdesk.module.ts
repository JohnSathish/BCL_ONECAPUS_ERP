import { Module } from '@nestjs/common';
import { CommunicationModule } from '../communication/communication.module';
import { LicensingModule } from '../licensing/licensing.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { HelpdeskController } from './helpdesk.controller';
import { StudentSupportController } from './student-support.controller';
import { HelpdeskService } from './services/helpdesk.service';
import { SupportAnalyticsService } from './services/support-analytics.service';
import { SupportAiService } from './services/support-ai.service';
import { SupportChatService } from './services/support-chat.service';
import { SupportFaqService } from './services/support-faq.service';
import { SupportRealtimePublisher } from './services/support-realtime.publisher';
import { SupportRoutingService } from './services/support-routing.service';
import { SupportSettingsService } from './services/support-settings.service';
import { SupportStudentContextService } from './services/support-student-context.service';
import { SupportTicketService } from './services/support-ticket.service';
import { SupportTranslationService } from './services/support-translation.service';

@Module({
  imports: [LicensingModule, RealtimeModule, CommunicationModule],
  controllers: [HelpdeskController, StudentSupportController],
  providers: [
    HelpdeskService,
    SupportSettingsService,
    SupportRoutingService,
    SupportTicketService,
    SupportChatService,
    SupportFaqService,
    SupportAnalyticsService,
    SupportTranslationService,
    SupportRealtimePublisher,
    SupportAiService,
    SupportStudentContextService,
  ],
  exports: [
    HelpdeskService,
    SupportTicketService,
    SupportChatService,
    SupportFaqService,
  ],
})
export class HelpdeskModule {}
