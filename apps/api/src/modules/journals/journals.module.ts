import { Module } from '@nestjs/common';
import { CryptoModule } from '../../common/crypto/crypto.module';
import { AdministrationModule } from '../administration/administration.module';
import { AuthModule } from '../auth/auth.module';
import { CommunicationModule } from '../communication/communication.module';
import { LicensingModule } from '../licensing/licensing.module';
import { TenantsModule } from '../tenants/tenants.module';
import { JournalsAuthorController } from './journals-author.controller';
import { JournalsController } from './journals.controller';
import { JournalsPortalAuthController } from './journals-portal-auth.controller';
import { JournalsPortalController } from './journals-portal.controller';
import { JournalsReviewerController } from './journals-reviewer.controller';
import { JournalAuthService } from './services/journal-auth.service';
import { JournalCitationService } from './services/journal-citation.service';
import { JournalContentService } from './services/journal-content.service';
import { JournalDiscoveryService } from './services/journal-discovery.service';
import { JournalDoiService } from './services/journal-doi.service';
import { JournalEditorialService } from './services/journal-editorial.service';
import { JournalFilesService } from './services/journal-files.service';
import { JournalNotificationService } from './services/journal-notification.service';
import { JournalPlagiarismService } from './services/journal-plagiarism.service';
import { JournalProductionService } from './services/journal-production.service';
import { JournalResolutionService } from './services/journal-resolution.service';
import { JournalReviewService } from './services/journal-review.service';
import { JournalSubmissionService } from './services/journal-submission.service';
import { JournalsService } from './services/journals.service';
import { StorageModule } from '../../shared/storage/storage.module';

@Module({
  imports: [
    LicensingModule,
    TenantsModule,
    AuthModule,
    AdministrationModule,
    CommunicationModule,
    CryptoModule,
    StorageModule,
  ],
  controllers: [
    JournalsPortalController,
    JournalsPortalAuthController,
    JournalsAuthorController,
    JournalsReviewerController,
    JournalsController,
  ],
  providers: [
    JournalResolutionService,
    JournalsService,
    JournalContentService,
    JournalAuthService,
    JournalFilesService,
    JournalSubmissionService,
    JournalReviewService,
    JournalEditorialService,
    JournalProductionService,
    JournalCitationService,
    JournalDoiService,
    JournalPlagiarismService,
    JournalNotificationService,
    JournalDiscoveryService,
  ],
  exports: [
    JournalsService,
    JournalContentService,
    JournalResolutionService,
    JournalAuthService,
    JournalSubmissionService,
  ],
})
export class JournalsModule {}
