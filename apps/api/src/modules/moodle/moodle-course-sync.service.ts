import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MoodleApiService } from './moodle-api.service';
import { MoodleSettingsService } from './moodle-settings.service';

@Injectable()
export class MoodleCourseSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly api: MoodleApiService,
    private readonly settings: MoodleSettingsService,
  ) {}

  buildShortname(programCode: string, semesterSequence: number) {
    const sem =
      ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][
        semesterSequence - 1
      ] ?? String(semesterSequence);
    return `${programCode.replace(/[^A-Za-z0-9-]/g, '-').toUpperCase()}-SEM-${sem}`;
  }

  async syncProgramSemesterCourse(
    tenantId: string,
    programVersionId: string,
    semesterSequence: number,
  ) {
    const cfg = await this.prisma.moodleSettings.findUnique({
      where: { tenantId },
    });
    if (!cfg?.enableSync || !cfg.enableAutoCourseCreation) return null;

    const programVersion = await this.prisma.programVersion.findFirst({
      where: { id: programVersionId, tenantId, deletedAt: null },
      include: { program: true },
    });
    if (!programVersion?.program) return null;

    const shortname = this.buildShortname(
      programVersion.program.code,
      semesterSequence,
    );
    const existing = await this.prisma.moodleCourse.findFirst({
      where: { tenantId, programVersionId, semesterSequence },
    });
    if (existing) return existing;

    const fullname = `${programVersion.program.name} — Semester ${semesterSequence}`;
    const created = await this.api.call<
      Array<{ id: number; shortname: string }>
    >({
      tenantId,
      wsfunction: 'core_course_create_courses',
      params: {
        courses: [
          {
            fullname,
            shortname,
            categoryid: 1,
            idnumber: shortname,
            visible: 1,
          },
        ],
      },
    });
    const moodleCourseId = created?.[0]?.id;
    if (!moodleCourseId) throw new Error('Moodle course create returned no id');

    return this.prisma.moodleCourse.create({
      data: {
        tenantId,
        programVersionId,
        semesterSequence,
        moodleCourseId,
        shortname,
        fullname,
        syncStatus: 'SYNCED',
        lastSyncedAt: new Date(),
      },
    });
  }

  async syncWorkspaceCourse(tenantId: string, workspaceId: string) {
    const workspace = await this.prisma.lmsWorkspace.findFirst({
      where: { id: workspaceId, tenantId, deletedAt: null },
      include: {
        course: true,
        courseOffering: {
          include: { programVersion: { include: { program: true } } },
        },
      },
    });
    if (!workspace) return null;

    const programVersionId = workspace.courseOffering.programVersionId;
    const semesterSequence = workspace.semesterNo;
    let row =
      workspace.moodleCourseId != null
        ? await this.prisma.moodleCourse.findFirst({
            where: { tenantId, moodleCourseId: workspace.moodleCourseId },
          })
        : null;

    if (!row && programVersionId) {
      row = await this.syncProgramSemesterCourse(
        tenantId,
        programVersionId,
        semesterSequence,
      );
    }

    if (row && workspace.moodleCourseId == null) {
      await this.prisma.lmsWorkspace.update({
        where: { id: workspace.id },
        data: { moodleCourseId: row.moodleCourseId, provider: 'MOODLE' },
      });
      await this.prisma.moodleCourse.update({
        where: { id: row.id },
        data: { lmsWorkspaceId: workspace.id },
      });
    }
    return row;
  }
}
