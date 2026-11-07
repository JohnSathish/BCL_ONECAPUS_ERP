import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CommunicationEmailService } from '../communication/services/communication-email.service';
import { UserNotificationsService } from '../communication/services/user-notifications.service';
import type { LoginProtection } from './domain/login-protection';
import type { ThreatFinding } from './domain/threat-rules';

const SUPER_ADMIN_ROLES = ['college-admin', 'super-admin', 'university-admin'];

@Injectable()
export class SecurityAlertNotifier {
  private readonly logger = new Logger(SecurityAlertNotifier.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: UserNotificationsService,
    private readonly email: CommunicationEmailService,
  ) {}

  async notify(input: {
    tenantId: string;
    alertId: string;
    finding: ThreatFinding;
    policy: Pick<LoginProtection, 'notifyEmail' | 'notifyInApp'>;
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
            subject: `[${input.finding.severity}] ${input.finding.title}`,
            text: `${input.finding.title}\n\n${body}`,
          });
        } catch (error) {
          this.logger.warn(
            `Security email failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }
  }
}
