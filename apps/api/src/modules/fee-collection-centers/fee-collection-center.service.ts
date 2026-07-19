import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomInt } from 'crypto';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { StudentFeeAccountService } from '../fees/services/student-fee-account.service';
import { GatewayPaymentService } from '../fees/services/gateway-payment.service';
import type {
  CenterGatewayPayDto,
  CenterReviewDto,
  RegisterFeeCollectionCenterDto,
} from './dto/fee-collection-center.dto';

const CENTER_ROLE = 'fee-collection-center';
const CENTER_PERMS = [
  'fees:collection-center:self',
  'fees:collection-center:pay',
  'notifications:read',
];

@Injectable()
export class FeeCollectionCenterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly feeAccounts: StudentFeeAccountService,
    private readonly gateways: GatewayPaymentService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  private hashToken(raw: string) {
    return createHash('sha256').update(raw).digest('hex');
  }

  private async audit(
    tenantId: string,
    action: string,
    opts: {
      centerId?: string | null;
      actorId?: string | null;
      details?: Record<string, unknown>;
      ipAddress?: string | null;
      userAgent?: string | null;
    } = {},
  ) {
    await this.db().feeCollectionCenterAuditLog.create({
      data: {
        tenantId,
        centerId: opts.centerId ?? null,
        actorId: opts.actorId ?? null,
        action,
        details: opts.details ?? {},
        ipAddress: opts.ipAddress ?? null,
        userAgent: opts.userAgent ?? null,
      },
    });
  }

  async register(
    tenantId: string,
    dto: RegisterFeeCollectionCenterDto,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const email = dto.email.trim().toLowerCase();
    const username = dto.username.trim().toLowerCase();
    const existingUser = await this.prisma.user.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { email: { equals: email, mode: 'insensitive' } },
          { username: { equals: username, mode: 'insensitive' } },
        ],
      },
    });
    if (existingUser) {
      throw new ConflictException(
        'Email or username is already registered. Contact the college office if you already applied.',
      );
    }

    const emailToken = randomBytes(24).toString('hex');
    const otp = String(randomInt(100000, 999999));
    const passwordHash = await bcrypt.hash(dto.password, 12);

    const center = await this.db().feeCollectionCenter.create({
      data: {
        tenantId,
        businessName: dto.businessName.trim(),
        ownerName: dto.ownerName.trim(),
        gstNumber: dto.gstNumber?.trim() || null,
        panNumber: dto.panNumber?.trim() || null,
        aadhaarNumber: dto.aadhaarNumber?.trim() || null,
        mobileNumber: dto.mobileNumber.trim(),
        email,
        addressLine: dto.addressLine.trim(),
        district: dto.district.trim(),
        state: dto.state.trim(),
        pincode: dto.pincode.trim(),
        status: 'PENDING_APPROVAL',
        emailVerifyTokenHash: this.hashToken(emailToken),
        otpHash: this.hashToken(otp),
        otpExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
        metadata: { pendingUsername: username },
      },
    });

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email,
        username,
        displayName: dto.ownerName.trim(),
        phone: dto.mobileNumber.trim(),
        passwordHash,
        isActive: false,
        accountStatus: 'pending',
      },
    });

    await this.ensureCenterRole(tenantId, user.id);

    await this.db().feeCollectionCenterOperator.create({
      data: {
        tenantId,
        centerId: center.id,
        userId: user.id,
        displayName: dto.ownerName.trim(),
        isPrimary: true,
      },
    });

    await this.audit(tenantId, 'CENTER_REGISTERED', {
      centerId: center.id,
      actorId: user.id,
      details: { email, username },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    // Dev/ops: return verification secrets once (email/SMS providers may not be configured).
    return {
      centerId: center.id,
      status: center.status,
      message:
        'Registration submitted. Verify email/OTP, then wait for college approval before login.',
      emailVerifyToken: emailToken,
      otp,
    };
  }

  private async ensureCenterRole(tenantId: string, userId: string) {
    let role = await this.prisma.role.findFirst({
      where: { tenantId, slug: CENTER_ROLE, deletedAt: null },
    });
    if (!role) {
      role = await this.prisma.role.create({
        data: {
          tenantId,
          slug: CENTER_ROLE,
          name: 'Fee Collection Center',
          description: 'Authorized Net Café / CSC fee collection operator',
        },
      });
    }
    for (const slug of CENTER_PERMS) {
      let perm = await this.prisma.permission.findFirst({
        where: { slug, deletedAt: null },
      });
      if (!perm) {
        const [resource, ...rest] = slug.split(':');
        perm = await this.prisma.permission.create({
          data: {
            slug,
            resource: resource ?? 'fees',
            action: rest.join(':') || 'self',
            description: slug,
          },
        });
      }
      await this.prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: perm.id },
        },
        create: { roleId: role.id, permissionId: perm.id },
        update: {},
      });
    }
    await this.prisma.userRole
      .create({
        data: { userId, roleId: role.id },
      })
      .catch(async () => {
        // Already linked
        const existing = await this.prisma.userRole.findFirst({
          where: { userId, roleId: role.id },
        });
        if (existing?.deletedAt) {
          await this.prisma.userRole.update({
            where: { id: existing.id },
            data: { deletedAt: null },
          });
        }
      });
  }

  async verifyEmail(tenantId: string, centerId: string, token: string) {
    const center = await this.requireCenter(tenantId, centerId);
    if (!center.emailVerifyTokenHash) {
      throw new BadRequestException('Email verification is not pending.');
    }
    if (center.emailVerifyTokenHash !== this.hashToken(token)) {
      throw new BadRequestException('Invalid email verification token.');
    }
    await this.db().feeCollectionCenter.update({
      where: { id: centerId },
      data: {
        emailVerifiedAt: new Date(),
        emailVerifyTokenHash: null,
      },
    });
    await this.audit(tenantId, 'EMAIL_VERIFIED', { centerId });
    return { verified: true };
  }

  async verifyOtp(tenantId: string, centerId: string, otp: string) {
    const center = await this.requireCenter(tenantId, centerId);
    if (!center.otpHash || !center.otpExpiresAt) {
      throw new BadRequestException('OTP verification is not pending.');
    }
    if (new Date(center.otpExpiresAt) < new Date()) {
      throw new BadRequestException('OTP has expired. Contact college office.');
    }
    if (center.otpHash !== this.hashToken(otp.trim())) {
      throw new BadRequestException('Invalid OTP.');
    }
    await this.db().feeCollectionCenter.update({
      where: { id: centerId },
      data: {
        mobileVerifiedAt: new Date(),
        otpHash: null,
        otpExpiresAt: null,
      },
    });
    await this.audit(tenantId, 'OTP_VERIFIED', { centerId });
    return { verified: true };
  }

  async assertOperatorCanLogin(tenantId: string, userId: string) {
    const op = await this.db().feeCollectionCenterOperator.findFirst({
      where: { tenantId, userId, deletedAt: null },
      include: { center: true },
    });
    if (!op?.center || op.center.deletedAt) {
      throw new UnauthorizedException('Not a fee collection center operator.');
    }
    if (op.center.status !== 'APPROVED') {
      throw new ForbiddenException(
        `Center status is ${op.center.status}. Login is allowed only after college approval.`,
      );
    }
    if (!op.center.emailVerifiedAt) {
      throw new ForbiddenException('Verify your email before login.');
    }
    return op;
  }

  async review(
    user: JwtUser,
    centerId: string,
    dto: CenterReviewDto,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const center = await this.requireCenter(user.tid, centerId);
    const op = await this.db().feeCollectionCenterOperator.findFirst({
      where: { tenantId: user.tid, centerId, isPrimary: true, deletedAt: null },
    });
    if (!op) throw new NotFoundException('Center operator not found');

    if (dto.action === 'APPROVE') {
      if (!center.emailVerifiedAt) {
        throw new BadRequestException(
          'Center must verify email before approval.',
        );
      }
      await this.db().feeCollectionCenter.update({
        where: { id: centerId },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedById: user.sub,
          rejectedReason: null,
          suspendedAt: null,
        },
      });
      await this.prisma.user.update({
        where: { id: op.userId },
        data: {
          isActive: true,
          accountStatus: 'active',
          emailVerifiedAt: center.emailVerifiedAt ?? new Date(),
        },
      });
      await this.audit(user.tid, 'CENTER_APPROVED', {
        centerId,
        actorId: user.sub,
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });
      return { status: 'APPROVED' };
    }

    await this.db().feeCollectionCenter.update({
      where: { id: centerId },
      data: {
        status: 'REJECTED',
        rejectedReason: dto.reason?.trim() || 'Rejected by college office',
      },
    });
    await this.prisma.user.update({
      where: { id: op.userId },
      data: { isActive: false, accountStatus: 'blocked' },
    });
    await this.audit(user.tid, 'CENTER_REJECTED', {
      centerId,
      actorId: user.sub,
      details: { reason: dto.reason },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });
    return { status: 'REJECTED' };
  }

  async setStatus(
    user: JwtUser,
    centerId: string,
    status: 'SUSPENDED' | 'BLOCKED' | 'APPROVED',
    reason?: string,
  ) {
    const center = await this.requireCenter(user.tid, centerId);
    const op = await this.db().feeCollectionCenterOperator.findFirst({
      where: { tenantId: user.tid, centerId, isPrimary: true, deletedAt: null },
    });
    await this.db().feeCollectionCenter.update({
      where: { id: centerId },
      data: {
        status,
        suspendedAt: status === 'SUSPENDED' ? new Date() : null,
        rejectedReason: reason ?? center.rejectedReason,
      },
    });
    if (op) {
      await this.prisma.user.update({
        where: { id: op.userId },
        data: {
          isActive: status === 'APPROVED',
          accountStatus: status === 'APPROVED' ? 'active' : 'blocked',
        },
      });
    }
    await this.audit(user.tid, `CENTER_${status}`, {
      centerId,
      actorId: user.sub,
      details: { reason },
    });
    return { status };
  }

  async resetOperatorPassword(
    user: JwtUser,
    centerId: string,
    newPassword: string,
  ) {
    const op = await this.db().feeCollectionCenterOperator.findFirst({
      where: { tenantId: user.tid, centerId, isPrimary: true, deletedAt: null },
    });
    if (!op) throw new NotFoundException('Operator not found');
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: op.userId },
      data: {
        passwordHash,
        mustResetPassword: true,
        passwordChangedAt: new Date(),
      },
    });
    await this.audit(user.tid, 'PASSWORD_RESET', {
      centerId,
      actorId: user.sub,
    });
    return { reset: true };
  }

  async listCenters(
    tenantId: string,
    filters: { status?: string; search?: string } = {},
  ) {
    return this.db().feeCollectionCenter.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.search
          ? {
              OR: [
                {
                  businessName: {
                    contains: filters.search,
                    mode: 'insensitive',
                  },
                },
                { email: { contains: filters.search, mode: 'insensitive' } },
                {
                  ownerName: { contains: filters.search, mode: 'insensitive' },
                },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        operators: {
          where: { deletedAt: null },
          select: {
            id: true,
            userId: true,
            displayName: true,
            isPrimary: true,
          },
        },
      },
      take: 200,
    });
  }

  async resolveOperatorContext(user: JwtUser) {
    const op = await this.db().feeCollectionCenterOperator.findFirst({
      where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
      include: { center: true },
    });
    if (!op?.center || op.center.deletedAt) {
      throw new ForbiddenException('Fee collection center profile not found.');
    }
    if (op.center.status !== 'APPROVED') {
      throw new ForbiddenException(
        `Center is ${op.center.status}. Contact college office.`,
      );
    }
    return op as {
      id: string;
      centerId: string;
      userId: string;
      displayName: string;
      center: {
        id: string;
        businessName: string;
        ownerName: string;
        status: string;
      };
    };
  }

  async dashboard(user: JwtUser) {
    const op = await this.resolveOperatorContext(user);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const txs = await this.db().paymentTransaction.findMany({
      where: {
        tenantId: user.tid,
        collectedById: op.userId,
        createdAt: { gte: start },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const centerTxs = txs.filter(
      (t: any) =>
        (t.metadata as any)?.collectionCenterId === op.centerId ||
        (t.metadata as any)?.collectedVia === 'CENTER_PORTAL',
    );
    const success = centerTxs.filter((t: any) => t.status === 'SUCCESS');
    const failed = centerTxs.filter((t: any) =>
      ['FAILED', 'CANCELLED'].includes(t.status),
    );
    const pending = centerTxs.filter((t: any) =>
      ['PENDING', 'INITIATED', 'PENDING_CLEARANCE'].includes(t.status),
    );
    const total = success.reduce(
      (sum: number, t: any) => sum + Number(t.amount ?? 0),
      0,
    );
    return {
      center: {
        id: op.center.id,
        businessName: op.center.businessName,
        operatorName: op.displayName,
      },
      today: {
        collections: total,
        transactions: centerTxs.length,
        successful: success.length,
        failed: failed.length,
        pending: pending.length,
      },
      recent: centerTxs.slice(0, 20).map((t: any) => this.mapTx(t)),
    };
  }

  async searchStudent(user: JwtUser, query: string) {
    const op = await this.resolveOperatorContext(user);
    const q = query.trim();
    if (q.length < 2)
      throw new BadRequestException('Enter at least 2 characters');

    const student = await this.prisma.student.findFirst({
      where: {
        tenantId: user.tid,
        deletedAt: null,
        OR: [
          ...(q.length === 36 ? [{ id: q }] : []),
          { rollNumber: { equals: q, mode: 'insensitive' as const } },
          { enrollmentNumber: { equals: q, mode: 'insensitive' as const } },
          { admissionNumber: { equals: q, mode: 'insensitive' as const } },
          {
            universityRollNumber: { equals: q, mode: 'insensitive' as const },
          },
          {
            universityRegistrationNumber: {
              equals: q,
              mode: 'insensitive' as const,
            },
          },
        ],
      },
      include: {
        masterProfile: { select: { fullName: true } },
        programVersion: {
          include: { program: { select: { name: true, code: true } } },
        },
        department: { select: { name: true } },
        academicProfile: {
          include: {
            admissionBatch: {
              select: { batchCode: true, admissionYear: true },
            },
          },
        },
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    const account = await this.feeAccounts.getAccount(user.tid, student.id);
    const summary = account.summary ?? {};

    await this.audit(user.tid, 'STUDENT_SEARCH', {
      centerId: op.centerId,
      actorId: user.sub,
      details: { query: q, studentId: student.id },
    });

    return {
      studentId: student.id,
      fullName: student.masterProfile?.fullName ?? 'Student',
      rollNumber: student.rollNumber,
      enrollmentNumber: student.enrollmentNumber,
      admissionNumber: student.admissionNumber,
      programme: student.programVersion?.program?.name ?? null,
      programmeCode: student.programVersion?.program?.code ?? null,
      department: student.department?.name ?? null,
      semester: (account as any).currentSemester ?? null,
      academicYear:
        student.academicProfile?.admissionBatch?.batchCode ??
        (student.academicProfile?.admissionBatch?.admissionYear
          ? String(student.academicProfile.admissionBatch.admissionYear)
          : null),
      feePaid: Number(summary.totalPaid ?? 0),
      pendingFee: Number(summary.outstanding ?? summary.totalDue ?? 0),
      lateFine: Number(summary.overdue ?? 0),
      scholarshipAdjustment: Number(summary.scholarshipTotal ?? 0),
      totalPayable: Number(summary.outstanding ?? summary.totalDue ?? 0),
      payableItems: (account.payableItems ?? []).map((item: any) => ({
        demandId: item.demandId ?? item.id,
        label: item.label ?? item.title ?? item.feeHeadName ?? 'Fee',
        amount: Number(item.amount ?? item.balance ?? 0),
      })),
    };
  }

  async initiatePayment(
    user: JwtUser,
    dto: CenterGatewayPayDto,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const op = await this.resolveOperatorContext(user);
    const result = await this.gateways.initiate(user, {
      studentId: dto.studentId,
      amount: dto.amount,
      demandIds: dto.demandIds,
      channel: 'CENTER_PORTAL',
      returnPath: `/fee-collection-portal/pay/return`,
      metadata: {
        collectedVia: 'CENTER_PORTAL',
        collectionCenterId: op.centerId,
        collectionCenterName: op.center.businessName,
        operatorUserId: op.userId,
        operatorName: op.displayName,
        clientIp: meta?.ipAddress ?? null,
        userAgent: meta?.userAgent ?? null,
      },
    } as any);

    await this.audit(user.tid, 'PAYMENT_INITIATED', {
      centerId: op.centerId,
      actorId: user.sub,
      details: {
        studentId: dto.studentId,
        amount: dto.amount,
        paymentId: result.payment?.id,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    // Lightweight spike hook: many initiates in a short window.
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentInitiates = await this.db().feeCollectionCenterAuditLog.count({
      where: {
        tenantId: user.tid,
        centerId: op.centerId,
        action: 'PAYMENT_INITIATED',
        createdAt: { gte: hourAgo },
      },
    });
    if (recentInitiates >= 40) {
      await this.audit(user.tid, 'SUSPICIOUS_PAYMENT_SPIKE', {
        centerId: op.centerId,
        actorId: user.sub,
        details: { recentInitiates, windowMinutes: 60 },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });
    }

    return result;
  }

  async listMyTransactions(
    user: JwtUser,
    filters: { from?: string; to?: string; status?: string } = {},
  ) {
    const op = await this.resolveOperatorContext(user);
    const where: any = {
      tenantId: user.tid,
      collectedById: op.userId,
    };
    if (filters.status) where.status = filters.status;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to) where.createdAt.lte = new Date(filters.to);
    }
    const rows = await this.db().paymentTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        receipts: { select: { id: true, receiptNo: true, pdfPath: true } },
      },
    });
    return rows
      .filter(
        (t: any) =>
          (t.metadata as any)?.collectionCenterId === op.centerId ||
          (t.metadata as any)?.collectedVia === 'CENTER_PORTAL',
      )
      .map((t: any) => this.mapTx(t));
  }

  async adminTransactions(
    tenantId: string,
    filters: {
      centerId?: string;
      status?: string;
      from?: string;
      to?: string;
    } = {},
  ) {
    const rows = await this.db().paymentTransaction.findMany({
      where: {
        tenantId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.from || filters.to
          ? {
              createdAt: {
                ...(filters.from ? { gte: new Date(filters.from) } : {}),
                ...(filters.to ? { lte: new Date(filters.to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        receipts: { select: { id: true, receiptNo: true } },
      },
    });
    return rows
      .filter((t: any) => {
        const meta = (t.metadata ?? {}) as any;
        if (meta.collectedVia !== 'CENTER_PORTAL') return false;
        if (filters.centerId && meta.collectionCenterId !== filters.centerId)
          return false;
        return true;
      })
      .map((t: any) => this.mapTx(t));
  }

  async reports(
    tenantId: string,
    type: 'daily' | 'monthly' | 'center',
    opts: { from?: string; to?: string } = {},
  ) {
    const txs = await this.adminTransactions(tenantId, {
      status: 'SUCCESS',
      from: opts.from,
      to: opts.to,
    });
    if (type === 'center') {
      const byCenter = new Map<
        string,
        { centerId: string; centerName: string; count: number; amount: number }
      >();
      for (const t of txs) {
        const key = t.collectionCenterId ?? 'unknown';
        const cur = byCenter.get(key) ?? {
          centerId: key,
          centerName: t.collectionCenterName ?? 'Unknown',
          count: 0,
          amount: 0,
        };
        cur.count += 1;
        cur.amount += Number(t.amount ?? 0);
        byCenter.set(key, cur);
      }
      return { type, rows: [...byCenter.values()] };
    }
    const bucket = new Map<
      string,
      { key: string; count: number; amount: number }
    >();
    for (const t of txs) {
      const d = new Date(t.paidAt ?? t.createdAt);
      const key =
        type === 'monthly'
          ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          : d.toISOString().slice(0, 10);
      const cur = bucket.get(key) ?? { key, count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += Number(t.amount ?? 0);
      bucket.set(key, cur);
    }
    return {
      type,
      rows: [...bucket.values()].sort((a, b) => a.key.localeCompare(b.key)),
    };
  }

  private mapTx(t: any) {
    const meta = (t.metadata ?? {}) as any;
    return {
      id: t.id,
      transactionNo: t.transactionNo,
      studentId: t.studentId,
      amount: Number(t.amount ?? 0),
      status: t.status,
      paymentMode: t.paymentMode,
      provider: t.provider,
      providerOrderId: t.providerOrderId,
      providerPaymentId: t.providerPaymentId,
      paidAt: t.paidAt,
      createdAt: t.createdAt,
      collectionCenterId: meta.collectionCenterId ?? null,
      collectionCenterName: meta.collectionCenterName ?? null,
      operatorName: meta.operatorName ?? null,
      receipts: t.receipts ?? [],
    };
  }

  private async requireCenter(tenantId: string, centerId: string) {
    const center = await this.db().feeCollectionCenter.findFirst({
      where: { id: centerId, tenantId, deletedAt: null },
    });
    if (!center) throw new NotFoundException('Collection center not found');
    return center;
  }

  async assertOwnReceipt(user: JwtUser, receiptId: string) {
    const op = await this.resolveOperatorContext(user);
    const receipt = await this.db().feeReceipt.findFirst({
      where: { id: receiptId, tenantId: user.tid },
      include: { payment: true },
    });
    if (!receipt?.payment) throw new NotFoundException('Receipt not found');
    const meta = (receipt.payment.metadata ?? {}) as any;
    const sameCollector = receipt.payment.collectedById === op.userId;
    const sameCenter =
      meta.collectedVia === 'CENTER_PORTAL' &&
      meta.collectionCenterId === op.centerId;
    if (!sameCollector || !sameCenter) {
      throw new ForbiddenException('Receipt is not from your center.');
    }
  }
}
