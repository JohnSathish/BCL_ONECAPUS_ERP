import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MoodleApiService } from './moodle-api.service';
import { MoodleSettingsService } from './moodle-settings.service';

@Injectable()
export class MoodleGradeSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly api: MoodleApiService,
    private readonly settings: MoodleSettingsService,
  ) {}

  async syncCourseGrades(tenantId: string, moodleCourseRowId: string) {
    const cfg = await this.prisma.moodleSettings.findUnique({
      where: { tenantId },
    });
    if (!cfg?.enableSync || !cfg.enableGradeSync) return { synced: 0 };

    const course = await this.prisma.moodleCourse.findFirst({
      where: { id: moodleCourseRowId, tenantId },
    });
    if (!course) return { synced: 0 };

    const grades = await this.api.call<{
      usergrades?: Array<Record<string, unknown>>;
    }>({
      tenantId,
      wsfunction: 'gradereport_user_get_grade_items',
      params: { courseid: course.moodleCourseId },
    });

    let synced = 0;
    for (const userGrade of grades.usergrades ?? []) {
      const moodleUserId = Number(userGrade.userid);
      const items =
        (userGrade.gradeitems as Array<Record<string, unknown>> | undefined) ??
        [];
      for (const item of items) {
        await this.prisma.moodleGrade.create({
          data: {
            tenantId,
            moodleCourseId: course.id,
            moodleUserId,
            itemType: String(item.itemtype ?? 'unknown'),
            itemName: String(item.itemname ?? 'Grade'),
            gradeValue: item.graderaw != null ? Number(item.graderaw) : null,
            gradeMax: item.grademax != null ? Number(item.grademax) : null,
            rawPayload: item as object,
            lastSyncedAt: new Date(),
          },
        });
        synced += 1;
      }
    }
    return { synced };
  }
}
