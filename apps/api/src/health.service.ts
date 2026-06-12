import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import { PrismaService } from './database/prisma.service';

const startedAt = Date.now();

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  live() {
    return { status: 'ok', ts: new Date().toISOString() };
  }

  async ready() {
    const uptimeSec = Math.floor((Date.now() - startedAt) / 1000);
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const ok = database.status === 'ok' && redis.status === 'ok';

    return {
      status: ok ? 'ready' : 'degraded',
      api: 'ok',
      database,
      redis,
      queue:
        redis.status === 'ok' ? { status: 'ok' } : { status: 'unavailable' },
      uptime: { seconds: uptimeSec },
      ts: new Date().toISOString(),
    };
  }

  private async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' as const };
    } catch (err) {
      return {
        status: 'error' as const,
        message: err instanceof Error ? err.message : 'Database unreachable',
      };
    }
  }

  private async checkRedis() {
    const url = this.config.get<string>('REDIS_URL', 'redis://127.0.0.1:6379');
    let client: IORedis | null = null;
    try {
      client = new IORedis(url, {
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
        lazyConnect: true,
      });
      await client.connect();
      const pong = await client.ping();
      return pong === 'PONG'
        ? { status: 'ok' as const }
        : { status: 'error' as const, message: 'Unexpected Redis response' };
    } catch (err) {
      return {
        status: 'error' as const,
        message: err instanceof Error ? err.message : 'Redis unreachable',
      };
    } finally {
      if (client) {
        try {
          client.disconnect();
        } catch {
          /* ignore */
        }
      }
    }
  }
}
