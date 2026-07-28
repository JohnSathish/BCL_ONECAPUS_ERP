import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MoodleApiService } from './moodle-api.service';
import { MoodleSettingsService } from './moodle-settings.service';

@Injectable()
export class MoodleAssignmentSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly api: MoodleApiService,
    private readonly settings: MoodleSettingsService,
  ) {}

  async syncCourseAssignments(tenantId: string, moodleCourseRowId: string) {
    const cfg = await this.prisma.moodleSettings.findUnique({
      where: { tenantId },
    });
    if (!cfg?.enableSync || !cfg.enableAssignmentSync) return { synced: 0 };

    const course = await this.prisma.moodleCourse.findFirst({
      where: { id: moodleCourseRowId, tenantId },
    });
    if (!course) return { synced: 0 };

    const contents = await this.api.call<
      Array<{ modules?: Array<Record<string, unknown>> }>
    >({
      tenantId,
      wsfunction: 'core_course_get_contents',
      params: { courseid: course.moodleCourseId },
    });

    let synced = 0;
    for (const section of contents ?? []) {
      for (const mod of section.modules ?? []) {
        if (mod.modname !== 'assign') continue;
        const moodleAssignmentId = Number(mod.instance);
        const name = String(mod.name ?? 'Assignment');
        await this.prisma.moodleAssignment.upsert({
          where: {
            tenantId_moodleAssignmentId: { tenantId, moodleAssignmentId },
          },
          create: {
            tenantId,
            moodleCourseId: course.id,
            moodleAssignmentId,
            name,
            rawPayload: mod as object,
            lastSyncedAt: new Date(),
          },
          update: {
            name,
            rawPayload: mod as object,
            lastSyncedAt: new Date(),
          },
        });
        synced += 1;
      }
    }
    return { synced };
  }
}
