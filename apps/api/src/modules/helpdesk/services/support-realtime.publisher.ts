import { Injectable, Logger } from '@nestjs/common';
import { Optional } from '@nestjs/common';
import { RealtimeGateway } from '../../realtime/realtime.gateway';

@Injectable()
export class SupportRealtimePublisher {
  private readonly logger = new Logger(SupportRealtimePublisher.name);

  constructor(@Optional() private readonly realtime?: RealtimeGateway) {}

  threadRoom(threadId: string) {
    return `support:thread:${threadId}`;
  }

  emitToThread(threadId: string, event: string, payload: unknown) {
    try {
      this.realtime?.broadcastToRoom(this.threadRoom(threadId), event, payload);
    } catch (err) {
      this.logger.warn(`emit thread failed: ${String(err)}`);
    }
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    try {
      this.realtime?.notifyUser(userId, event, payload);
    } catch (err) {
      this.logger.warn(`emit user failed: ${String(err)}`);
    }
  }

  emitToTenant(tenantId: string, event: string, payload: unknown) {
    try {
      this.realtime?.broadcastToTenant(tenantId, event, payload);
    } catch (err) {
      this.logger.warn(`emit tenant failed: ${String(err)}`);
    }
  }
}
