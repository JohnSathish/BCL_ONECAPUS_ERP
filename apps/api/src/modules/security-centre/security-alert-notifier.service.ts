import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { IpGeoService } from '../administration/services/ip-geo.service';
import { BrandedEmailLayoutService } from '../communication/services/branded-email-layout.service';
import { CommunicationEmailService } from '../communication/services/communication-email.service';
import { UserNotificationsService } from '../communication/services/user-notifications.service';
import type { LoginProtection } from './domain/login-protection';
import {
  buildSecurityAlertEmail,
  type SecurityAlertPerson,
} from './domain/security-alert-email';
import type { ThreatFinding } from './domain/threat-rules';

const SUPER_ADMIN_ROLES = ['college-admin', 'super-admin', 'university-admin'];

@Injectable()
export class SecurityAlertNotifier {
  private readonly logger = new Logger(SecurityAlertNotifier.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: UserNotificationsService,
    private readonly email: CommunicationEmailService,
    private readonly layout: BrandedEmailLayoutService,
    private readonly geo: IpGeoService,
    private readonly config: ConfigService,
  ) {}

  async notify(input: {
    tenantId: string;
    alertId: string;
    finding: ThreatFinding;
    policy: Pick<LoginProtection, 'notifyEmail' | 'notifyInApp'>;
    detectedAt?: Date;
    ipAddress?: string | null;
    actorUserId?: string | null;
    account?: string | null;
    lockExpiresAt?: Date | null;
  }) {
    const admins = await this.prisma.user.findMany({
      where: {
        tenantId: input.tenantId,
        deletedAt: null,
        isActive: true,
        roles: {
          some: {
            deletedAt: null,
            role: { slug: { in: SUPER_ADMIN_ROLES } },
          },
        },
      },
      select: { id: true, email: true },
      take: 25,
    });

    const body = [
      input.finding.summary,
      'Open Security Centre to investigate.',
      'This notice does not include passwords, access tokens, or student records.',
    ].join(' ');
    const message = input.policy.notifyEmail
      ? await this.alertMessage(input)
      : null;

    for (const admin of admins) {
      if (input.policy.notifyInApp) {
        try {
          await this.notifications.createInApp({
            tenantId: input.tenantId,
            userId: admin.id,
            type: 'SECURITY_ALERT',
            title: `Security alert: ${input.finding.title}`,
            body,
            link: '/admin/administration/security-centre',
            metadata: {
              entityType: 'security_alert',
              triggerKey: 'security.alert',
              alertId: input.alertId,
              severity: input.finding.severity,
              ruleCode: input.finding.ruleCode,
            },
          });
        } catch (error) {
          this.logger.warn(
            `In-app security notice failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      if (input.policy.notifyEmail && admin.email) {
        try {
          await this.email.send({
            to: admin.email,
            subject:
              message?.subject ??
              `[${input.finding.severity}] ${input.finding.title}`,
            text: message?.text ?? `${input.finding.title}\n\n${body}`,
            html: message?.html,
            fromName: message?.fromName,
          });
        } catch (error) {
          this.logger.warn(
            `Security email failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }
  }

  private async alertMessage(input: {
    tenantId: string;
    finding: ThreatFinding;
    detectedAt?: Date;
    ipAddress?: string | null;
    actorUserId?: string | null;
    account?: string | null;
    lockExpiresAt?: Date | null;
  }) {
    const ctx = await this.layout.resolveContext(input.tenantId);
    const person = await this.describePerson(input);
    const origin = (
      this.config.get<string>('PUBLIC_APP_URL') ??
      this.config.get<string>('WEB_APP_URL') ??
      ''
    ).replace(/\/$/, '');
    const built = buildSecurityAlertEmail({
      ctx,
      finding: input.finding,
      facts: {
        detectedAt: input.detectedAt ?? new Date(),
        lockExpiresAt: input.lockExpiresAt,
        person,
        securityCentreUrl: origin
          ? `${origin}/admin/administration/security-centre`
          : null,
      },
    });
    return {
      ...built,
      fromName: ctx.senderName || ctx.institutionName,
    };
  }

  private async describePerson(input: {
    tenantId: string;
    actorUserId?: string | null;
    account?: string | null;
    ipAddress?: string | null;
  }): Promise<SecurityAlertPerson> {
    const attempted = input.account?.trim() || null;
    const ipAddress = input.ipAddress?.trim() || null;
    const user = await this.findErpUser(
      input.tenantId,
      input.actorUserId,
      attempted,
    );
    let location: string | null = null;
    let network: string | null = null;
    try {
      const geo = await this.geo.lookup(ipAddress);
      const place = [geo.city, geo.region, geo.country]
        .filter(Boolean)
        .join(', ');
      location =
        place ||
        (isPrivateAddress(ipAddress) ? 'Private or local network' : null);
      network = geo.isp;
    } catch (error) {
      this.logger.warn(
        `Location lookup skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (!user) {
      return {
        kind: 'outsider',
        name: null,
        rollNumber: null,
        employeeCode: null,
        email: null,
        phone: null,
        attempted,
        ipAddress,
        location,
        network,
      };
    }
    return {
      kind: 'erp',
      name:
        user.displayName ||
        user.staffProfile?.fullName ||
        user.username ||
        user.email,
      rollNumber: user.student?.rollNumber ?? null,
      employeeCode: user.staffProfile?.employeeCode ?? null,
      email: user.email,
      phone: user.phone || user.staffProfile?.mobile || null,
      attempted,
      ipAddress,
      location,
      network,
    };
  }

  private findErpUser(
    tenantId: string,
    actorUserId: string | null | undefined,
    attempted: string | null,
  ) {
    const matches: Prisma.UserWhereInput[] = [];
    if (actorUserId) matches.push({ id: actorUserId });
    if (attempted) {
      matches.push(
        { email: { equals: attempted, mode: 'insensitive' } },
        { username: { equals: attempted, mode: 'insensitive' } },
        {
          student: {
            is: {
              deletedAt: null,
              OR: [
                { rollNumber: { equals: attempted, mode: 'insensitive' } },
                {
                  enrollmentNumber: { equals: attempted, mode: 'insensitive' },
                },
              ],
            },
          },
        },
        {
          staffProfile: {
            is: { employeeCode: { equals: attempted, mode: 'insensitive' } },
          },
        },
      );
    }
    if (!matches.length) return Promise.resolve(null);
    return this.prisma.user.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: matches,
      },
      select: {
        displayName: true,
        email: true,
        username: true,
        phone: true,
        student: {
          select: { rollNumber: true },
        },
        staffProfile: {
          select: { fullName: true, employeeCode: true, mobile: true },
        },
      },
    });
  }
}

function isPrivateAddress(ip: string | null) {
  if (!ip) return false;
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  );
}
