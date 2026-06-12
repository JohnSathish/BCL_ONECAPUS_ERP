import { Module, forwardRef } from '@nestjs/common';
import { ShiftScopeService } from '../../common/services/shift-scope.service';
import { AdministrationModule } from '../administration/administration.module';
import { ShiftAssignmentsService } from './shift-assignments.service';
import { ShiftsController } from './shifts.controller';
import { ShiftsService } from './shifts.service';

@Module({
  imports: [forwardRef(() => AdministrationModule)],
  controllers: [ShiftsController],
  providers: [ShiftsService, ShiftAssignmentsService, ShiftScopeService],
  exports: [ShiftsService, ShiftAssignmentsService, ShiftScopeService],
})
export class ShiftsModule {}
