import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MoodleApiService } from './moodle-api.service';
import { MoodleCourseSyncService } from './moodle-course-sync.service';
import { MoodleSettingsService } from './moodle-settings.service';
import { MoodleUserSyncService } from './moodle-user-sync.service';

@Injectable()
export class MoodleEnrolmentSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly api: MoodleApiService,
    private readonly settings: MoodleSettingsService,
    private readonly users: MoodleUserSyncService,
    private readonly courses: MoodleCourseSyncService,
  ) {}

  async enrollStudentInSemester(
    tenantId: string,
    studentId: string,
    semesterSequence: number,
  ) {
    const cfg = await this.prisma.moodleSettings.findUnique({
      where: { tenantId },
    });
    if (!cfg?.enableSync || !cfg.enableAutoEnrollment) return null;

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
    });
    if (!student?.programVersionId) return null;

    const moodleUser =
      (await this.users.syncStudent(tenantId, studentId)) ??
      (await this.prisma.moodleUser.findFirst({
        where: { tenantId, erpEntityId: studentId },
      }));
    if (!moodleUser) return null;

    const moodleCourse = await this.courses.syncProgramSemesterCourse(
      tenantId,
      student.programVersionId,
      semesterSequence,
    );
    if (!moodleCourse) return null;

    await this.api.call({
      tenantId,
      wsfunction: 'enrol_manual_enrol_users',
      params: {
        enrolments: [
          {
            roleid: 5,
            userid: moodleUser.moodleUserId,
            courseid: moodleCourse.moodleCourseId,
          },
        ],
      },
    });

    return this.prisma.moodleEnrollment.upsert({
      where: {
        tenantId_moodleUserId_moodleCourseId_role: {
          tenantId,
          moodleUserId: moodleUser.id,
          moodleCourseId: moodleCourse.id,
          role: 'student',
        },
      },
      create: {
        tenantId,
        moodleUserId: moodleUser.id,
        moodleCourseId: moodleCourse.id,
        role: 'student',
        status: 'ACTIVE',
        lastSyncedAt: new Date(),
      },
      update: { status: 'ACTIVE', lastSyncedAt: new Date() },
    });
  }

  async enrollStaffOnWorkspace(
    tenantId: string,
    staffProfileId: string,
    workspaceId: string,
  ) {
    const cfg = await this.settings.getOrCreate(tenantId);
    if (!cfg.enableSync || !cfg.enableAutoEnrollment) return null;

    const moodleUser =
      (await this.users.syncStaff(tenantId, staffProfileId)) ??
      (await this.prisma.moodleUser.findFirst({
        where: {
          tenantId,
          erpEntityType: 'STAFF',
          erpEntityId: staffProfileId,
        },
      }));
    const moodleCourse = await this.courses.syncWorkspaceCourse(
      tenantId,
      workspaceId,
    );
    if (!moodleUser || !moodleCourse) return null;

    await this.api.call({
      tenantId,
      wsfunction: 'enrol_manual_enrol_users',
      params: {
        enrolments: [
          {
            roleid: 3,
            userid: moodleUser.moodleUserId,
            courseid: moodleCourse.moodleCourseId,
          },
        ],
      },
    });

    return this.prisma.moodleEnrollment.upsert({
      where: {
        tenantId_moodleUserId_moodleCourseId_role: {
          tenantId,
          moodleUserId: moodleUser.id,
          moodleCourseId: moodleCourse.id,
          role: 'editingteacher',
        },
      },
      create: {
        tenantId,
        moodleUserId: moodleUser.id,
        moodleCourseId: moodleCourse.id,
        role: 'editingteacher',
        status: 'ACTIVE',
        lastSyncedAt: new Date(),
      },
      update: { status: 'ACTIVE', lastSyncedAt: new Date() },
    });
  }
}
