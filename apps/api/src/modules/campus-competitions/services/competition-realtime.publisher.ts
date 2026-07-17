import { Injectable, Logger, Optional } from '@nestjs/common';
import { RealtimeGateway } from '../../realtime/realtime.gateway';

export type CompetitionRealtimeEvent =
  | 'competition:leaderboard'
  | 'competition:result'
  | 'competition:medals'
  | 'competition:announcement'
  | 'competition:live-event';

@Injectable()
export class CompetitionRealtimePublisher {
  private readonly logger = new Logger(CompetitionRealtimePublisher.name);

  constructor(@Optional() private readonly realtime?: RealtimeGateway) {}

  publish(
    tenantId: string,
    event: CompetitionRealtimeEvent,
    payload: Record<string, unknown>,
  ) {
    try {
      this.realtime?.broadcastToTenant(tenantId, event, payload);
      const meetId = payload.meetId;
      if (typeof meetId === 'string' && meetId.length > 0) {
        this.realtime?.broadcastToRoom(`meet:${meetId}`, event, payload);
      }
    } catch (error) {
      this.logger.warn(
        `Realtime publish skipped (${event}): ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }
}
