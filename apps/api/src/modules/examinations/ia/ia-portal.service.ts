import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { IA_EXAM_TYPES } from './ia.constants';
import { IaAdmitCardService } from './ia-admit-card.service';
import { registeredSubjectPrint } from '../../academic-engine/domain/offering-paper-title';
import { pickIaPaperForRegistration } from './ia-category-policy';
import { formatExamWallClock } from './ia-noticeboard-grid';
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

  /** A shift-specific exam is only for students on that shift. */
  private shiftMatches(
    sessionShiftId: string | null | undefined,
    lineShiftId: string | null | undefined,
    primaryShiftId: string | null | undefined,
  ) {
    if (!sessionShiftId) return true;
    const studentShift = lineShiftId || primaryShiftId || null;
    if (!studentShift) return true;
    return sessionShiftId === studentShift;
  }

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

  /**
   * Student IA timetable: only papers this student is registered for.
   * Never dump the college-wide IA schedule (that caused Arts students to see Chemistry, etc.).
   */
  async studentSchedule(user: JwtUser) {
    const student = await this.studentForUser(user);

    const progress = await this.prisma.studentSemesterProgress.findFirst({
      where: { tenantId: user.tid, studentId: student.id },
      orderBy: { semesterSequence: 'desc' },
      select: { semesterSequence: true },
    });

    const lineInclude = {
      offering: {
        select: {
          id: true,
          courseId: true,
          category: true,
          titleOverride: true,
          course: { select: { code: true, title: true } },
        },
      },
      registration: { select: { shiftId: true } },
    } as const;

    const lines = await this.prisma.semesterRegistrationLine.findMany({
      where: {
        tenantId: user.tid,
        status: { in: ['approved', 'confirmed', 'registered', 'pending'] },
        registration: {
          studentId: student.id,
          ...(progress?.semesterSequence != null
            ? { semesterSequence: progress.semesterSequence }
            : {}),
        },
      },
      include: lineInclude,
    });

    // If current-semester filter yields nothing, fall back to all of this student's lines.
    const effectiveLines =
      lines.length > 0
        ? lines
        : await this.prisma.semesterRegistrationLine.findMany({
            where: {
              tenantId: user.tid,
              status: {
                in: ['approved', 'confirmed', 'registered', 'pending'],
              },
              registration: { studentId: student.id },
            },
            include: lineInclude,
          });

    const offeringIds = new Set(
      effectiveLines.map((l) => l.offeringId).filter(Boolean),
    );
    const courseIds = new Set(
      effectiveLines
        .map((l) => l.offering?.courseId)
        .filter((id): id is string => !!id),
    );

    if (!offeringIds.size && !courseIds.size) {
      return {
        student: {
          id: student.id,
          fullName: student.user?.displayName,
          rollNumber: student.rollNumber,
          programme: student.programVersion?.program?.name,
        },
        schedule: [],
      };
    }

    const sessions = (await (this.prisma as any).examSession.findMany({
      where: {
        tenantId: user.tid,
        deletedAt: null,
        examType: { in: [...IA_EXAM_TYPES] },
        status: { in: ['ACTIVE', 'SCHEDULED', 'OPEN'] },
      },
      select: { id: true, shiftId: true, name: true },
    })) as Array<{ id: string; shiftId: string | null; name: string | null }>;
    const sessionIds = sessions.map((s) => s.id);
    const sessionNameById = new Map(
      sessions.map((session) => [session.id, session.name?.trim() || null]),
    );

    type PaperRow = {
      id: string;
      sessionId?: string | null;
      paperCode: string;
      paperName: string;
      examDate: Date;
      startTime: Date;
      endTime: Date;
      courseId?: string | null;
      offeringId?: string | null;
      metadata?: unknown;
    };

    const allPapers: PaperRow[] = sessionIds.length
      ? await (this.prisma as any).examPaperSchedule.findMany({
          where: {
            tenantId: user.tid,
            deletedAt: null,
            sessionId: { in: sessionIds },
          },
          orderBy: [{ examDate: 'asc' }, { startTime: 'asc' }],
          take: 2000,
        })
      : [];

    const papersBySession = new Map<string, PaperRow[]>();
    for (const paper of allPapers) {
      const key = paper.sessionId ?? '';
      const list = papersBySession.get(key) ?? [];
      list.push(paper);
      papersBySession.set(key, list);
    }

    const matched: PaperRow[] = [];
    const printedSubjects = new Map<string, { code: string; title: string }>();
    const seenIds = new Set<string>();
    for (const line of effectiveLines) {
      for (const session of sessions) {
        if (
          !this.shiftMatches(
            session.shiftId,
            line.registration?.shiftId,
            student.primaryShiftId,
          )
        ) {
          continue;
        }
        const sessionPapers = papersBySession.get(session.id) ?? [];
        const paper = pickIaPaperForRegistration(sessionPapers, {
          offeringId: line.offeringId,
          category: line.category,
          courseId: line.offering?.courseId,
        });
        if (paper && !seenIds.has(paper.id)) {
          seenIds.add(paper.id);
          const printed = registeredSubjectPrint(
            line.offering?.course,
            line.offering,
          );
          if (printed.code || printed.title) {
            printedSubjects.set(paper.id, printed);
          }
          matched.push(paper);
        }
      }
    }

    // Deduplicate same sitting (code + date) if multiple sessions provisioned the same paper.
    const seenSitting = new Set<string>();
    const schedule = matched
      .sort((a, b) => {
        const d = a.examDate.getTime() - b.examDate.getTime();
        if (d !== 0) return d;
        return a.startTime.getTime() - b.startTime.getTime();
      })
      .filter((p) => {
        const day = new Date(p.examDate).toISOString().slice(0, 10);
        const key = `${(p.paperCode || '').toUpperCase()}|${day}`;
        if (seenSitting.has(key)) return false;
        seenSitting.add(key);
        return true;
      })
      .map((p) => ({
        id: p.id,
        paperCode: printedSubjects.get(p.id)?.code || p.paperCode,
        paperName: printedSubjects.get(p.id)?.title || p.paperName,
        sessionName: p.sessionId
          ? (sessionNameById.get(p.sessionId) ?? null)
          : null,
        examDate: p.examDate,
        startTime: formatExamWallClock(p.startTime),
        endTime: formatExamWallClock(p.endTime),
      }));

    return {
      student: {
        id: student.id,
        fullName: student.user?.displayName,
        rollNumber: student.rollNumber,
        programme: student.programVersion?.program?.name,
      },
      schedule,
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

    const resultPapers = await this.papersFromMarks(user.tid, visible);

    const rows = await (this.prisma as any).iaConsolidationRow.findMany({
      where: { tenantId: user.tid, studentId: student.id },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    return {
      studentId: student.id,
      papers: resultPapers,
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

  /**
   * Office-only look at saved marks, including drafts. The student app still
   * hides these until the consolidation sheet is locked or the marks are published.
   */
  async previewSavedMarks(
    user: JwtUser,
    query?: string,
    studentId?: string,
    sessionId?: string,
  ) {
    const q = query?.trim() ?? '';
    if (!studentId && q.length < 2) {
      throw new BadRequestException(
        'Type at least two characters of the name or roll number.',
      );
    }

    const students = studentId
      ? await this.prisma.student.findMany({
          where: { tenantId: user.tid, id: studentId, deletedAt: null },
          take: 1,
          select: this.previewStudentSelect(),
        })
      : await this.prisma.student.findMany({
          where: {
            tenantId: user.tid,
            deletedAt: null,
            OR: [
              { rollNumber: { contains: q, mode: 'insensitive' } },
              {
                masterProfile: {
                  fullName: { contains: q, mode: 'insensitive' },
                },
              },
              {
                user: {
                  displayName: { contains: q, mode: 'insensitive' },
                },
              },
            ],
          },
          take: 8,
          orderBy: { rollNumber: 'asc' },
          select: this.previewStudentSelect(),
        });

    const matches = students.map((row) => this.previewStudent(row));
    const exam = sessionId
      ? await (this.prisma as any).examSession.findFirst({
          where: { id: sessionId, tenantId: user.tid, deletedAt: null },
          select: { id: true, name: true },
        })
      : null;
    if (matches.length !== 1) {
      return { preview: true, exam, matches, student: null, papers: [] };
    }

    const student = matches[0];
    const marks = await (this.prisma as any).iaComponentMark.findMany({
      where: {
        tenantId: user.tid,
        studentId: student.id,
        deletedAt: null,
        status: { in: ['DRAFT', 'LOCKED', 'PUBLISHED'] },
        OR: [{ marks: { not: null } }, { isAbsent: true }],
        ...(sessionId ? { sessionId } : {}),
      },
    });
    const papers = await this.papersFromMarks(user.tid, marks);
    return { preview: true, exam, matches, student, papers };
  }

  private previewStudentSelect() {
    return {
      id: true,
      rollNumber: true,
      user: { select: { displayName: true } },
      masterProfile: { select: { fullName: true } },
      programVersion: {
        select: { program: { select: { name: true, code: true } } },
      },
    } as const;
  }

  private previewStudent(row: {
    id: string;
    rollNumber: string | null;
    user?: { displayName?: string | null } | null;
    masterProfile?: { fullName?: string | null } | null;
    programVersion?: {
      program?: { name?: string | null; code?: string | null } | null;
    } | null;
  }) {
    return {
      id: row.id,
      rollNumber: row.rollNumber,
      fullName:
        row.masterProfile?.fullName?.trim() ||
        row.user?.displayName?.trim() ||
        null,
      programme: row.programVersion?.program?.name?.trim() || null,
    };
  }

  private async papersFromMarks(
    tenantId: string,
    visible: Array<{
      paperId?: string | null;
      schemeId: string;
      maxMarks?: unknown;
      marks?: unknown;
      isAbsent?: boolean;
      status?: string;
    }>,
  ) {
    const paperIds = [
      ...new Set(
        visible
          .map((mark) => mark.paperId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const schemeIds = [
      ...new Set(visible.map((mark) => mark.schemeId).filter(Boolean)),
    ];
    const [paperRows, schemeRows] = await Promise.all([
      paperIds.length
        ? (this.prisma as any).examPaperSchedule.findMany({
            where: { tenantId, id: { in: paperIds }, deletedAt: null },
            select: {
              id: true,
              paperCode: true,
              paperName: true,
              sessionId: true,
              examDate: true,
            },
          })
        : [],
      schemeIds.length
        ? (this.prisma as any).iaAssessmentScheme.findMany({
            where: { tenantId, id: { in: schemeIds }, deletedAt: null },
            select: { id: true, passMark: true, totalMaxMarks: true },
          })
        : [],
    ]);
    const sessionIds = [
      ...new Set(
        paperRows
          .map((paper: { sessionId?: string | null }) => paper.sessionId)
          .filter((id: string | null | undefined): id is string => Boolean(id)),
      ),
    ];
    const sessionRows = sessionIds.length
      ? await (this.prisma as any).examSession.findMany({
          where: { tenantId, id: { in: sessionIds }, deletedAt: null },
          select: { id: true, name: true },
        })
      : [];
    const paperById = new Map(
      paperRows.map((paper: { id: string }) => [paper.id, paper]),
    );
    const schemeById = new Map(
      schemeRows.map((scheme: { id: string }) => [scheme.id, scheme]),
    );
    const sessionNameById = new Map(
      sessionRows.map((session: { id: string; name?: string | null }) => [
        session.id,
        session.name?.trim() || null,
      ]),
    );
    const grouped = new Map<string, typeof visible>();
    for (const mark of visible) {
      const key = mark.paperId || mark.schemeId;
      const list = grouped.get(key) ?? [];
      list.push(mark);
      grouped.set(key, list);
    }
    return [...grouped.values()]
      .map((group) => {
        const first = group[0];
        const paper = first.paperId
          ? (paperById.get(first.paperId) as
              | {
                  paperCode?: string;
                  paperName?: string;
                  sessionId?: string | null;
                  examDate?: Date | null;
                }
              | undefined)
          : undefined;
        const scheme = schemeById.get(first.schemeId) as
          | { passMark?: unknown; totalMaxMarks?: unknown }
          | undefined;
        const componentMax = group.reduce(
          (sum, mark) => sum + Number(mark.maxMarks ?? 0),
          0,
        );
        const maxMarks = componentMax || Number(scheme?.totalMaxMarks ?? 0);
        const secured = group.reduce(
          (sum, mark) => sum + (mark.isAbsent ? 0 : Number(mark.marks ?? 0)),
          0,
        );
        const absent = group.every((mark) => mark.isAbsent);
        const passMark = Number(
          scheme?.passMark ?? (maxMarks > 0 ? Math.ceil(maxMarks * 0.4) : 0),
        );
        const outcome = absent
          ? 'ABSENT'
          : secured >= passMark
            ? 'PASS'
            : 'FAIL';
        return {
          paperId: first.paperId ?? first.schemeId,
          paperCode: paper?.paperCode ?? null,
          paperName: paper?.paperName ?? null,
          sessionName: paper?.sessionId
            ? (sessionNameById.get(paper.sessionId) ?? null)
            : null,
          examDate: paper?.examDate ?? null,
          marks: absent ? null : secured,
          maxMarks,
          passMark,
          isAbsent: absent,
          outcome,
          released: group.every(
            (mark) => mark.status === 'LOCKED' || mark.status === 'PUBLISHED',
          ),
        };
      })
      .sort((a, b) => {
        const aTime = a.examDate ? new Date(a.examDate).getTime() : 0;
        const bTime = b.examDate ? new Date(b.examDate).getTime() : 0;
        return aTime - bTime;
      });
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
