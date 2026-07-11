import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CommunicationTriggerService } from '../../communication/services/communication-trigger.service';

const BACKUP_ADMIN_ROLE_SLUGS = [
  'college-admin',
  'super-admin',
  'institution-admin',
  'platform-admin',
] as const;

const EXCLUDED_RECIPIENT_ROLES = new Set([
  'student',
  'applicant',
  'parent',
  'faculty',
  'teacher',
  'teaching-staff',
  'non-teaching-staff',
]);

@Injectable()
export class BackupNotificationService {
  private readonly logger = new Logger(BackupNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly triggers: CommunicationTriggerService,
  ) {}

  async notifyRunComplete(
    runId: string,
    success: boolean,
    errorMessage?: string,
  ) {
    const run = await this.prisma.backupRun.findUnique({
      where: { id: runId },
    });
    if (!run) return;

    const tenant = run.tenantId
      ? await this.prisma.tenant.findUnique({ where: { id: run.tenantId } })
      : await this.prisma.tenant.findFirst({ where: { slug: 'demo' } });
    if (!tenant) return;

    const admins = await this.resolveBackupAdmins(tenant.id);
    if (!admins.length) {
      this.logger.warn(
        `No backup admin recipients for tenant ${tenant.id} (run ${runId})`,
      );
      return;
    }

    const templateCode = success ? 'BACKUP_SUCCESS' : 'BACKUP_FAILED';
    const institutionName = await this.triggers.getInstitutionName(tenant.id);
    const vars = {
      institution_name: institutionName,
      backup_type: run.type,
      completed_at: (run.completedAt ?? new Date()).toISOString(),
      size_bytes: run.sizeBytes.toString(),
      run_id: run.id,
      error_message: errorMessage ?? run.errorMessage ?? 'Unknown error',
      report_summary: success
        ? `${run.type} completed (${run.sizeBytes} bytes)`
        : `Failed: ${errorMessage ?? run.errorMessage ?? 'Unknown error'}`,
    };

    for (const admin of admins) {
      await this.triggers.trigger({
        tenantId: tenant.id,
        templateCode,
        triggerKey: `backup.${runId}.${admin.id}`,
        entityType: 'backup_run',
        entityId: runId,
        recipient: {
          recipientType: 'USER',
          userId: admin.id,
          displayName: admin.displayName ?? 'Admin',
          email: admin.email ?? undefined,
        },
        variables: vars,
        channels: ['EMAIL', 'IN_APP'],
        skipDedupe: true,
      });
    }
  }

  /** Admin portal users only — never students or staff-only accounts. */
  private async resolveBackupAdmins(tenantId: string) {
    const candidates = await this.prisma.user.findMany({
      where: {
        tenantId,
        deletedAt: null,
        isActive: true,
        accountStatus: 'active',
        OR: [
          {
            roles: {
              some: {
                deletedAt: null,
                role: {
                  deletedAt: null,
                  slug: { in: [...BACKUP_ADMIN_ROLE_SLUGS] },
                },
              },
            },
          },
          {
            roles: {
              some: {
                deletedAt: null,
                role: {
                  deletedAt: null,
                  permissions: {
                    some: {
                      permission: {
                        slug: { in: ['backup:read', 'backup:manage'] },
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        roles: {
          where: { deletedAt: null },
          select: { role: { select: { slug: true } } },
        },
      },
      take: 80,
    });

    const admins = candidates.filter((user) => {
      const slugs = user.roles.map((r) => r.role.slug);
      const hasAdminRole = slugs.some((s) =>
        (BACKUP_ADMIN_ROLE_SLUGS as readonly string[]).includes(s),
      );
      const onlyExcluded =
        slugs.length > 0 && slugs.every((s) => EXCLUDED_RECIPIENT_ROLES.has(s));
      if (onlyExcluded) return false;
      if (slugs.includes('student') && !hasAdminRole) return false;
      return (
        hasAdminRole || slugs.some((s) => !EXCLUDED_RECIPIENT_ROLES.has(s))
      );
    });

    return admins.map(({ id, email, displayName }) => ({
      id,
      email,
      displayName,
    }));
  }
}
