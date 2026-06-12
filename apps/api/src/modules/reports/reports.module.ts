import { Module } from '@nestjs/common';
import { ShiftsModule } from '../shifts/shifts.module';
import { ReportsController } from './reports.controller';

@Module({
  imports: [ShiftsModule],
  controllers: [ReportsController],
})
export class ReportsModule {}
