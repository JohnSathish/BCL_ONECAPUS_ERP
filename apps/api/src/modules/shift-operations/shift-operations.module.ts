import { Module } from '@nestjs/common';
import { ShiftScopeService } from '../../common/services/shift-scope.service';
import { ShiftOperationsController } from './shift-operations.controller';
import { ShiftOperationsService } from './shift-operations.service';

@Module({
  controllers: [ShiftOperationsController],
  providers: [ShiftOperationsService, ShiftScopeService],
})
export class ShiftOperationsModule {}
