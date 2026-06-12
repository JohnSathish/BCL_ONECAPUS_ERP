import { Module } from '@nestjs/common';
import { ShiftScopeService } from '../../common/services/shift-scope.service';
import { FacultyShiftsController } from './faculty-shifts.controller';
import { FacultyShiftsService } from './faculty-shifts.service';

@Module({
  controllers: [FacultyShiftsController],
  providers: [FacultyShiftsService, ShiftScopeService],
  exports: [FacultyShiftsService],
})
export class FacultyShiftsModule {}
