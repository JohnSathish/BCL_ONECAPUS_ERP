import { Injectable } from '@nestjs/common';

const startedAt = Date.now();
const MAX = 800;
const samples: Array<{
  at: number;
  ms: number;
  status: number;
  path: string;
}> = [];

@Injectable()
export class SchoolSisOpsMetrics {
  startedAt() {
    return startedAt;
  }

  record(path: string, status: number, ms: number) {
    samples.push({ at: Date.now(), ms, status, path });
    if (samples.length > MAX) samples.splice(0, samples.length - MAX);
  }

  snapshot() {
    const recent = samples.filter((s) => Date.now() - s.at < 15 * 60_000);
    const count = recent.length;
    const avg = count
      ? Math.round(recent.reduce((a, s) => a + s.ms, 0) / count)
      : 0;
    const errors = recent.filter((s) => s.status >= 500).length;
    const slow = recent.filter((s) => s.ms >= 800).length;
    const byStatus: Record<string, number> = {};
    for (const s of recent) {
      const k = String(Math.floor(s.status / 100) * 100);
      byStatus[k] = (byStatus[k] ?? 0) + 1;
    }
    const slowApis = [...recent]
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 8)
      .map((s) => ({ path: s.path, ms: s.ms, status: s.status }));
    return {
      requestCount: count,
      averageMs: avg,
      errorRate: count ? Math.round((errors / count) * 1000) / 10 : 0,
      slowCount: slow,
      byStatus,
      slowApis,
    };
  }
}
