import { Injectable, NotFoundException } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { IA_EXAM_TYPES } from './ia.constants';
import { IaAdmitCardService } from './ia-admit-card.service';
import { IaDefaulterService } from './ia-defaulter.service';
import { IaSettingsService } from './ia-settings.service';
import { SHEET_STATUSES } from './ia.constants';

@Injectable()
export class IaPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: IaSettingsService,
    private readonly defaulters: IaDefaulterService,
    private readonly admitCards: IaAdmitCardService,
  ) {}

  private async studentForUser(user: JwtUser) {
    const student = await this.prisma.student.findFirst({
      where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
      include: {
        user: { select: { displayName: true } },
        programVersion: {
          include: { program: { select: { name: true, code: true } } },
        },
      },
    });
    if (!student) throw new NotFoundException('Student profile not found');
    return student;
  }

  async studentSchedule(user: JwtUser) {
    const student = await this.studentForUser(user);
    const sessionIds = (
      await (this.prisma as any).examSession.findMany({
        where: {
          tenantId: user.tid,
          deletedAt: null,
          examType: { in: [...IA_EXAM_TYPES] },
        },
        select: { id: true },
      })
    ).map((s: { id: string }) => s.id);

    const papers = sessionIds.length
      ? await (this.prisma as any).examPaperSchedule.findMany({
          where: {
            tenantId: user.tid,
            deletedAt: null,
            sessionId: { in: sessionIds },
          },
          orderBy: [{ examDate: 'asc' }],
          take: 50,
        })
      : [];

    return {
      student: {
        id: student.id,
        fullName: student.user?.displayName,
        rollNumber: student.rollNumber,
        programme: student.programVersion?.program?.name,
      },
      schedule: papers.map(
        (p: {
          id: string;
          paperCode: string;
          paperName: string;
          examDate: Date;
          startTime: Date;
          endTime: Date;
        }) => ({
          id: p.id,
          paperCode: p.paperCode,
          paperName: p.paperName,
          examDate: p.examDate,
          startTime: p.startTime,
          endTime: p.endTime,
        }),
      ),
    };
  }

  async studentMarks(user: JwtUser) {
    const student = await this.studentForUser(user);
    const marks = await (this.prisma as any).iaComponentMark.findMany({
      where: {
        tenantId: user.tid,
        studentId: student.id,
        deletedAt: null,
        status: { in: ['LOCKED', 'PUBLISHED'] },
      },
      include: { component: true },
    });

    const lockedSheet = await (
      this.prisma as any
    ).iaConsolidationSheet.findFirst({
      where: {
        tenantId: user.tid,
        status: {
          in: [SHEET_STATUSES.PRINCIPAL_APPROVED, SHEET_STATUSES.LOCKED],
        },
      },
    });

    const visible = lockedSheet
      ? marks
      : marks.filter((m: { status: string }) => m.status === 'PUBLISHED');

    const rows = await (this.prisma as any).iaConsolidationRow.findMany({
      where: { tenantId: user.tid, studentId: student.id },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    return {
      studentId: student.id,
      components: visible.map(
        (m: {
          component: { code: string; label: string };
          marks?: unknown;
          maxMarks: unknown;
          isAbsent: boolean;
        }) => ({
          code: m.component.code,
          label: m.component.label,
          marks: m.marks != null ? Number(m.marks) : null,
          maxMarks: Number(m.maxMarks),
          isAbsent: m.isAbsent,
        }),
      ),
      summaries: rows.map(
        (r: {
          totalMarks: unknown;
          maxMarks: unknown;
          percentage: unknown;
          resultStatus: string;
          componentJson: Record<string, unknown>;
        }) => ({
          totalMarks: Number(r.totalMarks),
          maxMarks: Number(r.maxMarks),
          percentage: Number(r.percentage),
          resultStatus: r.resultStatus,
          components: r.componentJson,
        }),
      ),
    };
  }

  async studentPerformance(user: JwtUser) {
    const marks = await this.studentMarks(user);
    const defaulterList = await this.defaulters.list(user.tid);
    const isDefaulter = defaulterList.items.some(
      (d: { studentId: string }) => d.studentId === marks.studentId,
    );
    return {
      ...marks,
      defaulterStatus: isDefaulter ? 'DEFAULTER' : 'CLEAR',
      trends: marks.summaries,
    };
  }

  async studentAdmitCard(user: JwtUser, sessionId?: string) {
    const student = await this.studentForUser(user);
    let targetSessionId = sessionId;
    if (!targetSessionId) {
      const session = await (this.prisma as any).examSession.findFirst({
        where: {
          tenantId: user.tid,
          deletedAt: null,
          examType: { in: [...IA_EXAM_TYPES] },
          status: { in: ['ACTIVE', 'SCHEDULED', 'OPEN'] },
        },
        orderBy: { startDate: 'desc' },
      });
      targetSessionId = session?.id;
    }
    if (!targetSessionId) {
      return { blocked: true, reason: 'No active IA session found' };
    }
    const card = await this.admitCards.generateCard(
      user.tid,
      targetSessionId,
      student.id,
      user,
    );
    if (card.blocked) {
      return {
        blocked: true,
        reason: card.reason,
        eligibility: card.eligibility,
      };
    }
    return card;
  }

  verifyAdmitToken(token: string) {
    return this.admitCards.verifyToken(token);
  }
}
