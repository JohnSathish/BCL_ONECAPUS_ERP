import { Module } from '@nestjs/common';
import { CommunicationModule } from '../communication/communication.module';
import { SecurityAlertNotifier } from './security-alert-notifier.service';
import { SecurityCentreController } from './security-centre.controller';
import { SecurityCentreService } from './security-centre.service';
import { SecurityEventRecorder } from './security-event.recorder';
import { SecurityFileIntegrityService } from './security-file-integrity.service';
import { SecurityPolicyService } from './security-policy.service';
import { SecurityThreatService } from './security-threat.service';
import { SuperAdminGuard } from './super-admin.guard';

@Module({
  imports: [CommunicationModule],
  controllers: [SecurityCentreController],
  providers: [
    SuperAdminGuard,
    SecurityPolicyService,
    SecurityAlertNotifier,
    SecurityThreatService,
    SecurityEventRecorder,
    SecurityFileIntegrityService,
    SecurityCentreService,
  ],
  exports: [SecurityEventRecorder, SecurityPolicyService],
})
export class SecurityCentreModule {}
