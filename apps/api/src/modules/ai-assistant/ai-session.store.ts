import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CacheService } from '../../shared/cache/cache.service';
import type { AiPendingIntent, AiSessionState } from './ai-assistant.types';

const TTL_SECONDS = 45 * 60;

@Injectable()
export class AiSessionStore {
  constructor(private readonly cache: CacheService) {}

  private key(tenantId: string, userId: string, sessionId: string) {
    return `ai:session:${tenantId}:${userId}:${sessionId}`;
  }

  async getOrCreate(
    tenantId: string,
    userId: string,
    sessionId?: string,
  ): Promise<{ sessionId: string; state: AiSessionState }> {
    const id = sessionId?.trim() || randomUUID();
    const existing = await this.cache.get<AiSessionState>(
      this.key(tenantId, userId, id),
    );
    if (existing) return { sessionId: id, state: existing };
    const state: AiSessionState = {
      turns: [],
      pendingIntent: null,
      updatedAt: new Date().toISOString(),
    };
    await this.save(tenantId, userId, id, state);
    return { sessionId: id, state };
  }

  async save(
    tenantId: string,
    userId: string,
    sessionId: string,
    state: AiSessionState,
  ) {
    const next: AiSessionState = {
      ...state,
      turns: state.turns.slice(-20),
      updatedAt: new Date().toISOString(),
    };
    await this.cache.set(
      this.key(tenantId, userId, sessionId),
      next,
      TTL_SECONDS,
    );
  }

  async setPending(
    tenantId: string,
    userId: string,
    sessionId: string,
    state: AiSessionState,
    pending: AiPendingIntent | null,
  ) {
    await this.save(tenantId, userId, sessionId, {
      ...state,
      pendingIntent: pending,
    });
  }
}
