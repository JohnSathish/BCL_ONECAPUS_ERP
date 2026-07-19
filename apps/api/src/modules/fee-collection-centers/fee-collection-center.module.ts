import { Module } from '@nestjs/common';
import { FeesModule } from '../fees/fees.module';
import { FeeCollectionCenterController } from './fee-collection-center.controller';
import { FeeCollectionCenterService } from './fee-collection-center.service';

@Module({
  imports: [FeesModule],
  controllers: [FeeCollectionCenterController],
  providers: [FeeCollectionCenterService],
  exports: [FeeCollectionCenterService],
})
export class FeeCollectionCentersModule {}
