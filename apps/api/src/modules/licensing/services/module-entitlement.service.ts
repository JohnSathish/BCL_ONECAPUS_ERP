import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  MODULE_CATALOG,
  MODULE_CATALOG_BY_KEY,
  type ModuleCatalogEntry,
} from '../module-catalog';

@Injectable()
export class ModuleEntitlementService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  private async hasTenantLicense(tenantId: string): Promise<boolean> {
    const license = await this.db().tenantLicense.findFirst({
      where: { tenantId },
      select: { id: true },
    });
    return Boolean(license);
  }

  /** Ensure every catalog key has a row; seed missing with catalog.defaultEnabled. */
  async listForTenant(tenantId: string) {
    const existing: Array<{
      moduleKey: string;
      enabled: boolean;
      limits: unknown;
      enabledAt: Date | null;
      disabledAt: Date | null;
      updatedAt: Date;
    }> = await this.db().tenantModuleEntitlement.findMany({
      where: { tenantId },
    });
    const byKey = new Map(existing.map((r) => [r.moduleKey, r]));
    const canSeed = await this.hasTenantLicense(tenantId);

    const missing = MODULE_CATALOG.filter((c) => !byKey.has(c.key));
    if (canSeed && missing.length) {
      const now = new Date();
      await this.db().tenantModuleEntitlement.createMany({
        data: missing.map((c) => ({
          tenantId,
          moduleKey: c.key,
          enabled: c.defaultEnabled,
          limits: {},
          enabledAt: c.defaultEnabled ? now : null,
          disabledAt: c.defaultEnabled ? null : now,
        })),
        skipDuplicates: true,
      });
      const refreshed = await this.db().tenantModuleEntitlement.findMany({
        where: { tenantId },
      });
      for (const r of refreshed) byKey.set(r.moduleKey, r);
    }

    return MODULE_CATALOG.map((catalog) => {
      const row = byKey.get(catalog.key);
      const enabled = row
        ? Boolean(row.enabled)
        : catalog.category === 'core'
          ? true
          : catalog.defaultEnabled;
      const isEnabled = catalog.category === 'core' ? true : enabled;
      return {
        key: catalog.key,
        moduleKey: catalog.key,
        label: catalog.label,
        description: catalog.description,
        category: catalog.category,
        core: catalog.category === 'core',
        enabled: isEnabled,
        limits: (row?.limits as Record<string, unknown>) ?? {},
        enabledAt: row?.enabledAt ?? null,
        disabledAt: row?.disabledAt ?? null,
        updatedAt: row?.updatedAt ?? null,
      };
    });
  }

  async listEnabledKeys(tenantId: string): Promise<string[]> {
    const all = await this.listForTenant(tenantId);
    return all.filter((m) => m.enabled).map((m) => m.key);
  }

  async isEnabled(tenantId: string, moduleKey: string): Promise<boolean> {
    const catalog = MODULE_CATALOG_BY_KEY[moduleKey];
    if (!catalog) return false;
    if (catalog.category === 'core') return true;

    let row = await this.db().tenantModuleEntitlement.findUnique({
      where: {
        tenantId_moduleKey: { tenantId, moduleKey },
      },
    });

    if (!row) {
      const canSeed = await this.hasTenantLicense(tenantId);
      if (canSeed) {
        const now = new Date();
        row = await this.db().tenantModuleEntitlement.create({
          data: {
            tenantId,
            moduleKey,
            enabled: catalog.defaultEnabled,
            limits: {},
            enabledAt: catalog.defaultEnabled ? now : null,
            disabledAt: catalog.defaultEnabled ? null : now,
          },
        });
      } else {
        return catalog.defaultEnabled;
      }
    }

    return Boolean(row.enabled);
  }

  async assertEnabled(tenantId: string, moduleKey: string): Promise<void> {
    const ok = await this.isEnabled(tenantId, moduleKey);
    if (!ok) {
      const label = MODULE_CATALOG_BY_KEY[moduleKey]?.label ?? moduleKey;
      throw new ForbiddenException(
        `Module "${label}" is not enabled for this tenant`,
      );
    }
  }

  async setEnabled(
    tenantId: string,
    moduleKey: string,
    enabled: boolean,
    opts: { limits?: Record<string, unknown>; updatedById?: string } = {},
  ) {
    const catalog: ModuleCatalogEntry | undefined =
      MODULE_CATALOG_BY_KEY[moduleKey];
    if (!catalog) {
      throw new NotFoundException(`Unknown module key: ${moduleKey}`);
    }
    if (catalog.category === 'core' && !enabled) {
      throw new ForbiddenException(
        `Core module "${catalog.label}" cannot be disabled`,
      );
    }

    const canSeed = await this.hasTenantLicense(tenantId);
    if (!canSeed) {
      throw new ForbiddenException(
        'Tenant license required to update module entitlements',
      );
    }

    const now = new Date();
    return this.db().tenantModuleEntitlement.upsert({
      where: {
        tenantId_moduleKey: { tenantId, moduleKey },
      },
      create: {
        tenantId,
        moduleKey,
        enabled,
        limits: opts.limits ?? {},
        updatedById: opts.updatedById,
        enabledAt: enabled ? now : null,
        disabledAt: enabled ? null : now,
      },
      update: {
        enabled,
        ...(opts.limits !== undefined ? { limits: opts.limits } : {}),
        updatedById: opts.updatedById,
        enabledAt: enabled ? now : undefined,
        disabledAt: enabled ? null : now,
      },
    });
  }
}
