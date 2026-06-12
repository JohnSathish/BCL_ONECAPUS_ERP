import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import type {
  CreateLicenseDto,
  ExtendLicenseDto,
  ListLicensesQueryDto,
  RenewLicenseDto,
  SuspendLicenseDto,
} from '../dto/licensing.dto';
import {
  LICENSE_TYPE_DAYS,
  LICENSE_TYPE_LABELS,
  type LicenseStatus,
} from '../licensing.types';
import { LicenseAuditService } from './license-audit.service';
import { LicenseStatusService } from './license-status.service';
import { LicenseUsageService } from './license-usage.service';

@Injectable()
export class PlatformLicenseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly status: LicenseStatusService,
    private readonly usage: LicenseUsageService,
    private readonly audit: LicenseAuditService,
  ) {}

  async list(query: ListLicensesQueryDto) {
    const tenants = await this.prisma.tenant.findMany({
      where: { deletedAt: null },
      include: { tenantLicense: true },
      orderBy: { name: 'asc' },
    });

    let rows = tenants.map((t) => {
      const license = t.tenantLicense;
      const computed = license ? this.status.compute(license) : null;
      return {
        tenantId: t.id,
        institutionName: t.name,
        tenantStatus: t.status,
        license: license
          ? {
              id: license.id,
              licenseNumber: license.licenseNumber,
              licenseType: license.licenseType,
              subscriptionPlan: license.subscriptionPlan,
              expiryDate: license.expiryDate,
              ...computed,
            }
          : null,
      };
    });

    if (query.status) {
      rows = rows.filter((r) => r.license?.status === query.status);
    }
    if (query.search) {
      const q = query.search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.institutionName.toLowerCase().includes(q) ||
          r.license?.licenseNumber.toLowerCase().includes(q),
      );
    }

    return { items: rows, total: rows.length };
  }

  async analytics() {
    const licenses = await this.prisma.tenantLicense.findMany({
      include: { tenant: { select: { name: true } } },
    });

    const buckets: Record<LicenseStatus, number> = {
      ACTIVE: 0,
      NEAR_EXPIRY: 0,
      GRACE_PERIOD: 0,
      EXPIRED: 0,
      SUSPENDED: 0,
    };

    let annualRevenue = 0;
    const renewals = await this.prisma.licenseRenewal.findMany({
      where: { renewedAt: { gte: new Date(new Date().getFullYear(), 0, 1) } },
    });
    for (const r of renewals) {
      annualRevenue += Number(r.amount ?? 0);
    }

    for (const license of licenses) {
      const computed = this.status.compute(license);
      buckets[computed.status] += 1;
    }

    const nearExpiry = licenses.filter((l) => {
      const c = this.status.compute(l);
      return c.status === 'NEAR_EXPIRY' || c.status === 'GRACE_PERIOD';
    }).length;

    return {
      totalLicensedInstitutions: licenses.length,
      activeLicenses: buckets.ACTIVE,
      nearExpiryLicenses: nearExpiry,
      expiredLicenses: buckets.EXPIRED,
      suspendedLicenses: buckets.SUSPENDED,
      annualRevenue,
      renewalForecast: nearExpiry,
    };
  }

  async getByTenantId(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        tenantLicense: {
          include: { renewals: { orderBy: { renewedAt: 'desc' } } },
        },
      },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (!tenant.tenantLicense) {
      const usage = await this.usage.getUsage(tenantId);
      return {
        tenant: { id: tenant.id, name: tenant.name, status: tenant.status },
        license: null,
        usage,
      };
    }

    const usage = await this.usage.getUsage(tenantId);
    const computed = this.status.compute(tenant.tenantLicense);

    return {
      tenant: { id: tenant.id, name: tenant.name, status: tenant.status },
      license: { ...tenant.tenantLicense, ...computed },
      usage,
    };
  }

  async create(dto: CreateLicenseDto, user: JwtUser) {
    const existing = await this.prisma.tenantLicense.findUnique({
      where: { tenantId: dto.tenantId },
    });
    if (existing) throw new BadRequestException('Tenant already has a license');

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: dto.tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const licenseNumber = await this.nextLicenseNumber();
    const expiryDate = dto.expiryDate
      ? new Date(dto.expiryDate)
      : this.defaultExpiry(dto.licenseType, new Date(dto.startDate));

    const license = await this.prisma.tenantLicense.create({
      data: {
        tenantId: dto.tenantId,
        licenseNumber,
        licenseType: dto.licenseType,
        subscriptionPlan:
          dto.subscriptionPlan ??
          LICENSE_TYPE_LABELS[
            dto.licenseType as keyof typeof LICENSE_TYPE_LABELS
          ],
        startDate: new Date(dto.startDate),
        expiryDate,
        gracePeriodDays: dto.gracePeriodDays ?? 15,
        maxStudents: dto.maxStudents,
        maxStaff: dto.maxStaff,
        storageLimitMb: dto.storageLimitMb,
        internalNotes: dto.internalNotes,
        createdById: user.sub,
      },
    });

    await this.audit.log(
      license.id,
      'LICENSE_CREATED',
      user.sub,
      null,
      license,
    );
    return license;
  }

  async renew(tenantId: string, dto: RenewLicenseDto, user: JwtUser) {
    const license = await this.requireLicense(tenantId);
    const previousExpiry = license.expiryDate;
    const newExpiryDate = new Date(dto.newExpiryDate);

    const updated = await this.prisma.tenantLicense.update({
      where: { id: license.id },
      data: {
        expiryDate: newExpiryDate,
        renewalDate: new Date(),
        suspendedAt: null,
        suspendedById: null,
        suspensionReason: null,
      },
    });

    await this.prisma.licenseRenewal.create({
      data: {
        tenantLicenseId: license.id,
        previousExpiryDate: previousExpiry,
        newExpiryDate,
        amount: dto.amount,
        invoiceNumber: dto.invoiceNumber,
        paymentMode: dto.paymentMode,
        notes: dto.notes,
        updatedById: user.sub,
      },
    });

    await this.audit.log(
      license.id,
      'LICENSE_RENEWED',
      user.sub,
      { expiryDate: previousExpiry },
      {
        expiryDate: newExpiryDate,
        amount: dto.amount,
      },
    );

    return updated;
  }

  async extend(tenantId: string, dto: ExtendLicenseDto, user: JwtUser) {
    const license = await this.requireLicense(tenantId);
    const previousExpiry = license.expiryDate;
    const newExpiryDate = new Date(dto.newExpiryDate);

    const updated = await this.prisma.tenantLicense.update({
      where: { id: license.id },
      data: { expiryDate: newExpiryDate },
    });

    await this.audit.log(
      license.id,
      'LICENSE_EXTENDED',
      user.sub,
      { expiryDate: previousExpiry },
      {
        expiryDate: newExpiryDate,
        notes: dto.notes,
      },
    );

    return updated;
  }

  async suspend(tenantId: string, dto: SuspendLicenseDto, user: JwtUser) {
    const license = await this.requireLicense(tenantId);
    const updated = await this.prisma.tenantLicense.update({
      where: { id: license.id },
      data: {
        suspendedAt: new Date(),
        suspendedById: user.sub,
        suspensionReason: dto.reason,
      },
    });
    await this.audit.log(license.id, 'LICENSE_SUSPENDED', user.sub, null, {
      reason: dto.reason,
    });
    return updated;
  }

  async activate(tenantId: string, user: JwtUser) {
    const license = await this.requireLicense(tenantId);
    const updated = await this.prisma.tenantLicense.update({
      where: { id: license.id },
      data: {
        suspendedAt: null,
        suspendedById: null,
        suspensionReason: null,
      },
    });
    await this.audit.log(
      license.id,
      'LICENSE_ACTIVATED',
      user.sub,
      null,
      updated,
    );
    return updated;
  }

  async auditTrail(tenantId: string) {
    const license = await this.requireLicense(tenantId);
    return this.audit.list(license.id);
  }

  private async requireLicense(tenantId: string) {
    const license = await this.prisma.tenantLicense.findUnique({
      where: { tenantId },
    });
    if (!license) throw new NotFoundException('License not found');
    return license;
  }

  private defaultExpiry(licenseType: string, startDate: Date): Date | null {
    if (licenseType === 'LIFETIME') return null;
    const days =
      LICENSE_TYPE_DAYS[licenseType as keyof typeof LICENSE_TYPE_DAYS];
    if (!days) return null;
    const d = new Date(startDate);
    d.setDate(d.getDate() + days);
    return d;
  }

  private async nextLicenseNumber() {
    const year = new Date().getFullYear();
    const count = await this.prisma.tenantLicense.count();
    return `BCL-${year}-${String(count + 1).padStart(4, '0')}`;
  }
}
