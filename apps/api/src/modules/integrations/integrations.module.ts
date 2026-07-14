import { Module } from '@nestjs/common';
import { LicensingModule } from '../licensing/licensing.module';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './services/integrations.service';

@Module({
  imports: [LicensingModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
