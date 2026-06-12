import { Injectable, Logger } from '@nestjs/common';

import { randomUUID } from 'crypto';

import { PrismaService } from '../../../database/prisma.service';

import { CommunicationTriggerService } from '../../communication/services/communication-trigger.service';

import {
  calculateOverdueFine,
  startOfUtcDay,
} from '../utils/library-fine.util';

import { LibrarySettingsService } from './library-settings.service';

@Injectable()
export class LibraryNotificationsService {
  private readonly logger = new Logger(LibraryNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,

    private readonly communication: CommunicationTriggerService,

    private readonly settings: LibrarySettingsService,
  ) {}

  private async studentRecipient(tenantId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { tenantId, id: studentId, deletedAt: null },

      include: {
        masterProfile: true,
        user: { select: { id: true, email: true } },
      },
    });

    if (!student?.userId) return null;

    return {
      recipientType: 'STUDENT' as const,

      userId: student.userId,

      studentId: student.id,

      displayName: student.masterProfile?.fullName ?? student.enrollmentNumber,

      email: student.masterProfile?.email ?? student.user?.email ?? undefined,
    };
  }

  async notifyReservationReady(tenantId: string, reservationId: string) {
    const reservation = await this.prisma.libraryReservation.findFirst({
      where: { tenantId, id: reservationId },

      include: { book: { select: { title: true } } },
    });

    if (!reservation) return;

    const recipient = await this.studentRecipient(
      tenantId,
      reservation.studentId,
    );

    if (!recipient) return;

    await this.communication.trigger({
      tenantId,

      templateCode: 'LIBRARY_RESERVATION_READY',

      triggerKey: 'library.reservation.ready',

      entityType: 'library_reservation',

      entityId: reservation.id,

      recipient,

      variables: {
        student_name: recipient.displayName,

        book_title: reservation.book?.title ?? 'Book',

        institution_name: 'Library',
      },

      channels: ['IN_APP', 'EMAIL'],
    });
  }

  async notifyOverdueLoan(tenantId: string, loanId: string) {
    const loan = await this.prisma.libraryLoan.findFirst({
      where: { tenantId, id: loanId, status: 'ACTIVE' },

      include: { copy: { include: { book: { select: { title: true } } } } },
    });

    if (!loan?.studentId) return;

    const recipient = await this.studentRecipient(tenantId, loan.studentId);

    if (!recipient) return;

    const libSettings = await this.settings.getSettings(tenantId);

    const projectedFine = calculateOverdueFine(
      loan.dueAt,
      new Date(),
      libSettings,
    );

    await this.communication.trigger({
      tenantId,

      templateCode: 'LIBRARY_OVERDUE',

      triggerKey: 'library.loan.overdue',

      entityType: 'library_loan',

      entityId: loan.id,

      recipient,

      variables: {
        student_name: recipient.displayName,

        book_title: loan.copy.book.title,

        due_date: loan.dueAt.toLocaleDateString('en-IN'),

        projected_fine: String(projectedFine),

        institution_name: 'Library',
      },

      channels: ['IN_APP', 'EMAIL'],
    });
  }

  async processOverdueReminders(tenantId: string) {
    const libSettings = await this.settings.getSettings(tenantId);

    if (!libSettings.overdueNotifyEnabled) {
      return { checked: 0, sent: 0, skipped: true };
    }

    const sentOn = startOfUtcDay();

    const overdue = await this.prisma.libraryLoan.findMany({
      where: { tenantId, status: 'ACTIVE', dueAt: { lt: new Date() } },

      include: { copy: { include: { book: { select: { title: true } } } } },

      take: 200,
    });

    let sent = 0;

    for (const loan of overdue) {
      if (!loan.studentId) continue;

      const alreadySent = await this.prisma.libraryOverdueReminderLog.findFirst(
        {
          where: { tenantId, loanId: loan.id, sentOn },
        },
      );

      if (alreadySent) continue;

      try {
        const recipient = await this.studentRecipient(tenantId, loan.studentId);

        if (!recipient) continue;

        const projectedFine = calculateOverdueFine(
          loan.dueAt,
          new Date(),
          libSettings,
        );

        const result = await this.communication.trigger({
          tenantId,

          templateCode: 'LIBRARY_OVERDUE',

          triggerKey: 'library.loan.overdue',

          entityType: 'library_loan',

          entityId: loan.id,

          recipient,

          variables: {
            student_name: recipient.displayName,

            book_title: loan.copy.book.title,

            due_date: loan.dueAt.toLocaleDateString('en-IN'),

            projected_fine: String(projectedFine),

            institution_name: 'Library',
          },

          channels: ['IN_APP', 'EMAIL'],
        });

        if (!result.skipped) {
          sent++;

          await this.prisma.libraryOverdueReminderLog.create({
            data: {
              id: randomUUID(),

              tenantId,

              loanId: loan.id,

              sentOn,
            },
          });
        }
      } catch (err) {
        this.logger.warn(
          `Overdue notify failed for loan ${loan.id}: ${String(err)}`,
        );
      }
    }

    return { checked: overdue.length, sent };
  }
}
