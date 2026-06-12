import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { LICENSE_TYPE_LABELS, RENEWAL_CONTACT } from '../licensing.types';
import { LicenseAuditService } from './license-audit.service';
import { LicenseStatusService } from './license-status.service';
import { LicenseUsageService } from './license-usage.service';

@Injectable()
export class LicenseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly status: LicenseStatusService,
    private readonly usage: LicenseUsageService,
    private readonly audit: LicenseAuditService,
  ) {}

  async getSummary(tenantId: string) {
    const license = await this.requireLicense(tenantId);
    const computed = this.status.compute(license);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    return {
      licenseNumber: license.licenseNumber,
      institutionName: tenant?.name ?? '',
      licenseType: license.licenseType,
      subscriptionPlan: license.subscriptionPlan,
      startDate: license.startDate,
      expiryDate: license.expiryDate,
      renewalDate: license.renewalDate,
      gracePeriodDays: license.gracePeriodDays,
      ...computed,
      alertMessage: this.status.alertMessage(
        computed.status,
        computed.daysRemaining,
      ),
      showMarquee: this.status.showMarquee(
        computed.status,
        computed.daysRemaining,
      ),
      renewalContact: RENEWAL_CONTACT,
    };
  }

  async getDetails(tenantId: string) {
    const license = await this.prisma.tenantLicense.findUnique({
      where: { tenantId },
    });
    const usage = await this.usage.getUsage(tenantId);

    if (!license) {
      return {
        hasLicense: false,
        usage,
        limits: { maxStudents: null, maxStaff: null, storageLimitMb: null },
        renewalHistory: [],
        renewalContact: RENEWAL_CONTACT,
      };
    }

    const computed = this.status.compute(license);
    const renewals = await this.prisma.licenseRenewal.findMany({
      where: { tenantLicenseId: license.id },
      orderBy: { renewedAt: 'desc' },
      take: 20,
    });

    return {
      hasLicense: true,
      ...this.stripSensitive(await this.getSummary(tenantId)),
      usage,
      limits: {
        maxStudents: license.maxStudents,
        maxStaff: license.maxStaff,
        storageLimitMb: license.storageLimitMb,
      },
      blockingDate: computed.blockingDate,
      renewalHistory: renewals.map((r) => ({
        id: r.id,
        renewedAt: r.renewedAt,
        previousExpiryDate: r.previousExpiryDate,
        newExpiryDate: r.newExpiryDate,
        notes: r.notes,
      })),
    };
  }

  getRenewalContact() {
    return RENEWAL_CONTACT;
  }

  private stripSensitive(
    summary: Awaited<ReturnType<LicenseService['getSummary']>>,
  ) {
    return summary;
  }

  private async requireLicense(tenantId: string) {
    const license = await this.prisma.tenantLicense.findUnique({
      where: { tenantId },
    });
    if (!license) {
      throw new NotFoundException('No license configured for this institution');
    }
    return license;
  }

  static planLabel(licenseType: string) {
    return (
      LICENSE_TYPE_LABELS[licenseType as keyof typeof LICENSE_TYPE_LABELS] ??
      licenseType
    );
  }
}
