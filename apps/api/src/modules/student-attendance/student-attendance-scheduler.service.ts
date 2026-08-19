import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import {
  DEFAULT_INSTITUTION_TIMEZONE,
  getZonedDateKey,
} from '../../common/utils/time-greeting';
import { StudentAttendanceService } from './student-attendance.service';

@Injectable()
export class StudentAttendanceSchedulerService {
  private readonly logger = new Logger(StudentAttendanceSchedulerService.name);
  private running = false;
  private lastSuccessDateKey: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly attendance: StudentAttendanceService,
  ) {}

  /**
   * Create today's timetable-linked attendance sessions at 06:00 IST,
   * with a 07:00 retry if the first run was missed or failed.
   * Upserts are idempotent, so a successful 06:00 run makes 07:00 a no-op.
   */
  @Cron('0 0 6,7 * * *', {
    timeZone: DEFAULT_INSTITUTION_TIMEZONE,
    name: 'student-attendance-morning-generate',
    waitForCompletion: true,
  })
  async generateMorningSessions() {
    if (process.env.PROCESS_BACKGROUND_JOBS === 'worker') return;
    if (this.running) {
      this.logger.warn(
        'Morning attendance generate already running — skipping overlap',
      );
      return;
    }

    const date = getZonedDateKey();
    if (this.lastSuccessDateKey === date) {
      this.logger.log(
        `Morning attendance already generated for ${date} — skipping retry`,
      );
      return;
    }

    this.running = true;
    let allSucceeded = true;
    try {
      const tenants = await this.prisma.tenant.findMany({
        where: { status: 'active', deletedAt: null },
        select: { id: true, slug: true },
      });

      this.logger.log(
        `Morning attendance generate ${date}: ${tenants.length} active tenant(s)`,
      );

      for (const tenant of tenants) {
        try {
          const publishedCount = await this.prisma.timetablePlan.count({
            where: {
              tenantId: tenant.id,
              status: 'PUBLISHED',
              deletedAt: null,
            },
          });
          if (!publishedCount) {
            this.logger.log(
              `Skipping attendance generate tenant=${tenant.slug} (no published timetable)`,
            );
            continue;
          }

          const result = await this.attendance.generateSessionsForTenant(
            tenant.id,
            { date },
            null,
          );
          this.logger.log(
            `Morning attendance tenant=${tenant.slug} date=${date} created=${result.created}${
              result.skipped ? ` skipped=${result.reason}` : ''
            }`,
          );
        } catch (err) {
          allSucceeded = false;
          this.logger.error(
            `Morning attendance generate failed tenant=${tenant.slug} date=${date}`,
            err instanceof Error ? err.stack : String(err),
          );
        }
      }

      if (allSucceeded) this.lastSuccessDateKey = date;
    } catch (err) {
      this.logger.error(
        `Morning attendance generate aborted date=${date}`,
        err instanceof Error ? err.stack : String(err),
      );
    } finally {
      this.running = false;
    }
  }
}
