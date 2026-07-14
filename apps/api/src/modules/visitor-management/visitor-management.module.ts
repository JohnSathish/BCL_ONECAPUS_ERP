import { Module } from '@nestjs/common';
import { LicensingModule } from '../licensing/licensing.module';
import { VisitorManagementService } from './services/visitor-management.service';
import { VisitorManagementController } from './visitor-management.controller';

@Module({
  imports: [LicensingModule],
  controllers: [VisitorManagementController],
  providers: [VisitorManagementService],
  exports: [VisitorManagementService],
})
export class VisitorManagementModule {}
