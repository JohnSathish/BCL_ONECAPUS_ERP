import { Injectable, Logger, Optional } from '@nestjs/common';
import { RealtimeGateway } from '../../realtime/realtime.gateway';

@Injectable()
export class CompetitionRealtimePublisher {
  private readonly logger = new Logger(CompetitionRealtimePublisher.name);

  constructor(@Optional() private readonly realtime?: RealtimeGateway) {}

  publish(
    tenantId: string,
    event:
      | 'competition:leaderboard'
      | 'competition:result'
      | 'competition:medals'
      | 'competition:announcement',
    payload: Record<string, unknown>,
  ) {
    try {
      this.realtime?.broadcastToTenant(tenantId, event, payload);
    } catch (error) {
      this.logger.warn(
        `Realtime publish skipped (${event}): ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }
}
