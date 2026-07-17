import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../database/prisma.service';
import { BirthdayNotificationService } from './birthday-notification.service';

@Injectable()
export class BirthdaySchedulerService {
  private readonly logger = new Logger(BirthdaySchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: BirthdayNotificationService,
  ) {}

  @Cron('0 8 * * *')
  async runDailyBirthdayScan() {
    this.logger.log('Running daily birthday notification scan');
    const year = new Date().getFullYear();
    const tenants = await this.prisma.tenant.findMany({
      where: { status: 'active', deletedAt: null },
      select: { id: true },
    });

    for (const tenant of tenants) {
      try {
        await this.scanTenant(tenant.id, year);
      } catch (err) {
        this.logger.error(
          `Birthday scan failed for tenant ${tenant.id}`,
          err instanceof Error ? err.stack : err,
        );
      }
    }
  }

  async scanTenant(tenantId: string, year = new Date().getFullYear()) {
    const rules = await this.prisma.communicationAutomationRule.findMany({
      where: {
        tenantId,
        code: { in: ['student.birthday.daily', 'staff.birthday.daily'] },
      },
      select: { code: true, isEnabled: true },
    });

    const studentRule = rules.find((r) => r.code === 'student.birthday.daily');
    const staffRule = rules.find((r) => r.code === 'staff.birthday.daily');

    const studentEnabled = studentRule?.isEnabled ?? true;
    const staffEnabled = staffRule?.isEnabled ?? true;

    if (studentEnabled) {
      await this.notifications.processTenantStudentBirthdays(tenantId, year);
    }
    if (staffEnabled) {
      await this.notifications.processTenantStaffBirthdays(tenantId, year);
    }
  }
}
