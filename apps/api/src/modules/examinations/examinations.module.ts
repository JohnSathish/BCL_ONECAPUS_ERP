import { Module } from '@nestjs/common';
import { CommunicationModule } from '../communication/communication.module';
import { LicensingModule } from '../licensing/licensing.module';
import { ExaminationsController } from './examinations.controller';
import { ExaminationsService } from './examinations.service';

@Module({
  imports: [CommunicationModule, LicensingModule],
  controllers: [ExaminationsController],
  providers: [ExaminationsService],
  exports: [ExaminationsService],
})
export class ExaminationsModule {}
