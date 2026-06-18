import { Module } from '@nestjs/common';
import { CommunicationModule } from '../communication/communication.module';
import { DemoRequestController } from './demo-request.controller';
import { DemoRequestService } from './demo-request.service';

@Module({
  imports: [CommunicationModule],
  controllers: [DemoRequestController],
  providers: [DemoRequestService],
})
export class MarketingModule {}
