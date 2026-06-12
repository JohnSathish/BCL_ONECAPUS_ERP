import { Module } from '@nestjs/common';

import { CommunicationModule } from '../communication/communication.module';

import { RealtimeModule } from '../realtime/realtime.module';

import { LibraryController } from './library.controller';

import { LibraryAccessService } from './services/library-access.service';

import { LibraryAnalyticsService } from './services/library-analytics.service';

import { LibraryAssetsService } from './services/library-assets.service';

import { LibraryCatalogueService } from './services/library-catalogue.service';

import { LibraryCirculationService } from './services/library-circulation.service';

import { LibraryDigitalAssetsService } from './services/library-digital-assets.service';

import { LibraryFinesService } from './services/library-fines.service';

import { LibraryMemberLookupService } from './services/library-member-lookup.service';

import { LibraryNotificationsService } from './services/library-notifications.service';

import { LibraryQuestionBankBridgeService } from './services/library-question-bank-bridge.service';

import { LibraryQrService } from './services/library-qr.service';

import { LibraryReportsService } from './services/library-reports.service';

import { LibraryReservationService } from './services/library-reservation.service';

import { LibrarySchedulerService } from './services/library-scheduler.service';

import { LibrarySearchService } from './services/library-search.service';

import { LibrarySettingsService } from './services/library-settings.service';

import { LibraryVisitorService } from './services/library-visitor.service';

import { LibraryZonesService } from './services/library-zones.service';

import { ResearchRepositoryService } from './services/research-repository.service';

@Module({
  imports: [RealtimeModule, CommunicationModule],

  controllers: [LibraryController],

  providers: [
    LibrarySettingsService,

    LibraryAssetsService,

    LibraryQrService,

    LibraryMemberLookupService,

    LibraryZonesService,

    LibraryAccessService,

    LibraryVisitorService,

    LibraryAnalyticsService,

    LibraryCatalogueService,

    LibraryFinesService,

    LibraryCirculationService,

    LibraryReservationService,

    LibraryReportsService,

    LibraryDigitalAssetsService,

    ResearchRepositoryService,

    LibraryQuestionBankBridgeService,

    LibrarySearchService,

    LibraryNotificationsService,

    LibrarySchedulerService,
  ],

  exports: [
    LibraryAccessService,
    LibraryCatalogueService,
    LibraryDigitalAssetsService,
    LibraryQrService,
  ],
})
export class LibraryModule {}
