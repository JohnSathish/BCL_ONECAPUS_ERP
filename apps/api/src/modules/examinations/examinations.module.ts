import { Module } from '@nestjs/common';
import { CommunicationModule } from '../communication/communication.module';
import { FeesModule } from '../fees/fees.module';
import { LicensingModule } from '../licensing/licensing.module';
import { ExaminationsController } from './examinations.controller';
import { ExaminationsService } from './examinations.service';

@Module({
  imports: [CommunicationModule, LicensingModule, FeesModule],
  controllers: [ExaminationsController],
  providers: [ExaminationsService],
  exports: [ExaminationsService],
})
export class ExaminationsModule {}
