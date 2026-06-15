import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { ResolvedRecipient } from '../../communication/services/communication-audience.service';
import { CommunicationTriggerService } from '../../communication/services/communication-trigger.service';

@Injectable()
export class FeeReminderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly triggers: CommunicationTriggerService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  /** Manual bulk reminder for all students with outstanding fee demands. */
  async sendOutstandingReminders(tenantId: string, actorId?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const demands = await this.db().studentFeeDemand.findMany({
      where: {
        tenantId,
        status: { in: ['PUBLISHED', 'LOCKED', 'PARTIALLY_PAID'] },
        balanceAmount: { gt: 0 },
      },
      orderBy: [{ studentId: 'asc' }, { dueDate: 'asc' }],
      take: 2000,
    });

    const institutionName = await this.triggers.getInstitutionName(tenantId);
    const studentCache = new Map<string, Record<string, unknown>>();
    let sent = 0;
    const studentIds = new Set<string>();

    for (const demand of demands) {
      let student = studentCache.get(demand.studentId);
      if (!student) {
        student = await this.db().student.findFirst({
          where: { id: demand.studentId, tenantId, deletedAt: null },
          include: {
            user: { select: { id: true, email: true, displayName: true } },
            masterProfile: {
              select: { fullName: true, email: true, mobileNumber: true },
            },
          },
        });
        if (student) studentCache.set(demand.studentId, student);
      }
      if (!student?.user) continue;

      const recipient: ResolvedRecipient = {
        recipientType: 'STUDENT',
        userId: String(student.userId ?? (student.user as { id: string }).id),
        studentId: demand.studentId,
        displayName:
          (student.masterProfile as { fullName?: string })?.fullName ??
          (student.user as { displayName?: string }).displayName ??
          (student.user as { email: string }).email,
        email:
          (student.masterProfile as { email?: string })?.email ??
          (student.user as { email: string }).email,
        phone: (student.masterProfile as { mobileNumber?: string })
          ?.mobileNumber,
      };

      const isOverdue = demand.dueDate && new Date(demand.dueDate) < today;

      await this.triggers.trigger({
        tenantId,
        templateCode: 'FEE_REMINDER',
        triggerKey: isOverdue ? 'fee.overdue_manual' : 'fee.outstanding_manual',
        entityType: 'fee_demand',
        entityId: demand.id,
        recipient,
        variables: {
          student_name: recipient.displayName,
          amount: String(demand.balanceAmount),
          due_date: demand.dueDate
            ? new Date(demand.dueDate).toISOString().slice(0, 10)
            : '',
          demand_no: demand.demandNo,
          institution_name: institutionName,
          triggered_by: actorId ?? 'admin',
        },
        channels: ['EMAIL', 'IN_APP'],
      });

      sent += 1;
      studentIds.add(demand.studentId);
    }

    return {
      demandsNotified: sent,
      studentsNotified: studentIds.size,
      message: `Queued ${sent} fee reminder(s) for ${studentIds.size} student(s).`,
    };
  }
}
