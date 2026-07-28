import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ENROLLED_LINE_STATUSES } from '../../lms/constants/lms.constants';
import { MoodleCalendarService } from '../../moodle/moodle-calendar.service';

export type PortalCalendarEventDto = {
  id: string;
  date: string;
  type: 'exam' | 'holiday' | 'assignment' | 'fee' | 'event';
  title: string;
  subtitle?: string | null;
};

@Injectable()
export class StudentPortalCalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moodleCalendar: MoodleCalendarService,
  ) {}

  async buildForStudent(
    tenantId: string,
    studentId: string,
    opts?: { year?: number; month?: number; monthsSpan?: number },
  ): Promise<PortalCalendarEventDto[]> {
    const now = new Date();
    const y = opts?.year ?? now.getFullYear();
    const m = opts?.month ?? now.getMonth();
    const span = Math.max(1, opts?.monthsSpan ?? 1);
    const from = new Date(y, m, 1);
    const to = new Date(y, m + span, 0, 23, 59, 59, 999);

    const [holidays, demands, lines, workspaceIds, deptActivities] =
      await Promise.all([
        this.prisma.staffPublicHoliday.findMany({
          where: {
            tenantId,
            active: true,
            holidayDate: { gte: from, lte: to },
          },
          select: {
            id: true,
            name: true,
            holidayDate: true,
            holidayType: true,
          },
        }),
        this.prisma.studentFeeDemand.findMany({
          where: {
            tenantId,
            studentId,
            dueDate: { gte: from, lte: to },
            balanceAmount: { gt: 0 },
          },
          select: {
            id: true,
            demandNo: true,
            dueDate: true,
            balanceAmount: true,
            billingPeriod: true,
          },
        }),
        this.prisma.semesterRegistrationLine.findMany({
          where: {
            tenantId,
            status: { in: [...ENROLLED_LINE_STATUSES] },
            registration: { studentId },
          },
          select: {
            offeringId: true,
            offering: { select: { courseId: true } },
          },
        }),
        this.studentWorkspaceIds(tenantId, studentId),
        (this.prisma as any).departmentActivity.findMany({
          where: {
            tenantId,
            deletedAt: null,
            status: { in: ['OPEN', 'APPROVED', 'CLOSED', 'COMPLETED'] },
            eventDate: { gte: from, lte: to },
            OR: [
              { status: 'OPEN' },
              {
                registrations: {
                  some: { studentId, status: 'REGISTERED' },
                },
              },
            ],
          },
          select: {
            id: true,
            title: true,
            eventDate: true,
            status: true,
            department: { select: { name: true } },
          },
        }),
      ]);

    const courseIds = [
      ...new Set(lines.map((l) => l.offering?.courseId).filter(Boolean)),
    ] as string[];
    const offeringIds = [...new Set(lines.map((l) => l.offeringId))];

    const [exams, assignments] = await Promise.all([
      courseIds.length || offeringIds.length
        ? (this.prisma as any).examPaperSchedule.findMany({
            where: {
              tenantId,
              deletedAt: null,
              examDate: { gte: from, lte: to },
              OR: [
                ...(courseIds.length ? [{ courseId: { in: courseIds } }] : []),
                ...(offeringIds.length
                  ? [{ offeringId: { in: offeringIds } }]
                  : []),
              ],
            },
            select: {
              id: true,
              paperCode: true,
              paperName: true,
              examDate: true,
              startTime: true,
            },
          })
        : [],
      workspaceIds.length
        ? this.prisma.lmsAssignment.findMany({
            where: {
              tenantId,
              workspaceId: { in: workspaceIds },
              status: 'PUBLISHED',
              deletedAt: null,
              dueAt: { gte: from, lte: to },
            },
            select: { id: true, title: true, dueAt: true },
          })
        : [],
    ]);

    const events: PortalCalendarEventDto[] = [];

    for (const h of holidays) {
      events.push({
        id: `holiday-${h.id}`,
        date: this.dateOnly(h.holidayDate),
        type: 'holiday',
        title: h.name,
        subtitle: h.holidayType,
      });
    }

    for (const d of demands) {
      if (!d.dueDate) continue;
      events.push({
        id: `fee-${d.id}`,
        date: this.dateOnly(d.dueDate),
        type: 'fee',
        title: 'Fee due',
        subtitle: `₹${Number(d.balanceAmount).toLocaleString()}${d.billingPeriod ? ` · ${d.billingPeriod}` : ''}`,
      });
    }

    for (const exam of exams) {
      events.push({
        id: `exam-${exam.id}`,
        date: this.dateOnly(exam.examDate),
        type: 'exam',
        title: exam.paperName ?? exam.paperCode,
        subtitle: exam.paperCode,
      });
    }

    for (const a of assignments) {
      events.push({
        id: `assignment-${a.id}`,
        date: this.dateOnly(a.dueAt!),
        type: 'assignment',
        title: a.title,
        subtitle: 'Assignment due',
      });
    }

    for (const activity of deptActivities) {
      events.push({
        id: `dept-activity-${activity.id}`,
        date: this.dateOnly(activity.eventDate),
        type: 'event',
        title: activity.title,
        subtitle: activity.department?.name ?? activity.status,
      });
    }

    const moodleEvents = await this.moodleCalendar.listEventsForStudent(
      tenantId,
      studentId,
      from,
      to,
    );
    for (const me of moodleEvents) {
      events.push({
        id: me.id,
        date: me.date,
        type: me.type === 'quiz' ? 'event' : 'assignment',
        title: me.title,
        subtitle: me.subtitle ?? 'Moodle',
      });
    }

    return events.sort((a, b) => a.date.localeCompare(b.date));
  }

  private async studentWorkspaceIds(tenantId: string, studentId: string) {
    const lines = await this.prisma.semesterRegistrationLine.findMany({
      where: {
        tenantId,
        status: { in: [...ENROLLED_LINE_STATUSES] },
        registration: { studentId },
      },
      select: { offeringSectionId: true, offeringId: true },
    });
    const sectionIds = lines
      .map((l) => l.offeringSectionId)
      .filter(Boolean) as string[];
    const offeringIds = [...new Set(lines.map((l) => l.offeringId))];
    const workspaces = await this.prisma.lmsWorkspace.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: 'ACTIVE',
        OR: [
          { offeringSectionId: { in: sectionIds } },
          { workspaceType: 'POOL', courseOfferingId: { in: offeringIds } },
        ],
      },
      select: { id: true },
    });
    return workspaces.map((w) => w.id);
  }

  private dateOnly(value: Date) {
    return value.toISOString().slice(0, 10);
  }
}
