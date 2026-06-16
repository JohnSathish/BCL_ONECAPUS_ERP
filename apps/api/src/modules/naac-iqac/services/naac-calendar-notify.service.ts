import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { UserNotificationsService } from '../../communication/services/user-notifications.service';
import { naacDb } from './naac-prisma.util';

@Injectable()
export class NaacCalendarNotifyService {
  private readonly logger = new Logger(NaacCalendarNotifyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: UserNotificationsService,
  ) {}

  private db() {
    return naacDb(this.prisma);
  }

  private async resolveNaacManagers(tenantId: string): Promise<string[]> {
    const rows = await this.prisma.userRole.findMany({
      where: {
        deletedAt: null,
        role: {
          tenantId,
          permissions: {
            some: {
              permission: {
                slug: { in: ['naac-iqac:manage', 'naac-iqac:read'] },
              },
            },
          },
        },
      },
      select: { userId: true },
      take: 100,
    });
    return [...new Set(rows.map((r) => r.userId))];
  }

  async notifyEventCreated(
    tenantId: string,
    event: { id: string; title: string; dueDate: Date; eventType: string },
  ) {
    const managers = await this.resolveNaacManagers(tenantId);
    const due = new Date(event.dueDate).toLocaleDateString('en-IN');
    for (const userId of managers) {
      await this.notifications.createInApp({
        tenantId,
        userId,
        type: 'NAAC_CALENDAR',
        title: `NAAC calendar: ${event.title}`,
        body: `${event.eventType} due ${due}`,
        link: '/admin/naac/calendar',
        metadata: { eventId: event.id },
      });
    }
    return { notified: managers.length };
  }

  async processUpcomingReminders(tenantId: string) {
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const events = await this.db().naacCalendarEvent.findMany({
      where: {
        tenantId,
        status: 'UPCOMING',
        dueDate: { gte: now, lte: in7 },
      },
    });
    if (!events.length) return { notified: 0 };

    const managers = await this.resolveNaacManagers(tenantId);
    let notified = 0;

    for (const event of events) {
      const link = `/admin/naac/calendar?event=${event.id}`;
      const due = new Date(event.dueDate).toLocaleDateString('en-IN');
      for (const userId of managers) {
        const existing = await this.prisma.userNotification.count({
          where: {
            tenantId,
            userId,
            type: 'NAAC_CALENDAR_REMINDER',
            link,
          },
        });
        if (existing > 0) continue;

        await this.notifications.createInApp({
          tenantId,
          userId,
          type: 'NAAC_CALENDAR_REMINDER',
          title: `NAAC deadline in 7 days: ${event.title}`,
          body: `${event.eventType} due ${due}`,
          link,
          metadata: { eventId: event.id },
        });
        notified += 1;
      }
    }

    this.logger.debug(`NAAC calendar reminders sent: ${notified}`);
    return { notified };
  }
}
