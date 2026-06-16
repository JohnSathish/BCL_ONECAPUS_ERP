import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../database/prisma.service';
import { BackupOrchestratorService } from './backup-orchestrator.service';
import { BackupRetentionService } from './backup-retention.service';

function nextDailyRunAt(from = new Date()) {
  const next = new Date(from);
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(2, 0, 0, 0);
  return next;
}

@Injectable()
export class BackupSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(BackupSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orchestrator: BackupOrchestratorService,
    private readonly retention: BackupRetentionService,
  ) {}

  async onModuleInit() {
    try {
      const existing = await this.prisma.backupSchedule.findFirst({
        where: { tenantId: null },
      });
      if (!existing) {
        await this.prisma.backupSchedule.create({
          data: {
            frequency: 'DAILY',
            backupType: 'DATABASE_DOCUMENTS',
            enabled: true,
            nextRunAt: nextDailyRunAt(),
          },
        });
        this.logger.log('Created default daily backup schedule (2:00 AM UTC)');
        return;
      }
      if (!existing.enabled || existing.frequency !== 'DAILY') {
        await this.prisma.backupSchedule.update({
          where: { id: existing.id },
          data: {
            frequency: 'DAILY',
            enabled: true,
            backupType: existing.backupType || 'DATABASE_DOCUMENTS',
            nextRunAt: existing.nextRunAt ?? nextDailyRunAt(),
          },
        });
        this.logger.log('Enabled daily backup schedule');
      }
    } catch (err) {
      this.logger.warn(`Backup schedule bootstrap skipped: ${String(err)}`);
    }
  }

  /** Daily auto backup at 2:00 AM (server local time). */
  @Cron('0 0 2 * * *')
  async runDailyBackup() {
    const schedule = await this.prisma.backupSchedule.findFirst({
      where: { tenantId: null, enabled: true },
    });
    if (!schedule) {
      this.logger.debug('No enabled instance backup schedule');
      return;
    }
    try {
      this.logger.log(
        `Starting scheduled daily backup (${schedule.backupType})`,
      );
      await this.orchestrator.triggerRun({
        type: schedule.backupType,
        triggeredBy: 'SCHEDULE',
      });
      await this.prisma.backupSchedule.update({
        where: { id: schedule.id },
        data: { nextRunAt: nextDailyRunAt() },
      });
    } catch (err) {
      this.logger.error(`Scheduled backup failed: ${String(err)}`);
    }
  }

  @Cron('0 30 3 * * *')
  async nightlyRetention() {
    await this.retention.cleanupExpired();
  }
}
