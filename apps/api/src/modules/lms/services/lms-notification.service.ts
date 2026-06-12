import { Injectable } from '@nestjs/common';
import { QueueService } from '../../../shared/queue/queue.service';

@Injectable()
export class LmsNotificationService {
  constructor(private readonly queue: QueueService) {}

  notify(input: {
    tenantId: string;
    type: string;
    title: string;
    body: string;
    userIds?: string[];
    workspaceId?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.queue.enqueueNotification({
      channel: 'in_app',
      tenantId: input.tenantId,
      type: input.type,
      title: input.title,
      body: input.body,
      userIds: input.userIds ?? [],
      workspaceId: input.workspaceId,
      metadata: {
        ...input.metadata,
        email: false,
        sms: false,
        whatsapp: false,
      },
    });
  }
}
