import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

export type SchoolErpEvent = {
  event: string;
  tenantId: string;
  entityType?: string;
  entityId?: string;
  studentId?: string;
  emergency?: boolean;
  data?: Record<string, unknown>;
};

@Injectable()
export class SchoolSisEventBus {
  private readonly logger = new Logger(SchoolSisEventBus.name);
  constructor(
    @InjectQueue('school-automation') private readonly queue: Queue,
  ) {}

  async publish(event: SchoolErpEvent) {
    try {
      await this.queue.add('event', event, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: 200,
        removeOnFail: 200,
      });
    } catch (err) {
      this.logger.error(err);
    }
  }
}
