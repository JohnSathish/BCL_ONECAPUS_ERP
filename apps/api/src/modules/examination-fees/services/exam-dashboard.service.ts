import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { EXAM_APPLICATION_STATUSES } from '../constants/exam-fee.constants';
import { toNumber } from '../utils/exam-fee.util';
import { ExamFeeSessionService } from './exam-fee-session.service';

@Injectable()
export class ExamDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: ExamFeeSessionService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async summary(tenantId: string, sessionId?: string) {
    const session =
      (sessionId
        ? await this.sessions.get(tenantId, sessionId)
        : await this.sessions.getActive(tenantId)) ?? null;

    const where = {
      tenantId,
      ...(session ? { sessionId: session.id } : {}),
    };

    const apps = await this.db().examApplication.findMany({
      where,
      include: { backPapers: true, payments: true },
    });

    const payments = await this.db().examPayment.findMany({
      where: {
        tenantId,
        status: 'SUCCESS',
        ...(session ? { application: { sessionId: session.id } } : {}),
      },
    });

    const submitted = apps.filter(
      (a: any) => a.status !== EXAM_APPLICATION_STATUSES.DRAFT,
    ).length;
    const pendingPayments = apps.filter((a: any) =>
      [
        EXAM_APPLICATION_STATUSES.AWAITING_PAYMENT,
        EXAM_APPLICATION_STATUSES.SUBMITTED,
      ].includes(a.status),
    ).length;
    const paid = apps.filter((a: any) =>
      [
        EXAM_APPLICATION_STATUSES.PAID,
        EXAM_APPLICATION_STATUSES.MANUAL_PAID,
        EXAM_APPLICATION_STATUSES.UNDER_VERIFICATION,
        EXAM_APPLICATION_STATUSES.APPROVED,
      ].includes(a.status),
    ).length;
    const manualPayments = payments.filter(
      (p: any) => p.channel === 'MANUAL',
    ).length;
    const onlinePayments = payments.filter(
      (p: any) => p.channel === 'ONLINE',
    ).length;
    const totalCollection = payments.reduce(
      (sum: number, p: any) => sum + toNumber(p.amount),
      0,
    );
    const withBackPapers = apps.filter(
      (a: any) => (a.backPapers?.length ?? 0) > 0,
    ).length;
    const onlineSuccessRate =
      onlinePayments + pendingPayments > 0
        ? Math.round(
            (onlinePayments / Math.max(onlinePayments + pendingPayments, 1)) *
              100,
          )
        : 0;

    const byDepartment = new Map<string, number>();
    const bySemester = new Map<number, number>();
    const byStatus = new Map<string, number>();
    const daily = new Map<string, number>();

    for (const app of apps) {
      const dept = app.departmentName || 'Unknown';
      byDepartment.set(dept, (byDepartment.get(dept) ?? 0) + 1);
      bySemester.set(
        app.currentSemesterNo,
        (bySemester.get(app.currentSemesterNo) ?? 0) + 1,
      );
      byStatus.set(app.status, (byStatus.get(app.status) ?? 0) + 1);
    }
    for (const p of payments) {
      if (!p.paidAt) continue;
      const key = new Date(p.paidAt).toISOString().slice(0, 10);
      daily.set(key, (daily.get(key) ?? 0) + toNumber(p.amount));
    }

    return {
      session,
      cards: {
        currentSession: session?.name ?? 'None',
        applicationsSubmitted: submitted,
        pendingPayments,
        paidApplications: paid,
        manualPayments,
        totalCollection,
        studentsWithBackPapers: withBackPapers,
        onlinePaymentSuccessRate: onlineSuccessRate,
      },
      charts: {
        departmentWise: [...byDepartment.entries()].map(([name, count]) => ({
          name,
          count,
        })),
        semesterWise: [...bySemester.entries()].map(([semester, count]) => ({
          semester,
          count,
        })),
        paymentStatus: [...byStatus.entries()].map(([status, count]) => ({
          status,
          count,
        })),
        dailyCollection: [...daily.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([date, amount]) => ({ date, amount })),
      },
    };
  }
}
