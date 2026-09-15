import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SchoolSisAutomationService } from './school-sis-automation.service';
import type { SchoolErpEvent } from './school-sis-event-bus.service';

@Processor('school-automation', {
  lockDuration: 180_000,
  limiter: { max: 40, duration: 60_000 },
})
export class SchoolSisAutomationProcessor extends WorkerHost {
  private readonly logger = new Logger(SchoolSisAutomationProcessor.name);
  constructor(private readonly auto: SchoolSisAutomationService) {
    super();
  }

  async process(
    job: Job<
      SchoolErpEvent & {
        tenantId: string;
        executionId?: string;
        nodeId?: string;
        ctx?: Record<string, unknown>;
      }
    >,
  ) {
    try {
      if (job.name === 'tick') return this.auto.tick();
      if (job.name === 'event') return this.auto.handleEvent(job.data);
      if (job.name === 'execute' && job.data.executionId) {
        return this.auto.processExecution(
          job.data.tenantId,
          job.data.executionId,
        );
      }
      if (job.name === 'continue' && job.data.executionId && job.data.nodeId) {
        return this.auto.continueFrom(
          job.data.tenantId,
          job.data.executionId,
          job.data.nodeId,
          job.data.ctx ?? {},
        );
      }
      this.logger.warn(`Unknown school-automation job ${job.name}`);
    } catch (err) {
      this.logger.error(err);
      throw err;
    }
  }
}
