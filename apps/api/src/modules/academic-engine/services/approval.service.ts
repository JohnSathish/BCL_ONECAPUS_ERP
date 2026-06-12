import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AllocationService } from './allocation.service';

export type ApprovalMode = 'auto' | 'advisor' | 'hod' | 'admin_only';

@Injectable()
export class ApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly allocation: AllocationService,
  ) {}

  async resolvePolicy(
    tenantId: string,
    opts: { programVersionId?: string; registrationWindowId?: string },
  ): Promise<{
    mode: ApprovalMode;
    approverRoles: string[];
    creditPolicy: { minCredits: number; maxCredits: number };
    shiftPolicy: { enforcePreferredShift: boolean; blockCrossShift: boolean };
  }> {
    const policies = await this.prisma.registrationApprovalPolicy.findMany({
      where: {
        tenantId,
        OR: [
          ...(opts.registrationWindowId
            ? [{ registrationWindowId: opts.registrationWindowId }]
            : []),
          ...(opts.programVersionId
            ? [{ programVersionId: opts.programVersionId }]
            : []),
          { programVersionId: null, registrationWindowId: null },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });

    const windowPolicy = policies.find(
      (p) => p.registrationWindowId === opts.registrationWindowId,
    );
    const programPolicy = policies.find(
      (p) => p.programVersionId === opts.programVersionId,
    );
    const tenantPolicy = policies.find(
      (p) => !p.programVersionId && !p.registrationWindowId,
    );
    const policy = windowPolicy ?? programPolicy ?? tenantPolicy;

    const credit =
      (policy?.creditPolicy as { minCredits?: number; maxCredits?: number }) ??
      {};
    const shift =
      (policy?.shiftPolicy as {
        enforcePreferredShift?: boolean;
        blockCrossShift?: boolean;
      }) ?? {};

    return {
      mode: (policy?.mode as ApprovalMode) ?? 'auto',
      approverRoles: (policy?.approverRoles as string[]) ?? ['college-admin'],
      creditPolicy: {
        minCredits: credit.minCredits ?? 18,
        maxCredits: credit.maxCredits ?? 26,
      },
      shiftPolicy: {
        enforcePreferredShift: shift.enforcePreferredShift ?? false,
        blockCrossShift: shift.blockCrossShift ?? true,
      },
    };
  }

  async upsertPolicy(
    tenantId: string,
    data: {
      programVersionId?: string;
      registrationWindowId?: string;
      mode: ApprovalMode;
      approverRoles?: string[];
      creditPolicy?: { minCredits: number; maxCredits: number };
      shiftPolicy?: {
        enforcePreferredShift?: boolean;
        blockCrossShift?: boolean;
      };
    },
  ) {
    const existing = await this.prisma.registrationApprovalPolicy.findFirst({
      where: {
        tenantId,
        programVersionId: data.programVersionId ?? null,
        registrationWindowId: data.registrationWindowId ?? null,
      },
    });
    if (existing) {
      return this.prisma.registrationApprovalPolicy.update({
        where: { id: existing.id },
        data: {
          mode: data.mode,
          approverRoles: data.approverRoles ?? [],
          creditPolicy: data.creditPolicy,
          shiftPolicy: data.shiftPolicy,
        },
      });
    }
    return this.prisma.registrationApprovalPolicy.create({
      data: {
        tenantId,
        programVersionId: data.programVersionId,
        registrationWindowId: data.registrationWindowId,
        mode: data.mode,
        approverRoles: data.approverRoles ?? [],
        creditPolicy: data.creditPolicy,
        shiftPolicy: data.shiftPolicy,
      },
    });
  }

  assertCanApprove(mode: ApprovalMode, roles: string[]) {
    if (mode === 'auto') return;
    if (roles.includes('college-admin')) return;
    if (mode === 'advisor' && roles.includes('faculty')) return;
    if (mode === 'hod' && roles.includes('faculty')) return;
    if (mode === 'admin_only' && roles.includes('college-admin')) return;
    throw new ForbiddenException('Not authorized to approve registrations');
  }

  async submitForApproval(
    tenantId: string,
    registrationId: string,
    mode: ApprovalMode,
    actorId?: string,
  ) {
    const status = mode === 'auto' ? 'approved' : 'pending_approval';
    await this.prisma.registrationApproval.create({
      data: {
        tenantId,
        registrationId,
        stage: mode,
        status: status === 'approved' ? 'approved' : 'pending',
        actedById: mode === 'auto' ? actorId : null,
        actedAt: mode === 'auto' ? new Date() : null,
      },
    });
    await this.prisma.registrationAuditLog.create({
      data: {
        tenantId,
        registrationId,
        action: mode === 'auto' ? 'auto_approved' : 'submitted',
        actorId,
      },
    });
    return this.prisma.semesterRegistration.update({
      where: { id: registrationId },
      data: {
        status: mode === 'auto' ? 'approved' : 'pending_approval',
        submittedAt: new Date(),
      },
    });
  }

  async approve(
    tenantId: string,
    registrationId: string,
    actorId: string,
    roles: string[],
  ) {
    const reg = await this.prisma.semesterRegistration.findFirst({
      where: { id: registrationId, tenantId },
      include: { student: true, semester: true },
    });
    if (!reg) throw new BadRequestException('Registration not found');
    if (!['submitted', 'pending_approval', 'approved'].includes(reg.status)) {
      throw new BadRequestException(
        'Registration cannot be approved in current status',
      );
    }

    const window = await this.prisma.registrationWindow.findFirst({
      where: { tenantId, semesterId: reg.semesterId },
      orderBy: { opensAt: 'desc' },
    });
    const policy = await this.resolvePolicy(tenantId, {
      programVersionId: reg.student.programVersionId ?? undefined,
      registrationWindowId: window?.id,
    });
    this.assertCanApprove(policy.mode, roles);

    await this.prisma.registrationApproval.create({
      data: {
        tenantId,
        registrationId,
        stage: policy.mode,
        status: 'approved',
        actedById: actorId,
        actedAt: new Date(),
      },
    });

    await this.prisma.semesterRegistration.update({
      where: { id: registrationId },
      data: { status: 'approved' },
    });

    return this.allocation.allocateRegistration(
      tenantId,
      registrationId,
      actorId,
    );
  }

  async reject(
    tenantId: string,
    registrationId: string,
    actorId: string,
    comment: string,
  ) {
    await this.prisma.registrationApproval.create({
      data: {
        tenantId,
        registrationId,
        stage: 'reject',
        status: 'rejected',
        actedById: actorId,
        actedAt: new Date(),
        comment,
      },
    });
    await this.prisma.registrationAuditLog.create({
      data: {
        tenantId,
        registrationId,
        action: 'rejected',
        actorId,
        metadata: { comment },
      },
    });
    return this.prisma.semesterRegistration.update({
      where: { id: registrationId },
      data: { status: 'rejected' },
    });
  }
}
