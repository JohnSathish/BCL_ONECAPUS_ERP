import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MoodleAssignmentSyncService } from './moodle-assignment-sync.service';
import { MoodleCourseSyncService } from './moodle-course-sync.service';
import { MoodleEnrolmentSyncService } from './moodle-enrolment-sync.service';
import { MoodleGradeSyncService } from './moodle-grade-sync.service';
import { MoodleAttendanceSyncService } from './moodle-attendance-sync.service';
import { MoodleSettingsService } from './moodle-settings.service';
import { MoodleSyncQueueService } from './moodle-sync-queue.service';
import { MoodleUserSyncService } from './moodle-user-sync.service';

export type MoodleSyncType =
  | 'USERS'
  | 'COURSES'
  | 'ENROLLMENTS'
  | 'GRADES'
  | 'ASSIGNMENTS'
  | 'ATTENDANCE'
  | 'NOTIFICATIONS'
  | 'ALL';

@Injectable()
export class MoodleSyncService {
  private readonly logger = new Logger(MoodleSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: MoodleSettingsService,
    private readonly users: MoodleUserSyncService,
    private readonly courses: MoodleCourseSyncService,
    private readonly enrolments: MoodleEnrolmentSyncService,
    private readonly assignments: MoodleAssignmentSyncService,
    private readonly grades: MoodleGradeSyncService,
    private readonly attendance: MoodleAttendanceSyncService,
    private readonly queue: MoodleSyncQueueService,
  ) {}

  async runSync(tenantId: string, syncType: MoodleSyncType = 'ALL') {
    if (!(await this.settings.isSyncEnabled(tenantId))) {
      return {
        skipped: true,
        reason: 'Sync disabled or Moodle not configured',
      };
    }

    const log = await this.prisma.moodleSyncLog.create({
      data: { tenantId, syncType, status: 'RUNNING' },
    });

    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];

    const run = async (label: string, fn: () => Promise<unknown>) => {
      if (syncType !== 'ALL' && syncType !== label) return;
      try {
        await fn();
        successCount += 1;
      } catch (err) {
        failureCount += 1;
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${label}: ${msg}`);
        this.logger.warn(`${label} sync failed for tenant ${tenantId}: ${msg}`);
      }
    };

    try {
      if (syncType === 'USERS' || syncType === 'ALL') {
        const students = await this.prisma.student.findMany({
          where: { tenantId, deletedAt: null },
          select: { id: true },
          take: 200,
        });
        for (const s of students) {
          await run('USERS', () => this.users.syncStudent(tenantId, s.id));
        }
        const staff = await this.prisma.staffProfile.findMany({
          where: { tenantId, deletedAt: null, portalUserId: { not: null } },
          select: { id: true },
          take: 200,
        });
        for (const f of staff) {
          await run('USERS', () => this.users.syncStaff(tenantId, f.id));
        }
      }

      if (syncType === 'COURSES' || syncType === 'ALL') {
        const workspaces = await this.prisma.lmsWorkspace.findMany({
          where: {
            tenantId,
            deletedAt: null,
            provider: { in: ['MOODLE', 'INHERIT'] },
          },
          select: { id: true },
          take: 200,
        });
        for (const w of workspaces) {
          await run('COURSES', () =>
            this.courses.syncWorkspaceCourse(tenantId, w.id),
          );
        }
      }

      if (syncType === 'ENROLLMENTS' || syncType === 'ALL') {
        const students = await this.prisma.student.findMany({
          where: { tenantId, deletedAt: null, programVersionId: { not: null } },
          include: { academicStanding: true },
          take: 200,
        });
        for (const s of students) {
          const seq = s.academicStanding?.currentSemesterSequence ?? 1;
          await run('ENROLLMENTS', () =>
            this.enrolments.enrollStudentInSemester(tenantId, s.id, seq),
          );
        }
      }

      if (
        syncType === 'ASSIGNMENTS' ||
        syncType === 'GRADES' ||
        syncType === 'ALL'
      ) {
        const courseRows = await this.prisma.moodleCourse.findMany({
          where: { tenantId },
          select: { id: true },
          take: 100,
        });
        for (const c of courseRows) {
          if (syncType === 'ASSIGNMENTS' || syncType === 'ALL') {
            await run('ASSIGNMENTS', () =>
              this.assignments.syncCourseAssignments(tenantId, c.id),
            );
          }
          if (syncType === 'GRADES' || syncType === 'ALL') {
            await run('GRADES', () =>
              this.grades.syncCourseGrades(tenantId, c.id),
            );
          }
        }
      }

      if (syncType === 'ATTENDANCE' || syncType === 'ALL') {
        const courseRows = await this.prisma.moodleCourse.findMany({
          where: { tenantId },
          select: { id: true },
          take: 100,
        });
        for (const c of courseRows) {
          await run('ATTENDANCE', async () => {
            await this.attendance.listCourseAttendance(tenantId, c.id);
          });
        }
      }

      await this.prisma.moodleSyncLog.update({
        where: { id: log.id },
        data: {
          status: failureCount ? 'PARTIAL' : 'SUCCESS',
          finishedAt: new Date(),
          successCount,
          failureCount,
          errorMessage: errors.length ? errors.join('\n').slice(0, 4000) : null,
        },
      });

      await this.prisma.moodleSettings.update({
        where: { tenantId },
        data: { lastSyncAt: new Date() },
      });

      return { logId: log.id, successCount, failureCount, errors };
    } catch (err) {
      await this.prisma.moodleSyncLog.update({
        where: { id: log.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          failureCount: failureCount + 1,
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }
  }

  async listSyncLogs(tenantId: string, limit = 30) {
    return this.prisma.moodleSyncLog.findMany({
      where: { tenantId },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }

  async listApiLogs(tenantId: string, limit = 50) {
    return this.prisma.moodleApiLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async syncDashboard(tenantId: string) {
    const [
      settings,
      lastLogs,
      pendingEvents,
      courseCount,
      userCount,
      enrollmentCount,
      queueStats,
    ] = await Promise.all([
      this.settings.getOrCreate(tenantId),
      this.listSyncLogs(tenantId, 5),
      this.prisma.moodleSyncEvent.count({
        where: { tenantId, status: 'PENDING' },
      }),
      this.prisma.moodleCourse.count({ where: { tenantId } }),
      this.prisma.moodleUser.count({ where: { tenantId } }),
      this.prisma.moodleEnrollment.count({
        where: { tenantId, status: 'ACTIVE' },
      }),
      this.queue.getQueueStats(),
    ]);
    const deadLetterCount = await this.prisma.moodleSyncLog.count({
      where: { tenantId, syncType: { startsWith: 'DLQ:' }, status: 'FAILED' },
    });
    return {
      settings,
      lastLogs,
      pendingEvents,
      deadLetterCount,
      queueStats,
      counts: {
        courses: courseCount,
        users: userCount,
        enrollments: enrollmentCount,
      },
    };
  }
}
