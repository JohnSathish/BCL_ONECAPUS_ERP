import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CommunicationTriggerService } from '../../communication/services/communication-trigger.service';

@Injectable()
export class BackupNotificationService {
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

    const admins = await this.prisma.user.findMany({
      where: {
        tenantId: tenant.id,
        isActive: true,
        accountStatus: 'active',
        roles: {
          some: {
            role: { slug: { in: ['college-admin', 'super-admin'] } },
          },
        },
      },
      select: { id: true, email: true, displayName: true },
      take: 20,
    });

    const templateCode = success ? 'BACKUP_SUCCESS' : 'BACKUP_FAILED';
    const institutionName = await this.triggers.getInstitutionName(tenant.id);
    const vars = {
      institution_name: institutionName,
      backup_type: run.type,
      completed_at: (run.completedAt ?? new Date()).toISOString(),
      size_bytes: run.sizeBytes.toString(),
      run_id: run.id,
      error_message: errorMessage ?? run.errorMessage ?? 'Unknown error',
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
}
