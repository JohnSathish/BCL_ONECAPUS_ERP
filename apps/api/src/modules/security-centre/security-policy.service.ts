import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  normalizeLoginProtection,
  type LoginProtection,
} from './domain/login-protection';

@Injectable()
export class SecurityPolicyService {
  private readonly cache = new Map<
    string,
    { at: number; value: LoginProtection }
  >();

  constructor(private readonly prisma: PrismaService) {}

  async get(tenantId: string): Promise<LoginProtection> {
    const cached = this.cache.get(tenantId);
    if (cached && Date.now() - cached.at < 60_000) return cached.value;
    try {
      const row = await this.prisma.securityMonitorConfig.findUnique({
        where: { tenantId },
      });
      const value = normalizeLoginProtection(row);
      this.cache.set(tenantId, { at: Date.now(), value });
      return value;
    } catch {
      return normalizeLoginProtection(null);
    }
  }

  async save(
    tenantId: string,
    patch: Partial<LoginProtection>,
  ): Promise<LoginProtection> {
    const current = await this.get(tenantId);
    const next = normalizeLoginProtection({ ...current, ...patch });
    await this.prisma.securityMonitorConfig.upsert({
      where: { tenantId },
      create: { tenantId, ...next },
      update: next,
    });
    this.cache.set(tenantId, { at: Date.now(), value: next });
    return next;
  }

  invalidate(tenantId: string) {
    this.cache.delete(tenantId);
  }
}
