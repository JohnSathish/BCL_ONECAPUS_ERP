import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../database/prisma.service';
import { LibraryAnalyticsService } from './library-analytics.service';
import { LibraryFinesService } from './library-fines.service';
import { LibraryMembersService } from './library-members.service';
import { LibraryNotificationsService } from './library-notifications.service';

@Injectable()
export class LibrarySchedulerService {
  private readonly logger = new Logger(LibrarySchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: LibraryNotificationsService,
    private readonly fines: LibraryFinesService,
    private readonly analytics: LibraryAnalyticsService,
    private readonly members: LibraryMembersService,
  ) {}

  /** Every five minutes — close library visits left open for more than one hour. */
  @Cron('*/5 * * * *')
  async closeStaleLibraryVisits() {
    const tenants = await this.prisma.tenant.findMany({
      where: { status: 'active', deletedAt: null },
      select: { id: true },
    });
    for (const tenant of tenants) {
      try {
        const closed = await this.analytics.closeStaleOpenVisits(tenant.id);
        if (Number(closed) > 0) {
          this.logger.log(
            `Auto-signed out ${closed} library visit(s) for tenant ${tenant.id}`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `Library auto sign-out failed for tenant ${tenant.id}: ${String(err)}`,
        );
      }
    }
  }

  /** Daily 9:00 — fines, overdue reminders, and library membership sync. */
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
        await this.members.sync(tenant.id, 'ALL', null);
      } catch (err) {
        this.logger.warn(
          `Library daily job failed for tenant ${tenant.id}: ${String(err)}`,
        );
      }
    }
  }
}
