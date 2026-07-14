import { Module } from '@nestjs/common';
import { LicensingModule } from '../licensing/licensing.module';
import { HelpdeskController } from './helpdesk.controller';
import { HelpdeskService } from './services/helpdesk.service';

@Module({
  imports: [LicensingModule],
  controllers: [HelpdeskController],
  providers: [HelpdeskService],
  exports: [HelpdeskService],
})
export class HelpdeskModule {}
