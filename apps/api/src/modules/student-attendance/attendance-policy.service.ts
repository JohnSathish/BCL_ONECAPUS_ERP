import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/** Stored / API attendance collection modes (legacy aliases included). */
export type AttendanceMode =
  | 'PERIOD_WISE'
  | 'ONCE_PER_DAY'
  | 'MORNING_AFTERNOON'
  | 'FIRST_LAST'
  | 'EVERY_PERIOD';

export type LatePolicy = 'NONE' | 'MARK_LATE';
export type WeekendHolidayHandling = 'SKIP_NON_WORKING' | 'ALLOW_IF_GENERATED';
export type DefaultAttendanceStatus = 'P' | 'A';

export type CollectionUnit = 'PERIOD' | 'DAY' | 'MORNING' | 'AFTERNOON';

export type TenantAttendancePolicyRow = {
  id: string;
  tenantId: string;
  attendanceMode: AttendanceMode;
  /** Canonical mode used for logic (aliases resolved). */
  canonicalMode:
    | 'PERIOD_WISE'
    | 'ONCE_PER_DAY'
    | 'MORNING_AFTERNOON'
    | 'FIRST_LAST';
  shortageThresholdPct: number;
  defaulterThresholdPct: number;
  allowEditAfterSubmit: boolean;
  attendanceCutoffTime: string | null;
  lateGraceMinutes: number | null;
  latePolicy: LatePolicy;
  defaultAttendanceStatus: DefaultAttendanceStatus;
  weekendHolidayHandling: WeekendHolidayHandling;
  aggregationUnit: 'PERIOD' | 'DAY' | 'SESSION';
  unitLabels: {
    working: string;
    present: string;
    absent: string;
    percentageHint: string;
  };
  metadata?: Record<string, unknown>;
};

export type CountableTimetableEntry = {
  id: string;
  periodNo: number | null;
  planId?: string | null;
  shiftId?: string | null;
  offeringSectionId?: string | null;
  sectionCode?: string | null;
  startTime?: Date | string | null;
  isBreak?: boolean;
  slotType?: string | null;
};

export type ResolvedCountableEntry<T extends CountableTimetableEntry> = {
  entry: T;
  collectionUnit: CollectionUnit;
};

@Injectable()
export class AttendancePolicyService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  canonicalMode(
    mode: string | null | undefined,
  ): TenantAttendancePolicyRow['canonicalMode'] {
    const raw = String(mode ?? 'FIRST_LAST').toUpperCase();
    if (raw === 'EVERY_PERIOD' || raw === 'PERIOD_WISE') return 'PERIOD_WISE';
    if (raw === 'ONCE_PER_DAY') return 'ONCE_PER_DAY';
    if (raw === 'MORNING_AFTERNOON' || raw === 'SESSION_WISE') {
      return 'MORNING_AFTERNOON';
    }
    return 'FIRST_LAST';
  }

  displayMode(mode: string | null | undefined): AttendanceMode {
    const canon = this.canonicalMode(mode);
    if (canon === 'PERIOD_WISE') {
      const raw = String(mode ?? '').toUpperCase();
      return raw === 'EVERY_PERIOD' ? 'EVERY_PERIOD' : 'PERIOD_WISE';
    }
    return canon;
  }

  isDayAggregationMode(mode: string | null | undefined) {
    return this.canonicalMode(mode) === 'ONCE_PER_DAY';
  }

  isSessionAggregationMode(mode: string | null | undefined) {
    return this.canonicalMode(mode) === 'MORNING_AFTERNOON';
  }

  isPeriodAggregationMode(mode: string | null | undefined) {
    const canon = this.canonicalMode(mode);
    return canon === 'PERIOD_WISE' || canon === 'FIRST_LAST';
  }

  aggregationUnit(
    mode: string | null | undefined,
  ): 'PERIOD' | 'DAY' | 'SESSION' {
    if (this.isDayAggregationMode(mode)) return 'DAY';
    if (this.isSessionAggregationMode(mode)) return 'SESSION';
    return 'PERIOD';
  }

  unitLabels(mode: string | null | undefined) {
    const unit = this.aggregationUnit(mode);
    if (unit === 'DAY') {
      return {
        working: 'Working Days',
        present: 'Present Days',
        absent: 'Absent Days',
        percentageHint: '(Present Days ÷ Working Days) × 100',
      };
    }
    if (unit === 'SESSION') {
      return {
        working: 'Working Sessions',
        present: 'Present Sessions',
        absent: 'Absent Sessions',
        percentageHint: '(Present Sessions ÷ Working Sessions) × 100',
      };
    }
    return {
      working: 'Working Periods',
      present: 'Present Periods',
      absent: 'Absent Periods',
      percentageHint: '(Present Periods ÷ Working Periods) × 100',
    };
  }

  async getOrCreate(tenantId: string): Promise<TenantAttendancePolicyRow> {
    const existing = await this.db().tenantAttendancePolicy.findUnique({
      where: { tenantId },
    });
    if (existing) {
      return this.normalize(existing);
    }
    const created = await this.db().tenantAttendancePolicy.create({
      data: {
        tenantId,
        attendanceMode: 'FIRST_LAST',
        shortageThresholdPct: 75,
        defaulterThresholdPct: 60,
        allowEditAfterSubmit: false,
        latePolicy: 'NONE',
        defaultAttendanceStatus: 'P',
        weekendHolidayHandling: 'SKIP_NON_WORKING',
      },
    });
    return this.normalize(created);
  }

  async update(
    tenantId: string,
    input: {
      attendanceMode?: AttendanceMode;
      shortageThresholdPct?: number;
      defaulterThresholdPct?: number;
      allowEditAfterSubmit?: boolean;
      attendanceCutoffTime?: string | null;
      lateGraceMinutes?: number | null;
      latePolicy?: LatePolicy;
      defaultAttendanceStatus?: DefaultAttendanceStatus;
      weekendHolidayHandling?: WeekendHolidayHandling;
      metadata?: Record<string, unknown>;
    },
  ) {
    await this.getOrCreate(tenantId);
    const updated = await this.db().tenantAttendancePolicy.update({
      where: { tenantId },
      data: {
        ...(input.attendanceMode
          ? { attendanceMode: input.attendanceMode }
          : {}),
        ...(input.shortageThresholdPct != null
          ? { shortageThresholdPct: input.shortageThresholdPct }
          : {}),
        ...(input.defaulterThresholdPct != null
          ? { defaulterThresholdPct: input.defaulterThresholdPct }
          : {}),
        ...(input.allowEditAfterSubmit != null
          ? { allowEditAfterSubmit: Boolean(input.allowEditAfterSubmit) }
          : {}),
        ...(input.attendanceCutoffTime !== undefined
          ? {
              attendanceCutoffTime: input.attendanceCutoffTime
                ? String(input.attendanceCutoffTime).trim() || null
                : null,
            }
          : {}),
        ...(input.lateGraceMinutes !== undefined
          ? {
              lateGraceMinutes:
                input.lateGraceMinutes == null
                  ? null
                  : Number(input.lateGraceMinutes),
            }
          : {}),
        ...(input.latePolicy ? { latePolicy: input.latePolicy } : {}),
        ...(input.defaultAttendanceStatus
          ? { defaultAttendanceStatus: input.defaultAttendanceStatus }
          : {}),
        ...(input.weekendHolidayHandling
          ? { weekendHolidayHandling: input.weekendHolidayHandling }
          : {}),
        ...(input.metadata ? { metadata: input.metadata } : {}),
      },
    });
    return this.normalize(updated);
  }

  /**
   * Under FIRST_LAST, only the first and last teaching periods of the day
   * count toward % and are offered for marking. Breaks (periodNo 0) never count.
   */
  isPeriodCountable(
    mode: string | null | undefined,
    periodNo: number | null | undefined,
    teachingPeriodNos: number[],
  ) {
    if (periodNo == null || periodNo <= 0) return false;
    const canon = this.canonicalMode(mode);
    if (canon === 'PERIOD_WISE') return true;
    if (canon === 'ONCE_PER_DAY') {
      const sorted = [...new Set(teachingPeriodNos.filter((n) => n > 0))].sort(
        (a, b) => a - b,
      );
      return sorted.length > 0 && periodNo === sorted[0];
    }
    if (canon === 'MORNING_AFTERNOON') {
      // Period-level helper for reports falling back without collectionUnit tags.
      return periodNo > 0;
    }
    const sorted = [...new Set(teachingPeriodNos.filter((n) => n > 0))].sort(
      (a, b) => a - b,
    );
    if (!sorted.length) return false;
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    return periodNo === first || periodNo === last;
  }

  cohortKey(entry: CountableTimetableEntry) {
    const planId = entry.planId ?? 'no-plan';
    const shiftId = entry.shiftId ?? 'no-shift';
    const section =
      (entry.sectionCode && String(entry.sectionCode).trim()) ||
      entry.offeringSectionId ||
      'no-section';
    return `${planId}|${shiftId}|${section}`;
  }

  /**
   * Pick which timetable entries should generate attendance sessions
   * for the tenant collection mode.
   */
  resolveCountableEntries<T extends CountableTimetableEntry>(
    mode: string | null | undefined,
    entries: T[],
  ): ResolvedCountableEntry<T>[] {
    const teaching = entries.filter((e) => {
      const periodNo = Number(e.periodNo ?? 0);
      if (periodNo <= 0) return false;
      if (e.isBreak) return false;
      const slot = String(e.slotType ?? '').toUpperCase();
      if (slot === 'BREAK' || slot === 'LUNCH') return false;
      return true;
    });

    const canon = this.canonicalMode(mode);
    if (canon === 'PERIOD_WISE') {
      return teaching.map((entry) => ({
        entry,
        collectionUnit: 'PERIOD' as const,
      }));
    }

    if (canon === 'FIRST_LAST') {
      const byCohort = new Map<string, T[]>();
      for (const entry of teaching) {
        const key = this.cohortKey(entry);
        const bucket = byCohort.get(key) ?? [];
        bucket.push(entry);
        byCohort.set(key, bucket);
      }
      const out: ResolvedCountableEntry<T>[] = [];
      for (const group of byCohort.values()) {
        const teachingPeriodNos = group
          .map((e) => Number(e.periodNo))
          .filter((n) => n > 0);
        for (const entry of group) {
          if (this.isPeriodCountable(mode, entry.periodNo, teachingPeriodNos)) {
            out.push({ entry, collectionUnit: 'PERIOD' });
          }
        }
      }
      return out;
    }

    if (canon === 'ONCE_PER_DAY') {
      return this.pickFirstPerCohort(teaching, 'DAY');
    }

    // MORNING_AFTERNOON
    const lunchPeriod = this.findLunchBreakPeriodNo(entries);
    const byCohort = new Map<string, T[]>();
    for (const entry of teaching) {
      const key = this.cohortKey(entry);
      const bucket = byCohort.get(key) ?? [];
      bucket.push(entry);
      byCohort.set(key, bucket);
    }

    const out: ResolvedCountableEntry<T>[] = [];
    for (const group of byCohort.values()) {
      const sorted = [...group].sort(
        (a, b) => Number(a.periodNo) - Number(b.periodNo),
      );
      const morning = sorted.filter((e) =>
        lunchPeriod == null
          ? Number(e.periodNo) <= this.midPeriodFallback(sorted)
          : Number(e.periodNo) < lunchPeriod,
      );
      const afternoon = sorted.filter((e) =>
        lunchPeriod == null
          ? Number(e.periodNo) > this.midPeriodFallback(sorted)
          : Number(e.periodNo) > lunchPeriod,
      );
      if (morning.length) {
        out.push({ entry: morning[0], collectionUnit: 'MORNING' });
      }
      if (afternoon.length) {
        out.push({ entry: afternoon[0], collectionUnit: 'AFTERNOON' });
      }
    }
    return out;
  }

  private pickFirstPerCohort<T extends CountableTimetableEntry>(
    teaching: T[],
    collectionUnit: CollectionUnit,
  ): ResolvedCountableEntry<T>[] {
    const byCohort = new Map<string, T[]>();
    for (const entry of teaching) {
      const key = this.cohortKey(entry);
      const bucket = byCohort.get(key) ?? [];
      bucket.push(entry);
      byCohort.set(key, bucket);
    }
    const out: ResolvedCountableEntry<T>[] = [];
    for (const group of byCohort.values()) {
      const sorted = [...group].sort(
        (a, b) => Number(a.periodNo) - Number(b.periodNo),
      );
      if (sorted[0]) {
        out.push({ entry: sorted[0], collectionUnit });
      }
    }
    return out;
  }

  /** Lunch break = break slot (periodNo ≤ 0 or isBreak) between teaching periods. */
  findLunchBreakPeriodNo(entries: CountableTimetableEntry[]): number | null {
    const ordered = [...entries].sort((a, b) => {
      const pa = Number(a.periodNo ?? 0);
      const pb = Number(b.periodNo ?? 0);
      if (pa !== pb) return pa - pb;
      return String(a.startTime ?? '').localeCompare(String(b.startTime ?? ''));
    });
    const teachingNos = ordered
      .filter((e) => Number(e.periodNo ?? 0) > 0 && !e.isBreak)
      .map((e) => Number(e.periodNo));
    if (teachingNos.length < 2) return null;

    for (const e of ordered) {
      const pn = Number(e.periodNo ?? 0);
      const isBreak =
        e.isBreak ||
        pn <= 0 ||
        ['BREAK', 'LUNCH'].includes(String(e.slotType ?? '').toUpperCase());
      if (!isBreak || pn <= 0) continue;
      const before = teachingNos.some((n) => n < pn);
      const after = teachingNos.some((n) => n > pn);
      if (before && after) return pn;
    }

    // Largest start-time gap between consecutive teaching periods (lunch).
    const teachingWithTime = ordered.filter(
      (e) => Number(e.periodNo ?? 0) > 0 && !e.isBreak,
    );
    if (teachingWithTime.length < 2) return null;

    let bestGap = 0;
    let splitAfterPeriod: number | null = null;
    for (let i = 1; i < teachingWithTime.length; i++) {
      const prev = teachingWithTime[i - 1];
      const next = teachingWithTime[i];
      const prevM = this.minutesFromTime(prev.startTime);
      const nextM = this.minutesFromTime(next.startTime);
      if (prevM == null || nextM == null) continue;
      const gap = nextM - prevM;
      if (gap > bestGap) {
        bestGap = gap;
        splitAfterPeriod = Number(prev.periodNo);
      }
    }
    if (bestGap >= 30 && splitAfterPeriod != null) {
      return splitAfterPeriod + 0.5;
    }

    return null;
  }

  private midPeriodFallback(sortedTeaching: CountableTimetableEntry[]) {
    if (!sortedTeaching.length) return 0;
    const nos = sortedTeaching.map((e) => Number(e.periodNo));
    const mid = (Math.min(...nos) + Math.max(...nos)) / 2;
    return mid;
  }

  private minutesFromTime(
    value: Date | string | null | undefined,
  ): number | null {
    if (value == null) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.getUTCHours() * 60 + value.getUTCMinutes();
    }
    const raw = String(value);
    const match = raw.match(/(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  /**
   * Whether a stored attendance entry should count under the current mode.
   * Day/AM-PM prefer metadata.collectionUnit; otherwise fall back to period rules.
   */
  isEntryCountable(params: {
    mode: string | null | undefined;
    periodNo: number | null | undefined;
    teachingPeriodNos: number[];
    collectionUnit?: string | null;
  }) {
    const canon = this.canonicalMode(params.mode);
    const unit = String(params.collectionUnit ?? '').toUpperCase();

    if (canon === 'ONCE_PER_DAY') {
      if (unit) return unit === 'DAY';
      return this.isPeriodCountable(
        params.mode,
        params.periodNo,
        params.teachingPeriodNos,
      );
    }
    if (canon === 'MORNING_AFTERNOON') {
      if (unit) return unit === 'MORNING' || unit === 'AFTERNOON';
      return this.isPeriodCountable(
        params.mode,
        params.periodNo,
        params.teachingPeriodNos,
      );
    }
    return this.isPeriodCountable(
      params.mode,
      params.periodNo,
      params.teachingPeriodNos,
    );
  }

  private normalize(row: any): TenantAttendancePolicyRow {
    const attendanceMode = this.displayMode(row.attendanceMode);
    const canonicalMode = this.canonicalMode(row.attendanceMode);
    const latePolicy: LatePolicy =
      String(row.latePolicy ?? 'NONE').toUpperCase() === 'MARK_LATE'
        ? 'MARK_LATE'
        : 'NONE';
    const defaultAttendanceStatus: DefaultAttendanceStatus =
      String(row.defaultAttendanceStatus ?? 'P').toUpperCase() === 'A'
        ? 'A'
        : 'P';
    const weekendHolidayHandling: WeekendHolidayHandling =
      String(row.weekendHolidayHandling ?? 'SKIP_NON_WORKING').toUpperCase() ===
      'ALLOW_IF_GENERATED'
        ? 'ALLOW_IF_GENERATED'
        : 'SKIP_NON_WORKING';

    return {
      id: row.id,
      tenantId: row.tenantId,
      attendanceMode,
      canonicalMode,
      shortageThresholdPct: Number(row.shortageThresholdPct ?? 75),
      defaulterThresholdPct: Number(row.defaulterThresholdPct ?? 60),
      allowEditAfterSubmit: Boolean(row.allowEditAfterSubmit ?? false),
      attendanceCutoffTime: row.attendanceCutoffTime
        ? String(row.attendanceCutoffTime)
        : null,
      lateGraceMinutes:
        row.lateGraceMinutes == null ? null : Number(row.lateGraceMinutes),
      latePolicy,
      defaultAttendanceStatus,
      weekendHolidayHandling,
      aggregationUnit: this.aggregationUnit(row.attendanceMode),
      unitLabels: this.unitLabels(row.attendanceMode),
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
    };
  }
}
