import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MoodleSettingsService } from './moodle-settings.service';

@Injectable()
export class MoodleAttendanceSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: MoodleSettingsService,
  ) {}

  /** Bidirectional attendance bridge placeholder — stores ERP-side sessions for Moodle pull. */
  async pushErpSession(input: {
    tenantId: string;
    moodleCourseRowId: string;
    moodleUserId: number;
    sessionDate: string;
    status: string;
  }) {
    const cfg = await this.prisma.moodleSettings.findUnique({
      where: { tenantId: input.tenantId },
    });
    if (!cfg?.enableSync || !cfg.enableAttendanceSync) return null;

    return this.prisma.moodleAttendance.upsert({
      where: {
        tenantId_moodleCourseId_moodleUserId_sessionDate: {
          tenantId: input.tenantId,
          moodleCourseId: input.moodleCourseRowId,
          moodleUserId: input.moodleUserId,
          sessionDate: new Date(`${input.sessionDate}T00:00:00.000Z`),
        },
      },
      create: {
        tenantId: input.tenantId,
        moodleCourseId: input.moodleCourseRowId,
        moodleUserId: input.moodleUserId,
        sessionDate: new Date(`${input.sessionDate}T00:00:00.000Z`),
        status: input.status,
        source: 'ERP',
        lastSyncedAt: new Date(),
      },
      update: {
        status: input.status,
        source: 'ERP',
        lastSyncedAt: new Date(),
      },
    });
  }

  async listCourseAttendance(tenantId: string, moodleCourseRowId: string) {
    return this.prisma.moodleAttendance.findMany({
      where: { tenantId, moodleCourseId: moodleCourseRowId },
      orderBy: { sessionDate: 'desc' },
      take: 500,
    });
  }
}
