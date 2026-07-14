import { Module } from '@nestjs/common';
import { LicensingModule } from '../licensing/licensing.module';
import { InternshipController } from './internship.controller';
import { InternshipService } from './services/internship.service';

@Module({
  imports: [LicensingModule],
  controllers: [InternshipController],
  providers: [InternshipService],
  exports: [InternshipService],
})
export class InternshipModule {}
