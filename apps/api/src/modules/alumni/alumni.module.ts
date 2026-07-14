import { Module } from '@nestjs/common';
import { LicensingModule } from '../licensing/licensing.module';
import { AlumniController } from './alumni.controller';
import { AlumniService } from './services/alumni.service';

@Module({
  imports: [LicensingModule],
  controllers: [AlumniController],
  providers: [AlumniService],
  exports: [AlumniService],
})
export class AlumniModule {}
