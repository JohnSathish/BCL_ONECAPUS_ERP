import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';

@Injectable()
export class CommunicationAutomationService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.communicationAutomationRule.findMany({
      where: { tenantId },
      orderBy: { category: 'asc' },
    });
  }

  async seedDefaults(tenantId: string) {
    const defaults = [
      {
        code: 'fee.reminder.30d',
        name: 'Fee Due — 30 Days Before',
        category: 'FEES',
        schedule: '0 8 * * *',
        templateCode: 'FEE_REMINDER',
      },
      {
        code: 'fee.reminder.15d',
        name: 'Fee Due — 15 Days Before',
        category: 'FEES',
        schedule: '0 8 * * *',
        templateCode: 'FEE_REMINDER',
      },
      {
        code: 'fee.reminder.7d',
        name: 'Fee Due — 7 Days Before',
        category: 'FEES',
        schedule: '0 8 * * *',
        templateCode: 'FEE_REMINDER',
      },
      {
        code: 'fee.reminder.1d',
        name: 'Fee Due — 1 Day Before',
        category: 'FEES',
        schedule: '0 8 * * *',
        templateCode: 'FEE_REMINDER',
      },
      {
        code: 'attendance.below.75',
        name: 'Attendance Below 75%',
        category: 'ATTENDANCE',
        schedule: '0 9 * * 1',
        templateCode: 'ATTENDANCE_WARNING',
      },
      {
        code: 'attendance.below.60',
        name: 'Attendance Below 60%',
        category: 'ATTENDANCE',
        schedule: '0 9 * * 1',
        templateCode: 'ATTENDANCE_WARNING',
      },
      {
        code: 'library.due.reminder',
        name: 'Book Due Reminder',
        category: 'LIBRARY',
        schedule: '0 9 * * *',
        templateCode: 'LIBRARY_DUE_REMINDER',
      },
      {
        code: 'hr.probation.30d',
        name: 'Probation End — 30 Days',
        category: 'HR',
        schedule: '0 8 * * *',
        templateCode: 'HR_PROBATION_REMINDER',
      },
      {
        code: 'hr.probation.15d',
        name: 'Probation End — 15 Days',
        category: 'HR',
        schedule: '0 8 * * *',
        templateCode: 'HR_PROBATION_REMINDER',
      },
      {
        code: 'hr.probation.7d',
        name: 'Probation End — 7 Days',
        category: 'HR',
        schedule: '0 8 * * *',
        templateCode: 'HR_PROBATION_REMINDER',
      },
    ];

    for (const rule of defaults) {
      await this.prisma.communicationAutomationRule.upsert({
        where: { tenantId_code: { tenantId, code: rule.code } },
        create: { tenantId, ...rule, channels: ['EMAIL', 'IN_APP', 'SMS'] },
        update: { name: rule.name, schedule: rule.schedule },
      });
    }
    return this.list(tenantId);
  }

  toggle(user: JwtUser, id: string, isEnabled: boolean) {
    return this.prisma.communicationAutomationRule.updateMany({
      where: { id, tenantId: user.tid },
      data: { isEnabled },
    });
  }
}
