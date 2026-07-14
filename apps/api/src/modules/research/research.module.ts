import { Module } from '@nestjs/common';
import { LicensingModule } from '../licensing/licensing.module';
import { ResearchController } from './research.controller';
import { ResearchService } from './services/research.service';

@Module({
  imports: [LicensingModule],
  controllers: [ResearchController],
  providers: [ResearchService],
  exports: [ResearchService],
})
export class ResearchModule {}
