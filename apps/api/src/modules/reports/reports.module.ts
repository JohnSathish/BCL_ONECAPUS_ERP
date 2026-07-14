import { Module } from '@nestjs/common';
import { ShiftsModule } from '../shifts/shifts.module';
import { ReportsController } from './reports.controller';
import { ShiftReportsService } from './shift-reports.service';

@Module({
  imports: [ShiftsModule],
  controllers: [ReportsController],
  providers: [ShiftReportsService],
})
export class ReportsModule {}
