import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../database/prisma.service';
import { CommunicationTriggerService } from '../../communication/services/communication-trigger.service';
import { RENEWAL_CONTACT } from '../licensing.types';
import { LicenseStatusService } from './license-status.service';

const MILESTONES = [60, 30, 15, 7, 0];
const TEMPLATE_BY_MILESTONE: Record<number, string> = {
  60: 'LICENSE_EXPIRY_60',
  30: 'LICENSE_EXPIRY_30',
  15: 'LICENSE_EXPIRY_15',
  7: 'LICENSE_EXPIRY_7',
  0: 'LICENSE_EXPIRY_0',
};

const ADMIN_ROLE_SLUGS = [
  'college-admin',
  'erp-administrator',
  'institution-admin',
  'super-admin',
];

@Injectable()
export class LicenseSchedulerService {
  private readonly logger = new Logger(LicenseSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly status: LicenseStatusService,
    private readonly triggers: CommunicationTriggerService,
  ) {}

  @Cron('0 7 * * *')
  async runExpiryReminders() {
    this.logger.log('Running daily license expiry reminder scan');
    const licenses = await this.prisma.tenantLicense.findMany({
      where: { suspendedAt: null },
      include: { tenant: { select: { id: true, name: true } } },
    });

    for (const license of licenses) {
      await this.processLicense(license);
    }
  }

  private async processLicense(license: {
    id: string;
    tenantId: string;
    expiryDate: Date | null;
    gracePeriodDays: number;
    suspendedAt: Date | null;
    suspendedById: string | null;
    suspensionReason: string | null;
    licenseNumber: string;
    licenseType: string;
    subscriptionPlan: string;
    startDate: Date;
    renewalDate: Date | null;
    maxStudents: number | null;
    maxStaff: number | null;
    storageLimitMb: number | null;
    internalNotes: string | null;
    tenant: { id: string; name: string };
  }) {
    const computed = this.status.compute(license);
    if (computed.daysRemaining === null && computed.status !== 'EXPIRED')
      return;

    const milestone = MILESTONES.find((m) => computed.daysRemaining === m);
    if (milestone === undefined && computed.status !== 'EXPIRED') return;
    const effectiveMilestone = computed.status === 'EXPIRED' ? 0 : milestone!;

    for (const channel of ['IN_APP', 'EMAIL'] as const) {
      const exists = await this.prisma.licenseNotificationLog.findUnique({
        where: {
          tenantLicenseId_milestoneDays_channel: {
            tenantLicenseId: license.id,
            milestoneDays: effectiveMilestone,
            channel,
          },
        },
      });
      if (exists) continue;

      const admins = await this.findTenantAdmins(license.tenantId);
      for (const admin of admins) {
        await this.triggers.trigger({
          tenantId: license.tenantId,
          templateCode: TEMPLATE_BY_MILESTONE[effectiveMilestone],
          triggerKey: `license.expiry.${effectiveMilestone}.${license.id}.${admin.userId}`,
          entityType: 'tenant_license',
          entityId: license.id,
          recipient: {
            recipientType: 'USER',
            userId: admin.userId,
            displayName: admin.displayName,
            email: admin.email,
          },
          variables: {
            institution_name: license.tenant.name,
            expiry_date:
              license.expiryDate?.toISOString().slice(0, 10) ?? 'N/A',
            days_remaining: String(computed.daysRemaining ?? 0),
            renewal_contact: `${RENEWAL_CONTACT.company} — ${RENEWAL_CONTACT.mobile}`,
          },
          channels: [channel],
        });
      }

      await this.prisma.licenseNotificationLog.create({
        data: {
          tenantLicenseId: license.id,
          milestoneDays: effectiveMilestone,
          channel,
        },
      });
    }
  }

  private async findTenantAdmins(tenantId: string) {
    const roles = await this.prisma.role.findMany({
      where: { tenantId, slug: { in: ADMIN_ROLE_SLUGS } },
      select: { id: true },
    });
    if (!roles.length) return [];

    const userRoles = await this.prisma.userRole.findMany({
      where: { roleId: { in: roles.map((r) => r.id) } },
      include: {
        user: { select: { id: true, email: true, displayName: true } },
      },
    });

    return userRoles.map((ur) => ({
      userId: ur.user.id,
      email: ur.user.email,
      displayName: ur.user.displayName ?? ur.user.email,
    }));
  }
}
