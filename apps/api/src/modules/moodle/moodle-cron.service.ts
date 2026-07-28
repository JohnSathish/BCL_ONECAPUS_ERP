import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { MoodleSyncQueueService } from './moodle-sync-queue.service';

@Injectable()
export class MoodleCronService {
  private readonly logger = new Logger(MoodleCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: MoodleSyncQueueService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async syncUsersAndEnrollments() {
    await this.forEnabledTenants(async (tenantId) => {
      await this.queue.enqueueSyncRun(tenantId, 'USERS', 'cron');
      await this.queue.enqueueSyncRun(tenantId, 'ENROLLMENTS', 'cron');
    });
  }

  @Cron('*/10 * * * *')
  async syncGradesAndAttendance() {
    await this.forEnabledTenants(async (tenantId) => {
      await this.queue.enqueueSyncRun(tenantId, 'GRADES', 'cron');
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async syncCoursesDaily() {
    await this.forEnabledTenants(async (tenantId) => {
      await this.queue.enqueueSyncRun(tenantId, 'COURSES', 'cron');
    });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async syncNotifications() {
    await this.forEnabledTenants(async (tenantId) => {
      const cfg = await this.prisma.moodleSettings.findUnique({
        where: { tenantId },
      });
      if (!cfg?.enableNotificationSync) return;
      await this.queue.enqueueNotificationPoll(tenantId);
    });
  }

  private async forEnabledTenants(fn: (tenantId: string) => Promise<void>) {
    const tenants = await this.prisma.moodleSettings.findMany({
      where: {
        enableSync: true,
        moodleUrl: { not: null },
        wsTokenEncrypted: { not: null },
      },
      select: { tenantId: true },
    });
    for (const row of tenants) {
      try {
        await fn(row.tenantId);
      } catch (err) {
        this.logger.warn(
          `Moodle cron enqueue failed tenant=${row.tenantId}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }
}
