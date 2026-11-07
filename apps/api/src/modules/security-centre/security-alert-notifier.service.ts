import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { BrandedEmailLayoutService } from '../communication/services/branded-email-layout.service';
import { CommunicationEmailService } from '../communication/services/communication-email.service';
import { UserNotificationsService } from '../communication/services/user-notifications.service';
import type { LoginProtection } from './domain/login-protection';
import { buildSecurityAlertEmail } from './domain/security-alert-email';
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
    private readonly config: ConfigService,
  ) {}

  async notify(input: {
    tenantId: string;
    alertId: string;
    finding: ThreatFinding;
    policy: Pick<LoginProtection, 'notifyEmail' | 'notifyInApp'>;
    detectedAt?: Date;
    ipAddress?: string | null;
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
    account?: string | null;
    lockExpiresAt?: Date | null;
  }) {
    const ctx = await this.layout.resolveContext(input.tenantId);
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
        ipAddress: input.ipAddress,
        account: input.account,
        lockExpiresAt: input.lockExpiresAt,
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
}
