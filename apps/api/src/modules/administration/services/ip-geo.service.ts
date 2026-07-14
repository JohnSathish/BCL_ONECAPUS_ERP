import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

export type GeoLookupResult = {
  city: string | null;
  region: string | null;
  country: string | null;
  isp: string | null;
};

const GEO_TTL_MS = 14 * 24 * 60 * 60 * 1000;

@Injectable()
export class IpGeoService {
  private readonly logger = new Logger(IpGeoService.name);

  constructor(private readonly prisma: PrismaService) {}

  hashIp(ip: string): string {
    return createHash('sha256').update(ip.trim().toLowerCase()).digest('hex');
  }

  maskIp(ip: string | null | undefined): string | null {
    if (!ip) return null;
    const v4 = ip.split('.');
    if (v4.length === 4) return `${v4[0]}.xxx.xxx.${v4[3]}`;
    if (ip.includes(':')) {
      const parts = ip.split(':').filter(Boolean);
      return parts.length
        ? `${parts[0]}:xxxx:xxxx:${parts[parts.length - 1]}`
        : 'xxxx';
    }
    return 'xxx';
  }

  async lookup(
    ip: string | null | undefined,
    opts: { enabled?: boolean; countryHint?: string | null } = {},
  ): Promise<GeoLookupResult> {
    const enabled = opts.enabled !== false;
    const hint: GeoLookupResult = {
      city: null,
      region: null,
      country: opts.countryHint ?? null,
      isp: null,
    };
    if (!enabled || !ip || this.isPrivateIp(ip)) return hint;

    const ipHash = this.hashIp(ip);
    const cached = await this.prisma.ipGeoCache.findUnique({
      where: { ipHash },
    });
    if (cached && Date.now() - cached.lookedUpAt.getTime() < GEO_TTL_MS) {
      return {
        city: cached.city,
        region: cached.region,
        country: cached.country ?? hint.country,
        isp: cached.isp,
      };
    }

    try {
      const remote = await this.fetchRemote(ip);
      const merged = {
        city: remote.city,
        region: remote.region,
        country: remote.country ?? hint.country,
        isp: remote.isp,
      };
      await this.prisma.ipGeoCache.upsert({
        where: { ipHash },
        create: {
          ipHash,
          ...merged,
          raw: remote as object,
          lookedUpAt: new Date(),
        },
        update: {
          ...merged,
          raw: remote as object,
          lookedUpAt: new Date(),
        },
      });
      return merged;
    } catch (err) {
      this.logger.debug(
        `GeoIP lookup failed for ${this.maskIp(ip)}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return hint;
    }
  }

  private isPrivateIp(ip: string) {
    return (
      ip === '127.0.0.1' ||
      ip === '::1' ||
      ip.startsWith('10.') ||
      ip.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
    );
  }

  private async fetchRemote(ip: string): Promise<GeoLookupResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    try {
      // ip-api.com free tier — approximate city/region/country/ISP only
      const url = `http://ip-api.com/json/${encodeURIComponent(
        ip,
      )}?fields=status,country,regionName,city,isp`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as {
        status?: string;
        country?: string;
        regionName?: string;
        city?: string;
        isp?: string;
      };
      if (json.status !== 'success') {
        return { city: null, region: null, country: null, isp: null };
      }
      return {
        city: json.city ?? null,
        region: json.regionName ?? null,
        country: json.country ?? null,
        isp: json.isp ?? null,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
