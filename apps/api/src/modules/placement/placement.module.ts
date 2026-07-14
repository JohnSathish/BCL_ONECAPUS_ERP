import { Module } from '@nestjs/common';
import { LicensingModule } from '../licensing/licensing.module';
import { PlacementController } from './placement.controller';
import { PlacementService } from './services/placement.service';

@Module({
  imports: [LicensingModule],
  controllers: [PlacementController],
  providers: [PlacementService],
  exports: [PlacementService],
})
export class PlacementModule {}
