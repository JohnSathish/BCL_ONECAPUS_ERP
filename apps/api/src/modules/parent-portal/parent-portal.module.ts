import { Module } from '@nestjs/common';
import { LicensingModule } from '../licensing/licensing.module';
import { ParentPortalController } from './parent-portal.controller';
import { ParentPortalService } from './services/parent-portal.service';

@Module({
  imports: [LicensingModule],
  controllers: [ParentPortalController],
  providers: [ParentPortalService],
  exports: [ParentPortalService],
})
export class ParentPortalModule {}
