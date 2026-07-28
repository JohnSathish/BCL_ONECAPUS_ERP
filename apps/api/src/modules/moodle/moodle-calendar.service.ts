import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export type MoodleCalendarEvent = {
  id: string;
  date: string;
  type: 'assignment' | 'quiz';
  title: string;
  subtitle?: string | null;
  source: 'moodle';
};

@Injectable()
export class MoodleCalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async listEventsForStudent(
    tenantId: string,
    studentId: string,
    from: Date,
    to: Date,
  ): Promise<MoodleCalendarEvent[]> {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
      select: { userId: true },
    });
    if (!student?.userId) return [];

    const moodleUser = await this.prisma.moodleUser.findFirst({
      where: { tenantId, erpUserId: student.userId },
      include: {
        enrollments: {
          where: { status: 'ACTIVE' },
          include: { moodleCourse: true },
        },
      },
    });
    if (!moodleUser?.enrollments.length) return [];

    const courseRowIds = moodleUser.enrollments.map((e) => e.moodleCourseId);
    const [assignments, quizzes] = await Promise.all([
      this.prisma.moodleAssignment.findMany({
        where: {
          tenantId,
          moodleCourseId: { in: courseRowIds },
          dueAt: { gte: from, lte: to },
        },
        select: { id: true, name: true, dueAt: true },
      }),
      this.prisma.moodleQuiz.findMany({
        where: {
          tenantId,
          moodleCourseId: { in: courseRowIds },
          OR: [
            { timeClose: { gte: from, lte: to } },
            { timeOpen: { gte: from, lte: to } },
          ],
        },
        select: { id: true, name: true, timeClose: true, timeOpen: true },
      }),
    ]);

    const events: MoodleCalendarEvent[] = [];
    for (const a of assignments) {
      if (!a.dueAt) continue;
      events.push({
        id: `moodle-assignment-${a.id}`,
        date: a.dueAt.toISOString().slice(0, 10),
        type: 'assignment',
        title: a.name,
        subtitle: 'Moodle assignment due',
        source: 'moodle',
      });
    }
    for (const q of quizzes) {
      const when = q.timeClose ?? q.timeOpen;
      if (!when) continue;
      events.push({
        id: `moodle-quiz-${q.id}`,
        date: when.toISOString().slice(0, 10),
        type: 'quiz',
        title: q.name,
        subtitle: 'Moodle quiz',
        source: 'moodle',
      });
    }
    return events.sort((a, b) => a.date.localeCompare(b.date));
  }
}
