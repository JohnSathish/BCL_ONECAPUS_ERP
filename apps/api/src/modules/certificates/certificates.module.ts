import { Module } from '@nestjs/common';
import { AdministrationModule } from '../administration/administration.module';
import { CommunicationModule } from '../communication/communication.module';
import { CertificatesController } from './certificates.controller';
import { CertificatesService } from './certificates.service';
import { CertificateVariableService } from './certificate-variable.service';
import { CertificateDocumentService } from './certificate-document.service';
import { CertificateAssetsService } from './certificate-assets.service';

@Module({
  imports: [AdministrationModule, CommunicationModule],
  controllers: [CertificatesController],
  providers: [
    CertificatesService,
    CertificateVariableService,
    CertificateDocumentService,
    CertificateAssetsService,
  ],
  exports: [CertificatesService, CertificateVariableService],
})
export class CertificatesModule {}
