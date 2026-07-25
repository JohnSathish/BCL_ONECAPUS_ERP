import { Module } from '@nestjs/common';
import { AcademicCalendarController } from './academic-calendar.controller';
import { AcademicCalendarService } from './academic-calendar.service';
import { WorkingDayEngineService } from './working-day-engine.service';

@Module({
  controllers: [AcademicCalendarController],
  providers: [AcademicCalendarService, WorkingDayEngineService],
  exports: [AcademicCalendarService, WorkingDayEngineService],
})
export class AcademicCalendarModule {}
