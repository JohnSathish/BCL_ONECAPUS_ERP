import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { ExamReportQueryDto } from '../dto/examination-fees.dto';
import { toNumber } from '../utils/exam-fee.util';

@Injectable()
export class ExamReportService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  private dateFilter(from?: string, to?: string) {
    if (!from && !to) return undefined;
    return {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  async collectionByDepartment(tenantId: string, query: ExamReportQueryDto) {
    const apps = await this.db().examApplication.findMany({
      where: {
        tenantId,
        ...(query.sessionId ? { sessionId: query.sessionId } : {}),
        paidAt: this.dateFilter(query.from, query.to),
        status: {
          in: ['PAID', 'MANUAL_PAID', 'UNDER_VERIFICATION', 'APPROVED'],
        },
      },
    });
    const map = new Map<string, { count: number; amount: number }>();
    for (const app of apps) {
      const key = app.departmentName || 'Unknown';
      const cur = map.get(key) ?? { count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += toNumber(app.totalFee);
      map.set(key, cur);
    }
    return [...map.entries()].map(([department, v]) => ({
      department,
      ...v,
    }));
  }

  async collectionBySemester(tenantId: string, query: ExamReportQueryDto) {
    const apps = await this.db().examApplication.findMany({
      where: {
        tenantId,
        ...(query.sessionId ? { sessionId: query.sessionId } : {}),
        paidAt: this.dateFilter(query.from, query.to),
        status: {
          in: ['PAID', 'MANUAL_PAID', 'UNDER_VERIFICATION', 'APPROVED'],
        },
      },
    });
    const map = new Map<number, { count: number; amount: number }>();
    for (const app of apps) {
      const key = app.currentSemesterNo;
      const cur = map.get(key) ?? { count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += toNumber(app.totalFee);
      map.set(key, cur);
    }
    return [...map.entries()].map(([semester, v]) => ({ semester, ...v }));
  }

  async backPaperSummary(tenantId: string, query: ExamReportQueryDto) {
    return this.db().examApplicationBackPaper.groupBy({
      by: ['subjectCode', 'semesterNo', 'examPaperType'],
      where: {
        tenantId,
        ...(query.sessionId
          ? { application: { sessionId: query.sessionId } }
          : {}),
      },
      _count: { _all: true },
      _sum: { amount: true },
    });
  }

  async feeHeadSummary(tenantId: string, query: ExamReportQueryDto) {
    const apps = await this.db().examApplication.findMany({
      where: {
        tenantId,
        ...(query.sessionId ? { sessionId: query.sessionId } : {}),
      },
      select: { feeBreakdown: true },
    });
    const map = new Map<string, number>();
    for (const app of apps) {
      const lines = app.feeBreakdown?.lines ?? [];
      for (const line of lines) {
        const key = `${line.headCode}|${line.headName}`;
        map.set(key, (map.get(key) ?? 0) + toNumber(line.amount));
      }
    }
    return [...map.entries()].map(([key, amount]) => {
      const [headCode, headName] = key.split('|');
      return { headCode, headName, amount };
    });
  }

  async dailyCollection(tenantId: string, query: ExamReportQueryDto) {
    const payments = await this.db().examPayment.findMany({
      where: {
        tenantId,
        status: 'SUCCESS',
        paidAt: this.dateFilter(query.from, query.to),
        ...(query.sessionId
          ? { application: { sessionId: query.sessionId } }
          : {}),
      },
    });
    const map = new Map<string, number>();
    for (const p of payments) {
      if (!p.paidAt) continue;
      const key = new Date(p.paidAt).toISOString().slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + toNumber(p.amount));
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, amount]) => ({ date, amount }));
  }

  async pendingPayments(tenantId: string, query: ExamReportQueryDto) {
    return this.db().examApplication.findMany({
      where: {
        tenantId,
        status: { in: ['AWAITING_PAYMENT', 'SUBMITTED'] },
        ...(query.sessionId ? { sessionId: query.sessionId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async manualPayments(tenantId: string, query: ExamReportQueryDto) {
    return this.db().examPayment.findMany({
      where: {
        tenantId,
        channel: 'MANUAL',
        ...(query.sessionId
          ? { application: { sessionId: query.sessionId } }
          : {}),
        paidAt: this.dateFilter(query.from, query.to),
      },
      include: {
        application: {
          select: {
            applicationNo: true,
            studentId: true,
            departmentName: true,
          },
        },
      },
      orderBy: { paidAt: 'desc' },
    });
  }

  async onlinePayments(tenantId: string, query: ExamReportQueryDto) {
    return this.db().examPayment.findMany({
      where: {
        tenantId,
        channel: 'ONLINE',
        ...(query.sessionId
          ? { application: { sessionId: query.sessionId } }
          : {}),
        paidAt: this.dateFilter(query.from, query.to),
      },
      include: {
        application: {
          select: {
            applicationNo: true,
            studentId: true,
            departmentName: true,
          },
        },
      },
      orderBy: { paidAt: 'desc' },
    });
  }

  async cancelledReceipts(tenantId: string) {
    return this.db().examReceipt.findMany({
      where: { tenantId, status: 'CANCELLED' },
      orderBy: { issuedAt: 'desc' },
    });
  }
}
