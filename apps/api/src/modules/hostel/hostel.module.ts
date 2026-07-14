import { Module } from '@nestjs/common';
import { LicensingModule } from '../licensing/licensing.module';
import { HostelController } from './hostel.controller';
import { HostelService } from './services/hostel.service';

@Module({
  imports: [LicensingModule],
  controllers: [HostelController],
  providers: [HostelService],
  exports: [HostelService],
})
export class HostelModule {}
