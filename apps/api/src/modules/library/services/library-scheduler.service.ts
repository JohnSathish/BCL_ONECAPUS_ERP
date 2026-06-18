import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../database/prisma.service';
import { LibraryFinesService } from './library-fines.service';
import { LibraryNotificationsService } from './library-notifications.service';

@Injectable()
export class LibrarySchedulerService {
  private readonly logger = new Logger(LibrarySchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: LibraryNotificationsService,
    private readonly fines: LibraryFinesService,
  ) {}

  /** Daily 9:00 — accrue running fines and send deduplicated overdue reminders. */
  @Cron('0 9 * * *')
  async runDailyLibraryJobs() {
    this.logger.log('Running daily library fine + overdue reminder jobs');
    const tenants = await this.prisma.tenant.findMany({
      where: { status: 'active', deletedAt: null },
      select: { id: true },
    });

    for (const tenant of tenants) {
      try {
        await this.fines.accrueDailyRunningFines(tenant.id);
        await this.notifications.processDueTomorrowReminders(tenant.id);
        await this.notifications.processOverdueReminders(tenant.id);
      } catch (err) {
        this.logger.warn(
          `Library daily job failed for tenant ${tenant.id}: ${String(err)}`,
        );
      }
    }
  }
}
