import { Injectable, Logger } from '@nestjs/common';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { AcademicCalendarService } from '../academic-calendar/academic-calendar.service';
import {
  parseDateOnly,
  toDateOnlyIso,
} from '../academic-calendar/academic-calendar.types';

const SOURCE_MODULE = 'fees';

type CalendarActor = Pick<JwtUser, 'tid' | 'sub'>;

@Injectable()
export class FeeCalendarSyncService {
  private readonly logger = new Logger(FeeCalendarSyncService.name);

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

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  private async loadSettings(tenantId: string) {
    let settings = await this.db().feeFinanceSettings.findUnique({
      where: { tenantId },
    });
    if (!settings) {
      settings = {
        monthlyDueDay: 10,
        lateFeeEnabled: false,
        lateFeeGraceDays: 0,
      };
    }
    return settings as {
      monthlyDueDay?: number;
      lateFeeEnabled?: boolean;
      lateFeeGraceDays?: number;
    };
  }

  private dueDateForPeriod(billingPeriod: string, monthlyDueDay: number) {
    const [year, month] = billingPeriod.split('-').map(Number);
    const day = monthlyDueDay || 10;
    return new Date(year, month - 1, day);
  }

  /**
   * Institutional FEE_DUE (+ optional FEE_FINE_START) for a structure/yearly
   * demand generation batch — not per-student.
   */
  async syncStructureDue(
    user: JwtUser,
    input: {
      academicYearId?: string | null;
      dueDate?: string | Date | null;
      billingPeriod?: string | null;
      demandType?: string | null;
      title?: string;
    },
  ): Promise<void> {
    try {
      if (!input.dueDate) return;
      const academicYearId =
        input.academicYearId ||
        (await this.resolveAcademicYearId(user.tid, new Date(input.dueDate)));
      if (!academicYearId) {
        this.logger.debug('Skip fee calendar sync: no academicYearId');
        return;
      }

      const dueIso = toDateOnlyIso(input.dueDate);
      const periodKey = input.billingPeriod?.trim() || 'general';
      const typeKey = (input.demandType ?? 'GENERAL').toUpperCase();
      const dueRef = `due:${academicYearId}:${dueIso}:${periodKey}:${typeKey}`;
      const title =
        input.title?.trim() ||
        (input.billingPeriod
          ? `Fee due — ${input.billingPeriod}`
          : `Fee due — ${typeKey}`);

      await this.calendars.upsertFromSource(user, {
        academicYearId,
        sourceModule: SOURCE_MODULE,
        sourceRefId: dueRef,
        type: 'FEE_DUE',
        title,
        description: 'Fee payment due date',
        startDate: dueIso,
        endDate: dueIso,
        visibility: 'INTERNAL',
        publishedToWebsite: false,
        createsAttendanceSession: false,
      });

      await this.syncFineStartFromDue(user, {
        academicYearId,
        dueDate: dueIso,
        sourceKey: dueRef,
        titlePrefix: title,
      });
    } catch (err) {
      this.logger.warn(
        `Academic calendar fee due sync failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /** Period-level monthly FEE_DUE + FEE_FINE_START (one event per YYYY-MM). */
  async syncMonthlyPeriod(
    actor: CalendarActor,
    billingPeriod: string,
  ): Promise<void> {
    try {
      const user = this.asUser(actor);
      const settings = await this.loadSettings(actor.tid);
      const dueDate = this.dueDateForPeriod(
        billingPeriod,
        Number(settings.monthlyDueDay) || 10,
      );
      const academicYearId = await this.resolveAcademicYearId(
        actor.tid,
        dueDate,
      );
      if (!academicYearId) {
        this.logger.debug(
          `Skip monthly fee calendar sync for ${billingPeriod}: no academicYearId`,
        );
        return;
      }

      const dueIso = toDateOnlyIso(dueDate);
      const dueRef = `monthly:${billingPeriod}`;
      const title = `Monthly fee due — ${billingPeriod}`;

      await this.calendars.upsertFromSource(user, {
        academicYearId,
        sourceModule: SOURCE_MODULE,
        sourceRefId: dueRef,
        type: 'FEE_DUE',
        title,
        description: 'Monthly tuition due date',
        startDate: dueIso,
        endDate: dueIso,
        visibility: 'INTERNAL',
        publishedToWebsite: false,
        createsAttendanceSession: false,
      });

      await this.syncFineStartFromDue(user, {
        academicYearId,
        dueDate: dueIso,
        sourceKey: dueRef,
        titlePrefix: title,
      });
    } catch (err) {
      this.logger.warn(
        `Academic calendar monthly fee sync failed for ${billingPeriod}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /**
   * When monthly due-day / grace settings change, refresh current + next period.
   */
  async syncFromSettings(user: JwtUser): Promise<void> {
    try {
      const now = new Date();
      const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const next = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
      await this.syncMonthlyPeriod(user, current);
      await this.syncMonthlyPeriod(user, next);
    } catch (err) {
      this.logger.warn(
        `Academic calendar fee settings sync failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private async syncFineStartFromDue(
    user: JwtUser,
    input: {
      academicYearId: string;
      dueDate: string;
      sourceKey: string;
      titlePrefix: string;
    },
  ) {
    const settings = await this.loadSettings(user.tid);
    if (!settings.lateFeeEnabled) {
      await this.calendars.removeFromSource(
        user.tid,
        SOURCE_MODULE,
        `fine:${input.sourceKey}`,
        user.sub,
      );
      return;
    }
    const grace = Number(settings.lateFeeGraceDays) || 0;
    const due = parseDateOnly(input.dueDate);
    const fineStart = new Date(due);
    fineStart.setUTCDate(fineStart.getUTCDate() + Math.max(0, grace));
    const fineIso = toDateOnlyIso(fineStart);

    await this.calendars.upsertFromSource(user, {
      academicYearId: input.academicYearId,
      sourceModule: SOURCE_MODULE,
      sourceRefId: `fine:${input.sourceKey}`,
      type: 'FEE_FINE_START',
      title: `${input.titlePrefix} — fine starts`,
      description:
        grace > 0
          ? `Late fee begins after ${grace} grace day(s)`
          : 'Late fee begins on due date',
      startDate: fineIso,
      endDate: fineIso,
      visibility: 'INTERNAL',
      publishedToWebsite: false,
      createsAttendanceSession: false,
    });
  }

  private async resolveAcademicYearId(
    tenantId: string,
    onDate: Date,
  ): Promise<string | null> {
    const covering = await this.prisma.academicYear.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        startDate: { lte: onDate },
        endDate: { gte: onDate },
      },
      orderBy: [{ isPrimarySession: 'desc' }, { startDate: 'desc' }],
      select: { id: true },
    });
    if (covering) return covering.id;

    const primary = await this.prisma.academicYear.findFirst({
      where: { tenantId, deletedAt: null, isPrimarySession: true },
      orderBy: { startDate: 'desc' },
      select: { id: true },
    });
    if (primary) return primary.id;

    const latest = await this.prisma.academicYear.findFirst({
      where: { tenantId, deletedAt: null },
      orderBy: { startDate: 'desc' },
      select: { id: true },
    });
    return latest?.id ?? null;
  }
}
