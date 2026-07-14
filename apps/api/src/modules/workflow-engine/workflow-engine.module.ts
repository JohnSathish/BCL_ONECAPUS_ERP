import { Module } from '@nestjs/common';
import { LicensingModule } from '../licensing/licensing.module';
import { WorkflowEngineService } from './services/workflow-engine.service';
import { WorkflowEngineController } from './workflow-engine.controller';

@Module({
  imports: [LicensingModule],
  controllers: [WorkflowEngineController],
  providers: [WorkflowEngineService],
  exports: [WorkflowEngineService],
})
export class WorkflowEngineModule {}
