import { Module, forwardRef } from '@nestjs/common';
import { CommunicationModule } from '../communication/communication.module';
import { LicensingModule } from '../licensing/licensing.module';
import { ApprovalWorkflowService } from './services/approval-workflow.service';
import { WorkflowEngineService } from './services/workflow-engine.service';
import { WorkflowEngineController } from './workflow-engine.controller';

@Module({
  imports: [LicensingModule, forwardRef(() => CommunicationModule)],
  controllers: [WorkflowEngineController],
  providers: [WorkflowEngineService, ApprovalWorkflowService],
  exports: [WorkflowEngineService, ApprovalWorkflowService],
})
export class WorkflowEngineModule {}
