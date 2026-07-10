import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  DEFAULT_PROFILE_UPDATE_POLICIES,
  type ProfileApprovalMode,
} from '../domain/profile-update-policy.defaults';

@Injectable()
export class StudentProfileUpdatePolicyService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  private async fetchFieldPolicies(tenantId: string) {
    return this.db().studentProfileUpdatePolicy.findMany({
      where: {
        tenantId,
        NOT: { sectionKey: '__settings__' },
      },
      orderBy: [
        { sectionKey: 'asc' },
        { sortOrder: 'asc' },
        { fieldKey: 'asc' },
      ],
    });
  }

  async ensureDefaults(tenantId: string) {
    const existing = await this.db().studentProfileUpdatePolicy.count({
      where: {
        tenantId,
        NOT: { sectionKey: '__settings__' },
      },
    });
    if (existing === 0) {
      await this.db().studentProfileUpdatePolicy.createMany({
        data: DEFAULT_PROFILE_UPDATE_POLICIES.map((row) => ({
          tenantId,
          sectionKey: row.sectionKey,
          fieldKey: row.fieldKey,
          approvalMode: row.approvalMode,
          mandatory: row.mandatory ?? false,
          enabled: true,
          sortOrder: row.sortOrder ?? 0,
        })),
        skipDuplicates: true,
      });
    }
    return this.fetchFieldPolicies(tenantId);
  }

  async list(tenantId: string) {
    return this.ensureDefaults(tenantId);
  }

  async getMode(
    tenantId: string,
    sectionKey: string,
    fieldKey: string,
  ): Promise<ProfileApprovalMode> {
    const rows = await this.ensureDefaults(tenantId);
    const hit = rows.find(
      (r: any) =>
        r.sectionKey === sectionKey && r.fieldKey === fieldKey && r.enabled,
    );
    return (hit?.approvalMode as ProfileApprovalMode) ?? 'APPROVAL_REQUIRED';
  }

  async upsertMany(
    tenantId: string,
    rows: Array<{
      sectionKey: string;
      fieldKey: string;
      approvalMode?: ProfileApprovalMode;
      mandatory?: boolean;
      enabled?: boolean;
      sortOrder?: number;
    }>,
  ) {
    await this.ensureDefaults(tenantId);
    for (const row of rows) {
      if (row.sectionKey === '__settings__') continue;
      await this.db().studentProfileUpdatePolicy.upsert({
        where: {
          tenantId_sectionKey_fieldKey: {
            tenantId,
            sectionKey: row.sectionKey,
            fieldKey: row.fieldKey,
          },
        },
        create: {
          tenantId,
          sectionKey: row.sectionKey,
          fieldKey: row.fieldKey,
          approvalMode: row.approvalMode ?? 'APPROVAL_REQUIRED',
          mandatory: row.mandatory ?? false,
          enabled: row.enabled ?? true,
          sortOrder: row.sortOrder ?? 0,
        },
        update: {
          ...(row.approvalMode ? { approvalMode: row.approvalMode } : {}),
          ...(row.mandatory != null ? { mandatory: row.mandatory } : {}),
          ...(row.enabled != null ? { enabled: row.enabled } : {}),
          ...(row.sortOrder != null ? { sortOrder: row.sortOrder } : {}),
        },
      });
    }
    return this.list(tenantId);
  }

  async getSoftGates(tenantId: string) {
    await this.ensureDefaults(tenantId);
    const row = await this.db().studentProfileUpdatePolicy.findUnique({
      where: {
        tenantId_sectionKey_fieldKey: {
          tenantId,
          sectionKey: '__settings__',
          fieldKey: 'soft_gates',
        },
      },
    });
    const meta = (row?.metadata ?? {}) as Record<string, unknown>;
    return {
      enabled: Boolean(meta.enabled ?? false),
      minCompletionPercent: Number(meta.minCompletionPercent ?? 80),
      remindOnLogin: meta.remindOnLogin !== false,
      softBlockRegistration: Boolean(meta.softBlockRegistration ?? false),
      softBlockCertificates: Boolean(meta.softBlockCertificates ?? false),
    };
  }

  async updateSoftGates(
    tenantId: string,
    input: {
      enabled?: boolean;
      minCompletionPercent?: number;
      remindOnLogin?: boolean;
      softBlockRegistration?: boolean;
      softBlockCertificates?: boolean;
    },
  ) {
    const current = await this.getSoftGates(tenantId);
    const next = { ...current, ...input };
    await this.db().studentProfileUpdatePolicy.upsert({
      where: {
        tenantId_sectionKey_fieldKey: {
          tenantId,
          sectionKey: '__settings__',
          fieldKey: 'soft_gates',
        },
      },
      create: {
        tenantId,
        sectionKey: '__settings__',
        fieldKey: 'soft_gates',
        approvalMode: 'READ_ONLY',
        mandatory: false,
        enabled: true,
        sortOrder: 9999,
        metadata: next,
      },
      update: { metadata: next },
    });
    return next;
  }
}
