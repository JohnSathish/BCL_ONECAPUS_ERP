import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private client: IORedis | null = null;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('REDIS_URL');
    this.enabled = Boolean(url);
    if (url) {
      this.client = new IORedis(url, {
        maxRetriesPerRequest: 1,
        connectTimeout: 1500,
        commandTimeout: 1500,
        lazyConnect: true,
        enableOfflineQueue: false,
        retryStrategy: () => null,
      });
      this.client.on('error', () => {
        /* fail soft — callers treat cache miss as DB fallback */
      });
    }
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }

  private redis() {
    return this.client;
  }

  async get<T>(key: string): Promise<T | null> {
    const r = this.redis();
    if (!r) return null;
    try {
      const raw = await r.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number) {
    const r = this.redis();
    if (!r) return;
    try {
      await r.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // cache miss on failure
    }
  }

  async del(key: string) {
    const r = this.redis();
    if (!r) return;
    try {
      await r.del(key);
    } catch {
      // ignore
    }
  }

  async delByPrefix(prefix: string) {
    const r = this.redis();
    if (!r) return;
    try {
      let cursor = '0';
      do {
        const [next, keys] = await r.scan(
          cursor,
          'MATCH',
          `${prefix}*`,
          'COUNT',
          100,
        );
        cursor = next;
        if (keys.length) await r.del(...keys);
      } while (cursor !== '0');
    } catch {
      // ignore
    }
  }

  async wrap<T>(
    key: string,
    ttlSeconds: number,
    factory: () => Promise<T>,
  ): Promise<T> {
    try {
      const cached = await Promise.race([
        this.get<T>(key),
        new Promise<null>((resolve) => {
          setTimeout(() => resolve(null), 2000);
        }),
      ]);
      if (cached != null) return cached;
    } catch {
      // treat as miss
    }
    const value = await factory();
    void this.set(key, value, ttlSeconds);
    return value;
  }

  isEnabled() {
    return this.enabled;
  }

  /** Health stats only — never returns the Redis URL or credentials. */
  async healthStats() {
    const r = this.redis();
    if (!r) {
      return {
        enabled: this.enabled,
        connected: false,
        keys: 0,
        memoryBytes: 0,
        hits: 0,
        misses: 0,
        hitRate: 0,
      };
    }
    try {
      const pong = await r.ping();
      const [info, keys] = await Promise.all([r.info(), r.dbsize()]);
      const memoryBytes = Number(/used_memory:(\d+)/.exec(info)?.[1] ?? 0);
      const hits = Number(/keyspace_hits:(\d+)/.exec(info)?.[1] ?? 0);
      const misses = Number(/keyspace_misses:(\d+)/.exec(info)?.[1] ?? 0);
      const total = hits + misses;
      return {
        enabled: true,
        connected: pong === 'PONG',
        keys,
        memoryBytes,
        hits,
        misses,
        hitRate: total ? Math.round((hits / total) * 1000) / 10 : 0,
      };
    } catch {
      return {
        enabled: this.enabled,
        connected: false,
        keys: 0,
        memoryBytes: 0,
        hits: 0,
        misses: 0,
        hitRate: 0,
      };
    }
  }
}
