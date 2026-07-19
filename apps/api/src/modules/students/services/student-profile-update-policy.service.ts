import { Injectable, NotFoundException } from '@nestjs/common';
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
    const existing = await this.fetchFieldPolicies(tenantId);
    const existingKeys = new Set(
      existing.map((r: any) => `${r.sectionKey}::${r.fieldKey}`),
    );
    const missing = DEFAULT_PROFILE_UPDATE_POLICIES.filter(
      (row) => !existingKeys.has(`${row.sectionKey}::${row.fieldKey}`),
    );
    if (missing.length) {
      await this.db().studentProfileUpdatePolicy.createMany({
        data: missing.map((row) => ({
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
      return this.fetchFieldPolicies(tenantId);
    }
    return existing;
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

  async getUpdateWindow(tenantId: string) {
    await this.ensureDefaults(tenantId);
    const row = await this.db().studentProfileUpdatePolicy.findUnique({
      where: {
        tenantId_sectionKey_fieldKey: {
          tenantId,
          sectionKey: '__settings__',
          fieldKey: 'update_window',
        },
      },
    });
    const meta = (row?.metadata ?? {}) as Record<string, unknown>;
    return {
      enabled: Boolean(meta.enabled ?? false),
      startsAt: (meta.startsAt as string | null) ?? null,
      endsAt: (meta.endsAt as string | null) ?? null,
      closedMessage:
        (typeof meta.closedMessage === 'string' && meta.closedMessage.trim()) ||
        'The profile update period has ended. Please contact the College Office if you need to make any changes.',
      bankSectionVisible: meta.bankSectionVisible === true,
    };
  }

  async updateUpdateWindow(
    tenantId: string,
    input: {
      enabled?: boolean;
      startsAt?: string | null;
      endsAt?: string | null;
      closedMessage?: string | null;
      bankSectionVisible?: boolean;
    },
  ) {
    const current = await this.getUpdateWindow(tenantId);
    const next = {
      enabled: input.enabled ?? current.enabled,
      startsAt:
        input.startsAt !== undefined ? input.startsAt : current.startsAt,
      endsAt: input.endsAt !== undefined ? input.endsAt : current.endsAt,
      closedMessage:
        input.closedMessage !== undefined && input.closedMessage != null
          ? input.closedMessage.trim() || current.closedMessage
          : current.closedMessage,
      bankSectionVisible:
        input.bankSectionVisible !== undefined
          ? input.bankSectionVisible
          : current.bankSectionVisible,
    };
    await this.db().studentProfileUpdatePolicy.upsert({
      where: {
        tenantId_sectionKey_fieldKey: {
          tenantId,
          sectionKey: '__settings__',
          fieldKey: 'update_window',
        },
      },
      create: {
        tenantId,
        sectionKey: '__settings__',
        fieldKey: 'update_window',
        approvalMode: 'READ_ONLY',
        mandatory: false,
        enabled: true,
        sortOrder: 9998,
        metadata: next,
      },
      update: { metadata: next },
    });
    return next;
  }

  async reopenAll(
    tenantId: string,
    input: { startsAt?: string | null; endsAt: string },
  ) {
    const current = await this.getUpdateWindow(tenantId);
    return this.updateUpdateWindow(tenantId, {
      enabled: true,
      startsAt:
        input.startsAt ??
        current.startsAt ??
        new Date().toISOString().slice(0, 10),
      endsAt: input.endsAt,
    });
  }

  private startOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  isTenantWindowOpen(window: {
    enabled: boolean;
    startsAt?: string | null;
    endsAt?: string | null;
  }): boolean {
    if (!window.enabled) return true; // feature off → always editable
    const today = this.startOfDay(new Date());
    if (window.startsAt) {
      const start = this.startOfDay(new Date(window.startsAt));
      if (today < start) return false;
    }
    if (window.endsAt) {
      const end = this.startOfDay(new Date(window.endsAt));
      if (today > end) return false;
    }
    // enabled but no dates → treat as open while enabled
    return true;
  }

  async getActiveReopen(tenantId: string, studentId: string) {
    const today = this.startOfDay(new Date());
    const row = await this.db().studentProfileUpdateReopen.findFirst({
      where: {
        tenantId,
        studentId,
        revokedAt: null,
        reopenUntil: { gte: today },
      },
      orderBy: { reopenUntil: 'desc' },
    });
    return row as {
      id: string;
      reopenUntil: Date;
      reason: string | null;
    } | null;
  }

  async evaluateProfileUpdateAccess(tenantId: string, studentId: string) {
    const [window, reopen] = await Promise.all([
      this.getUpdateWindow(tenantId),
      this.getActiveReopen(tenantId, studentId),
    ]);
    const windowOpen = this.isTenantWindowOpen(window);
    const canEdit = windowOpen || Boolean(reopen);
    return {
      enabled: window.enabled,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      closedMessage: window.closedMessage,
      bankSectionVisible: window.bankSectionVisible,
      windowOpen,
      canEdit,
      reopenUntil: reopen?.reopenUntil
        ? new Date(reopen.reopenUntil).toISOString().slice(0, 10)
        : null,
      message: canEdit ? null : window.closedMessage,
    };
  }

  async resolveStudentId(tenantId: string, rollOrId: string): Promise<string> {
    const raw = rollOrId.trim();
    if (!raw) throw new NotFoundException('Student not found');

    const uuidLike =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        raw,
      );

    if (uuidLike) {
      const byId = await this.prisma.student.findFirst({
        where: { tenantId, id: raw, deletedAt: null },
        select: { id: true },
      });
      if (byId) return byId.id;
    }

    const student = await this.prisma.student.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { rollNumber: { equals: raw, mode: 'insensitive' } },
          { enrollmentNumber: { equals: raw, mode: 'insensitive' } },
          { admissionNumber: { equals: raw, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        rollNumber: true,
        enrollmentNumber: true,
        masterProfile: { select: { fullName: true } },
      },
    });
    if (!student) {
      throw new NotFoundException(
        `No student found for roll / enrollment number "${raw}".`,
      );
    }
    return student.id;
  }

  async reopenStudentByRoll(
    tenantId: string,
    rollNumber: string,
    input: { reopenUntil: string; reason?: string },
    actorId: string,
  ) {
    const studentId = await this.resolveStudentId(tenantId, rollNumber);
    const row = await this.reopenStudent(tenantId, studentId, input, actorId);
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
      select: {
        id: true,
        rollNumber: true,
        enrollmentNumber: true,
        masterProfile: { select: { fullName: true } },
      },
    });
    return {
      ...row,
      student: {
        id: student?.id,
        rollNumber: student?.rollNumber,
        enrollmentNumber: student?.enrollmentNumber,
        name: student?.masterProfile?.fullName ?? null,
      },
    };
  }

  async revokeStudentReopenByRoll(
    tenantId: string,
    rollNumber: string,
    actorId: string,
  ) {
    const studentId = await this.resolveStudentId(tenantId, rollNumber);
    await this.revokeStudentReopen(tenantId, studentId, actorId);
    return { ok: true, studentId };
  }

  async reopenStudent(
    tenantId: string,
    studentId: string,
    input: { reopenUntil: string; reason?: string },
    actorId: string,
  ) {
    // Revoke prior active reopens for clarity
    await this.db().studentProfileUpdateReopen.updateMany({
      where: { tenantId, studentId, revokedAt: null },
      data: { revokedAt: new Date(), revokedById: actorId },
    });
    return this.db().studentProfileUpdateReopen.create({
      data: {
        tenantId,
        studentId,
        reopenUntil: new Date(input.reopenUntil),
        reason: input.reason?.trim() || null,
        createdById: actorId,
      },
    });
  }

  async revokeStudentReopen(
    tenantId: string,
    studentId: string,
    actorId: string,
  ) {
    await this.db().studentProfileUpdateReopen.updateMany({
      where: { tenantId, studentId, revokedAt: null },
      data: { revokedAt: new Date(), revokedById: actorId },
    });
    return { ok: true };
  }
}
