import { Module } from '@nestjs/common';
import { CryptoModule } from '../../common/crypto/crypto.module';
import { PrismaModule } from '../../database/prisma.module';
import { CommunicationModule } from '../communication/communication.module';
import { PrincipalCommsController } from './principal-comms.controller';
import { PrincipalCommsAuditService } from './services/principal-comms-audit.service';
import { PrincipalCommsAuthService } from './services/principal-comms-auth.service';
import { PrincipalCommsComposeService } from './services/principal-comms-compose.service';
import { PrincipalCommsGmailClient } from './services/principal-comms-gmail.client';
import { PrincipalCommsMailboxService } from './services/principal-comms-mailbox.service';
import { PrincipalCommsNotifyService } from './services/principal-comms-notify.service';
import { PrincipalCommsSchedulerService } from './services/principal-comms-scheduler.service';
import { PrincipalCommsSyncService } from './services/principal-comms-sync.service';
import { PrincipalCommsTokenVault } from './services/principal-comms-token-vault.service';

@Module({
  imports: [PrismaModule, CryptoModule, CommunicationModule],
  controllers: [PrincipalCommsController],
  providers: [
    PrincipalCommsTokenVault,
    PrincipalCommsGmailClient,
    PrincipalCommsAuditService,
    PrincipalCommsAuthService,
    PrincipalCommsSyncService,
    PrincipalCommsMailboxService,
    PrincipalCommsComposeService,
    PrincipalCommsNotifyService,
    PrincipalCommsSchedulerService,
  ],
  exports: [PrincipalCommsMailboxService],
})
export class PrincipalCommsModule {}
