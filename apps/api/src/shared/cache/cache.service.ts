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
        maxRetriesPerRequest: 2,
        lazyConnect: true,
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
    const cached = await this.get<T>(key);
    if (cached != null) return cached;
    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  isEnabled() {
    return this.enabled;
  }
}
