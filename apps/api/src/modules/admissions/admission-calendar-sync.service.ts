import { Injectable, Logger } from '@nestjs/common';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { AcademicCalendarService } from '../academic-calendar/academic-calendar.service';
import { toDateOnlyIso } from '../academic-calendar/academic-calendar.types';

const SOURCE_MODULE = 'admissions';

type CalendarActor = Pick<JwtUser, 'tid' | 'sub'>;

@Injectable()
export class AdmissionCalendarSyncService {
  private readonly logger = new Logger(AdmissionCalendarSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calendars: AcademicCalendarService,
  ) {}

  private asUser(actor: CalendarActor): JwtUser {
    return {
      tid: actor.tid,
      sub: actor.sub,
      email: '',
      roles: [],
      permissions: [],
    };
  }

  /**
   * Sync AdmissionCycle → ADMISSION_WINDOW.
   * Soft-fails so admissions writes never break.
   */
  async syncCycle(
    tenantId: string,
    cycleId: string,
    actorId?: string | null,
  ): Promise<void> {
    const actor: CalendarActor = {
      tid: tenantId,
      sub: actorId || 'system',
    };
    try {
      const cycle = await this.prisma.admissionCycle.findFirst({
        where: { id: cycleId, tenantId },
      });
      if (!cycle || cycle.deletedAt || cycle.status === 'ARCHIVED') {
        await this.calendars.removeFromSource(
          tenantId,
          SOURCE_MODULE,
          cycleId,
          actor.sub,
        );
        return;
      }
      if (!cycle.academicYearId) {
        this.logger.debug(
          `Skip admission calendar sync for ${cycleId}: no academicYearId`,
        );
        return;
      }

      const candidates = [
        cycle.registrationOpensAt,
        cycle.registrationClosesAt,
        cycle.applicationDeadline,
        cycle.paymentDeadline,
      ].filter(Boolean) as Date[];

      if (!candidates.length) {
        this.logger.debug(
          `Skip admission calendar sync for ${cycleId}: no window dates`,
        );
        return;
      }

      const start =
        cycle.registrationOpensAt ??
        candidates.reduce((a, b) => (a < b ? a : b));
      const endCandidates = [
        cycle.registrationClosesAt,
        cycle.applicationDeadline,
        cycle.paymentDeadline,
      ].filter(Boolean) as Date[];
      const end = endCandidates.length
        ? endCandidates.reduce((a, b) => (a > b ? a : b))
        : start;

      const startIso = toDateOnlyIso(start);
      const endIso = toDateOnlyIso(end);
      const publicWindow = cycle.status === 'OPEN';

      await this.calendars.upsertFromSource(this.asUser(actor), {
        academicYearId: cycle.academicYearId,
        sourceModule: SOURCE_MODULE,
        sourceRefId: cycle.id,
        type: 'ADMISSION_WINDOW',
        title: cycle.title || cycle.code || 'Admission window',
        description: [
          cycle.registrationOpensAt
            ? `Opens ${toDateOnlyIso(cycle.registrationOpensAt)}`
            : null,
          cycle.registrationClosesAt
            ? `Closes ${toDateOnlyIso(cycle.registrationClosesAt)}`
            : null,
          cycle.applicationDeadline
            ? `Application deadline ${toDateOnlyIso(cycle.applicationDeadline)}`
            : null,
          cycle.paymentDeadline
            ? `Payment deadline ${toDateOnlyIso(cycle.paymentDeadline)}`
            : null,
        ]
          .filter(Boolean)
          .join(' · '),
        startDate: startIso,
        endDate: endIso < startIso ? startIso : endIso,
        visibility: publicWindow ? 'PUBLIC' : 'INTERNAL',
        publishedToWebsite: publicWindow,
        createsAttendanceSession: false,
      });
    } catch (err) {
      this.logger.warn(
        `Academic calendar sync failed for admission cycle ${cycleId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async removeCycle(
    tenantId: string,
    cycleId: string,
    actorId?: string | null,
  ): Promise<void> {
    try {
      await this.calendars.removeFromSource(
        tenantId,
        SOURCE_MODULE,
        cycleId,
        actorId || 'system',
      );
    } catch (err) {
      this.logger.warn(
        `Academic calendar remove failed for admission cycle ${cycleId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /** After year provisioning archives prior cycles. */
  async removeCycles(
    tenantId: string,
    cycleIds: string[],
    actorId?: string | null,
  ): Promise<void> {
    for (const id of cycleIds) {
      await this.removeCycle(tenantId, id, actorId);
    }
  }
}
