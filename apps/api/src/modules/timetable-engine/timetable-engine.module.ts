import { Module } from '@nestjs/common';
import { StudentAttendanceModule } from '../student-attendance/student-attendance.module';
import { CommunicationModule } from '../communication/communication.module';
import { TimetableConflictService } from './timetable-conflict.service';
import { TimetableAllocationService } from './timetable-allocation.service';
import { TimetableAllocationExcelService } from './timetable-allocation-excel.service';
import { TimetableBulkService } from './timetable-bulk.service';
import { TimetableEngineController } from './timetable-engine.controller';
import { TimetableEngineService } from './timetable-engine.service';
import { TimetableGeneratorService } from './timetable-generator.service';
import { TimetablePrintService } from './timetable-print.service';
import { TimetableReadinessService } from './timetable-readiness.service';
import { TimetableRoutineExcelService } from './timetable-routine-excel.service';
import { TimetableSlotRuleService } from './timetable-slot-rule.service';
import { TimetableStreamMasterService } from './timetable-stream-master.service';
import { TimetableWorkloadService } from './timetable-workload.service';

@Module({
  imports: [StudentAttendanceModule, CommunicationModule],
  controllers: [TimetableEngineController],
  providers: [
    TimetableEngineService,
    TimetableAllocationService,
    TimetableAllocationExcelService,
    TimetableBulkService,
    TimetableRoutineExcelService,
    TimetableGeneratorService,
    TimetableConflictService,
    TimetableWorkloadService,
    TimetablePrintService,
    TimetableStreamMasterService,
    TimetableSlotRuleService,
    TimetableReadinessService,
  ],
  exports: [TimetableEngineService],
})
export class TimetableEngineModule {}
