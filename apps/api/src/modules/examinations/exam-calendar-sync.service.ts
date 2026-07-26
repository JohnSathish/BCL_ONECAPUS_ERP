import { Injectable, Logger } from '@nestjs/common';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { AcademicCalendarService } from '../academic-calendar/academic-calendar.service';
import { toDateOnlyIso } from '../academic-calendar/academic-calendar.types';
import { isIaExamType } from './ia/ia.constants';

const SOURCE_MODULE = 'examinations';

@Injectable()
export class ExamCalendarSyncService {
  private readonly logger = new Logger(ExamCalendarSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calendars: AcademicCalendarService,
  ) {}

  mapExamTypeToCalendarType(examType: string | null | undefined): string {
    const t = (examType ?? '').toUpperCase();
    if (t === 'IA_PRACTICAL') return 'PRACTICAL_EXAM';
    if (t === 'IA_VIVA') return 'VIVA';
    if (t === 'SEMESTER_END') return 'END_SEM_EXAM';
    if (t.includes('MID')) return 'MID_SEM_EXAM';
    if (isIaExamType(examType)) return 'INTERNAL_ASSESSMENT';
    return 'END_SEM_EXAM';
  }

  /**
   * Best-effort sync of an ExamSession onto the Academic Calendar.
   * Never throws to the caller — exam writes must not fail on calendar errors.
   */
  async syncSession(user: JwtUser, sessionId: string): Promise<void> {
    try {
      const session = await (this.prisma as any).examSession.findFirst({
        where: { id: sessionId, tenantId: user.tid },
      });
      if (!session || session.deletedAt) {
        await this.calendars.removeFromSource(
          user.tid,
          SOURCE_MODULE,
          sessionId,
          user.sub,
        );
        return;
      }
      if (!session.academicYearId) {
        this.logger.debug(
          `Skip calendar sync for exam ${sessionId}: no academicYearId`,
        );
        return;
      }

      const papers = await (this.prisma as any).examPaperSchedule.findMany({
        where: {
          tenantId: user.tid,
          sessionId,
          deletedAt: null,
        },
        select: { examDate: true },
        orderBy: { examDate: 'asc' },
      });

      let start: Date | null = session.startDate ?? null;
      let end: Date | null = session.endDate ?? null;
      if (papers.length) {
        const dates = papers
          .map((p: { examDate: Date }) => p.examDate)
          .filter(Boolean) as Date[];
        if (dates.length) {
          const min = dates.reduce((a, b) => (a < b ? a : b));
          const max = dates.reduce((a, b) => (a > b ? a : b));
          start = start && start < min ? start : min;
          end = end && end > max ? end : max;
        }
      }

      if (!start && !end) {
        this.logger.debug(
          `Skip calendar sync for exam ${sessionId}: no dates yet`,
        );
        return;
      }
      if (!start) start = end;
      if (!end) end = start;

      const type = this.mapExamTypeToCalendarType(session.examType);
      const meta = (session.metadata ?? {}) as {
        departmentIds?: string[];
      };

      await this.calendars.upsertFromSource(user, {
        academicYearId: session.academicYearId,
        sourceModule: SOURCE_MODULE,
        sourceRefId: session.id,
        type,
        title: session.name,
        description: session.instructions ?? `${session.examType} examination`,
        startDate: toDateOnlyIso(start!),
        endDate: toDateOnlyIso(end!),
        visibility: 'INTERNAL',
        publishedToWebsite: false,
        createsAttendanceSession: false,
        isWorkingDay: null,
        departmentIds: Array.isArray(meta.departmentIds)
          ? meta.departmentIds.map(String)
          : undefined,
      });
    } catch (err) {
      this.logger.warn(
        `Academic calendar sync failed for exam ${sessionId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async removeSession(user: JwtUser, sessionId: string): Promise<void> {
    try {
      await this.calendars.removeFromSource(
        user.tid,
        SOURCE_MODULE,
        sessionId,
        user.sub,
      );
      await this.calendars.removeFromSource(
        user.tid,
        SOURCE_MODULE,
        `${sessionId}:result`,
        user.sub,
      );
    } catch (err) {
      this.logger.warn(
        `Academic calendar remove failed for exam ${sessionId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /** Optional RESULT event when results are published. */
  async syncResultPublished(user: JwtUser, sessionId: string): Promise<void> {
    try {
      const session = await (this.prisma as any).examSession.findFirst({
        where: { id: sessionId, tenantId: user.tid, deletedAt: null },
      });
      if (!session?.academicYearId) return;
      const today = toDateOnlyIso(new Date());
      await this.calendars.upsertFromSource(user, {
        academicYearId: session.academicYearId,
        sourceModule: SOURCE_MODULE,
        sourceRefId: `${session.id}:result`,
        type: 'RESULT',
        title: `${session.name} — Results`,
        description: 'Examination results published',
        startDate: today,
        endDate: today,
        visibility: 'INTERNAL',
        publishedToWebsite: false,
        createsAttendanceSession: false,
      });
    } catch (err) {
      this.logger.warn(
        `Academic calendar RESULT sync failed for exam ${sessionId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
