import { Module } from '@nestjs/common';
import { LicensingModule } from '../licensing/licensing.module';
import { PaymentGatewayModule } from '../payment-gateway/payment-gateway.module';
import { TenantsModule } from '../tenants/tenants.module';
import { AlumniController } from './alumni.controller';
import { AlumniPortalController } from './alumni-portal.controller';
import { AlumniDocumentsService } from './services/alumni-documents.service';
import { AlumniPaymentService } from './services/alumni-payment.service';
import { AlumniService } from './services/alumni.service';

@Module({
  imports: [LicensingModule, TenantsModule, PaymentGatewayModule],
  controllers: [AlumniPortalController, AlumniController],
  providers: [AlumniService, AlumniPaymentService, AlumniDocumentsService],
  exports: [AlumniService, AlumniPaymentService, AlumniDocumentsService],
})
export class AlumniModule {}
