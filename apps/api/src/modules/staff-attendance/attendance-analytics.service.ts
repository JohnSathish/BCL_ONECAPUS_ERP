import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

type DailyRow = {
  staffProfileId: string;
  status: string;
  attendanceDate?: Date;
  firstInAt: Date | null;
  lastOutAt: Date | null;
  lateMinutes: number;
  workedMinutes: number;
  overtimeMinutes: number;
  exceptionFlags: unknown;
  staff?: {
    id?: string;
    fullName?: string;
    employeeCode?: string;
    department?: { id?: string; name?: string } | null;
  };
};

const PRESENT_STATUSES = new Set(['PRESENT', 'LATE', 'EARLY_EXIT', 'OVERTIME']);

@Injectable()
export class AttendanceAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async commandCenter(tenantId: string) {
    const today = this.dateOnly(new Date());
    const tomorrow = this.addDays(today, 1);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonthStart = new Date(
      today.getFullYear(),
      today.getMonth() - 1,
      1,
    );
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    const thirtyDaysAgo = this.addDays(today, -29);

    const [
      activeStaffCount,
      devices,
      todayRecords,
      todayInPunches,
      pendingCorrections,
      devicePunchCounts,
      monthRecords,
      lastMonthRecords,
      trendRecords,
      recentPunches,
    ] = await Promise.all([
      this.db().staffProfile.count({
        where: { tenantId, deletedAt: null },
      }),
      this.db().staffBiometricDevice.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { name: 'asc' },
        include: { _count: { select: { rawPunches: true, mappings: true } } },
      }),
      this.db().staffAttendanceDailyRecord.findMany({
        where: { tenantId, attendanceDate: today },
        include: {
          staff: {
            select: {
              id: true,
              fullName: true,
              employeeCode: true,
              department: { select: { id: true, name: true } },
            },
          },
        },
        take: 10000,
      }),
      this.db().staffAttendanceRawPunch.findMany({
        where: {
          tenantId,
          punchTimestamp: { gte: today, lt: tomorrow },
        },
        select: { punchTimestamp: true, punchDirection: true },
        take: 20000,
      }),
      this.db().staffAttendanceCorrection.count({
        where: { tenantId, status: 'PENDING' },
      }),
      this.db().staffAttendanceRawPunch.findMany({
        where: {
          tenantId,
          punchTimestamp: { gte: today, lt: tomorrow },
          deviceId: { not: null },
        },
        select: { deviceId: true },
        take: 50000,
      }),
      this.fetchRecordsBetween(tenantId, monthStart, today),
      this.fetchRecordsBetween(tenantId, lastMonthStart, lastMonthEnd),
      this.fetchRecordsBetween(tenantId, thirtyDaysAgo, today),
      this.db().staffAttendanceRawPunch.findMany({
        where: { tenantId },
        orderBy: { punchTimestamp: 'desc' },
        take: 8,
        include: {
          staff: {
            select: {
              fullName: true,
              employeeCode: true,
              department: { select: { name: true } },
            },
          },
          device: {
            select: { id: true, name: true, location: true, building: true },
          },
        },
      }),
    ]);

    const punchedInToday = todayRecords.filter(
      (r: DailyRow) => r.firstInAt,
    ).length;
    const currentlyInside = todayRecords.filter(
      (r: DailyRow) =>
        r.firstInAt &&
        !r.lastOutAt &&
        (PRESENT_STATUSES.has(String(r.status)) ||
          this.hasFlag(r, 'MISSED_OUT')),
    ).length;
    const alreadyLeft = todayRecords.filter(
      (r: DailyRow) => r.firstInAt && r.lastOutAt,
    ).length;
    const notYetPunched = Math.max(0, activeStaffCount - punchedInToday);
    const missingOut = todayRecords.filter((r: DailyRow) =>
      this.hasFlag(r, 'MISSED_OUT'),
    ).length;

    const deviceCountMap = new Map<string, number>();
    for (const row of devicePunchCounts as Array<{ deviceId: string | null }>) {
      if (!row.deviceId) continue;
      deviceCountMap.set(
        row.deviceId,
        (deviceCountMap.get(row.deviceId) ?? 0) + 1,
      );
    }

    const todaySummary = {
      present: todayRecords.filter((r: DailyRow) =>
        PRESENT_STATUSES.has(String(r.status)),
      ).length,
      late: todayRecords.filter(
        (r: DailyRow) => (r.lateMinutes ?? 0) > 0 || this.hasFlag(r, 'LATE'),
      ).length,
      absent: todayRecords.filter((r: DailyRow) => r.status === 'ABSENT')
        .length,
      onLeave: todayRecords.filter((r: DailyRow) => r.status === 'ON_LEAVE')
        .length,
      wfh: todayRecords.filter((r: DailyRow) => r.status === 'WFH').length,
      holiday: todayRecords.filter((r: DailyRow) => r.status === 'HOLIDAY')
        .length,
      weeklyOff: todayRecords.filter((r: DailyRow) => r.status === 'WEEKLY_OFF')
        .length,
      halfDay: todayRecords.filter((r: DailyRow) => r.status === 'HALF_DAY')
        .length,
    };

    return {
      generatedAt: new Date(),
      today: todaySummary,
      liveStatus: {
        activeStaff: activeStaffCount,
        currentlyInside,
        alreadyLeft,
        notYetPunched,
        missingOut,
      },
      arrivalTimeline: this.buildArrivalTimeline(todayInPunches),
      devices: devices.map((device: Record<string, unknown>) =>
        this.toDeviceCard(device, deviceCountMap.get(device.id as string) ?? 0),
      ),
      departmentHeatmap: this.buildDepartmentHeatmap(todayRecords),
      departmentRanking: this.buildDepartmentRanking(monthRecords),
      weeklyPattern: this.buildWeeklyPattern(trendRecords),
      trends: this.buildTrends(trendRecords),
      monthlyAnalytics: this.buildMonthlyAnalytics(
        monthRecords,
        lastMonthRecords,
      ),
      insights: this.buildInsights(
        tenantId,
        todayRecords,
        monthRecords,
        lastMonthRecords,
        devices,
      ),
      alerts: this.buildAlerts(
        todayRecords,
        devices,
        pendingCorrections,
        missingOut,
      ),
      recentPunches: recentPunches.map((punch: Record<string, unknown>) => ({
        id: punch.id,
        staffName:
          (punch.staff as { fullName?: string })?.fullName ??
          `User ${punch.deviceUserId}`,
        employeeCode: (punch.staff as { employeeCode?: string })?.employeeCode,
        department: (punch.staff as { department?: { name?: string } })
          ?.department?.name,
        deviceName:
          (punch.device as { name?: string })?.name ?? 'Unknown device',
        location:
          (punch.device as { location?: string; building?: string })
            ?.location ?? (punch.device as { building?: string })?.building,
        punchTimestamp: punch.punchTimestamp,
        direction: this.inferDirection(punch),
      })),
      pendingCorrections,
      deviceOnline: devices.filter(
        (d: { networkStatus?: string; status?: string }) =>
          d.networkStatus === 'ONLINE' ||
          ['CONNECTED', 'ONLINE'].includes(String(d.status)),
      ).length,
    };
  }

  async staffTimeline(
    tenantId: string,
    staffProfileId: string,
    dateInput?: string,
  ) {
    const staff = await this.db().staffProfile.findFirst({
      where: { id: staffProfileId, tenantId, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        department: { select: { name: true } },
      },
    });
    if (!staff) throw new NotFoundException('Staff profile not found');

    const date = dateInput
      ? this.dateOnly(new Date(dateInput))
      : this.dateOnly(new Date());
    const next = this.addDays(date, 1);

    const [punches, record, monthRecords] = await Promise.all([
      this.db().staffAttendanceRawPunch.findMany({
        where: {
          tenantId,
          staffProfileId,
          punchTimestamp: { gte: date, lt: next },
        },
        orderBy: { punchTimestamp: 'asc' },
        include: {
          device: { select: { name: true, location: true, building: true } },
        },
      }),
      this.db().staffAttendanceDailyRecord.findFirst({
        where: { tenantId, staffProfileId, attendanceDate: date },
      }),
      this.db().staffAttendanceDailyRecord.findMany({
        where: {
          tenantId,
          staffProfileId,
          attendanceDate: {
            gte: new Date(date.getFullYear(), date.getMonth(), 1),
            lte: new Date(date.getFullYear(), date.getMonth() + 1, 0),
          },
        },
        orderBy: { attendanceDate: 'asc' },
      }),
    ]);

    return {
      staff,
      date,
      timeline: punches.map(
        (punch: Record<string, unknown>, index: number) => ({
          id: punch.id,
          time: punch.punchTimestamp,
          label: this.inferDirection(punch, index, punches.length),
          deviceName: (punch.device as { name?: string })?.name,
          location:
            (punch.device as { location?: string; building?: string })
              ?.location ?? (punch.device as { building?: string })?.building,
        }),
      ),
      summary: record
        ? {
            status: record.status,
            firstInAt: record.firstInAt,
            lastOutAt: record.lastOutAt,
            workedMinutes: record.workedMinutes,
            lateMinutes: record.lateMinutes,
            overtimeMinutes: record.overtimeMinutes,
            exceptionFlags: record.exceptionFlags,
          }
        : null,
      score: this.buildAttendanceScore(monthRecords),
      calendar: monthRecords.map(
        (row: DailyRow & { attendanceDate: Date }) => ({
          date: row.attendanceDate,
          status: row.status,
          lateMinutes: row.lateMinutes,
        }),
      ),
    };
  }

  private async fetchRecordsBetween(tenantId: string, from: Date, to: Date) {
    return this.db().staffAttendanceDailyRecord.findMany({
      where: {
        tenantId,
        attendanceDate: { gte: from, lte: to },
      },
      include: {
        staff: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            department: { select: { id: true, name: true } },
          },
        },
      },
      take: 50000,
    }) as Promise<DailyRow[]>;
  }

  private buildArrivalTimeline(
    punches: Array<{ punchTimestamp: Date; punchDirection?: string | null }>,
  ) {
    const buckets = new Map<number, number>();
    for (let hour = 5; hour <= 20; hour += 1) buckets.set(hour, 0);

    for (const punch of punches) {
      const hour = new Date(punch.punchTimestamp).getHours();
      if (hour < 5 || hour > 20) continue;
      const direction = String(punch.punchDirection ?? 'IN').toUpperCase();
      if (direction.includes('OUT')) continue;
      buckets.set(hour, (buckets.get(hour) ?? 0) + 1);
    }

    const max = Math.max(1, ...buckets.values());
    return Array.from(buckets.entries()).map(([hour, count]) => ({
      hour,
      label: this.formatHour(hour),
      count,
      intensity: Math.round((count / max) * 100),
    }));
  }

  private buildDepartmentHeatmap(records: DailyRow[]) {
    const grouped = new Map<
      string,
      { name: string; present: number; total: number }
    >();
    for (const row of records) {
      const deptName = row.staff?.department?.name ?? 'Unassigned';
      const deptId = row.staff?.department?.id ?? 'unassigned';
      const entry = grouped.get(deptId) ?? {
        name: deptName,
        present: 0,
        total: 0,
      };
      entry.total += 1;
      if (PRESENT_STATUSES.has(String(row.status))) entry.present += 1;
      grouped.set(deptId, entry);
    }
    return Array.from(grouped.values())
      .map((dept) => ({
        department: dept.name,
        attendancePercent:
          dept.total > 0 ? Math.round((dept.present / dept.total) * 100) : 0,
        present: dept.present,
        total: dept.total,
        health:
          dept.total === 0
            ? 'neutral'
            : dept.present / dept.total >= 0.95
              ? 'excellent'
              : dept.present / dept.total >= 0.85
                ? 'good'
                : dept.present / dept.total >= 0.7
                  ? 'warning'
                  : 'critical',
      }))
      .sort((a, b) => b.attendancePercent - a.attendancePercent);
  }

  private buildDepartmentRanking(records: DailyRow[]) {
    return this.buildDepartmentHeatmap(records).map((row, index) => ({
      rank: index + 1,
      ...row,
    }));
  }

  private buildWeeklyPattern(records: DailyRow[]) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const grouped = new Map<number, { present: number; total: number }>();
    for (const row of records) {
      const day = new Date(
        (row as DailyRow & { attendanceDate?: Date }).attendanceDate ??
          new Date(),
      ).getDay();
      const entry = grouped.get(day) ?? { present: 0, total: 0 };
      entry.total += 1;
      if (PRESENT_STATUSES.has(String(row.status))) entry.present += 1;
      grouped.set(day, entry);
    }
    return days.map((label, index) => {
      const entry = grouped.get(index) ?? { present: 0, total: 0 };
      const pct =
        entry.total > 0 ? Math.round((entry.present / entry.total) * 100) : 0;
      return {
        day: label,
        attendancePercent: pct,
        health:
          pct >= 95
            ? 'excellent'
            : pct >= 85
              ? 'good'
              : pct >= 70
                ? 'warning'
                : 'critical',
      };
    });
  }

  private buildTrends(records: DailyRow[]) {
    const byDate = new Map<string, DailyRow[]>();
    for (const row of records) {
      const dateKey = this.dateKey(
        (row as DailyRow & { attendanceDate: Date }).attendanceDate,
      );
      byDate.set(dateKey, [...(byDate.get(dateKey) ?? []), row]);
    }
    const series = Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, rows]) => ({
        date,
        present: rows.filter((r) => PRESENT_STATUSES.has(String(r.status)))
          .length,
        late: rows.filter((r) => (r.lateMinutes ?? 0) > 0).length,
        leave: rows.filter((r) => r.status === 'ON_LEAVE').length,
        absent: rows.filter((r) => r.status === 'ABSENT').length,
        overtime: rows.filter((r) => (r.overtimeMinutes ?? 0) > 0).length,
      }));

    const firstHalf = series.slice(0, Math.floor(series.length / 2));
    const secondHalf = series.slice(Math.floor(series.length / 2));
    const avg = (items: typeof series, key: keyof (typeof series)[0]) =>
      items.length
        ? items.reduce((sum, row) => sum + Number(row[key]), 0) / items.length
        : 0;

    return {
      series,
      direction: {
        attendance: this.trendDirection(
          avg(secondHalf, 'present'),
          avg(firstHalf, 'present'),
        ),
        late: this.trendDirection(
          avg(secondHalf, 'late'),
          avg(firstHalf, 'late'),
          true,
        ),
        leave: this.trendDirection(
          avg(secondHalf, 'leave'),
          avg(firstHalf, 'leave'),
          true,
        ),
        overtime: this.trendDirection(
          avg(secondHalf, 'overtime'),
          avg(firstHalf, 'overtime'),
        ),
      },
    };
  }

  private buildMonthlyAnalytics(current: DailyRow[], previous: DailyRow[]) {
    const summarize = (rows: DailyRow[]) => {
      const total = rows.length || 1;
      return {
        attendancePercent: Math.round(
          (rows.filter((r) => PRESENT_STATUSES.has(String(r.status))).length /
            total) *
            100,
        ),
        latePercent: Math.round(
          (rows.filter((r) => (r.lateMinutes ?? 0) > 0).length / total) * 100,
        ),
        leavePercent: Math.round(
          (rows.filter((r) => r.status === 'ON_LEAVE').length / total) * 100,
        ),
        overtimePercent: Math.round(
          (rows.filter((r) => (r.overtimeMinutes ?? 0) > 0).length / total) *
            100,
        ),
      };
    };
    const currentStats = summarize(current);
    const previousStats = summarize(previous);
    return {
      current: currentStats,
      previous: previousStats,
      deltas: {
        attendance:
          currentStats.attendancePercent - previousStats.attendancePercent,
        late: currentStats.latePercent - previousStats.latePercent,
        leave: currentStats.leavePercent - previousStats.leavePercent,
        overtime: currentStats.overtimePercent - previousStats.overtimePercent,
      },
    };
  }

  private buildInsights(
    tenantId: string,
    todayRecords: DailyRow[],
    monthRecords: DailyRow[],
    lastMonthRecords: DailyRow[],
    devices: Array<Record<string, unknown>>,
  ) {
    const insights: Array<{
      id: string;
      severity: 'info' | 'warning' | 'success' | 'critical';
      title: string;
      body: string;
    }> = [];

    const currentDept = this.buildDepartmentHeatmap(monthRecords);
    const previousDept = this.buildDepartmentHeatmap(lastMonthRecords);
    const previousMap = new Map(
      previousDept.map((d) => [d.department, d.attendancePercent]),
    );

    for (const dept of currentDept) {
      const prev = previousMap.get(dept.department);
      if (prev == null) continue;
      const delta = dept.attendancePercent - prev;
      if (delta <= -5) {
        insights.push({
          id: `dept-drop-${dept.department}`,
          severity: 'warning',
          title: `${dept.department} attendance dipped`,
          body: `${dept.department} attendance is ${dept.attendancePercent}% (${Math.abs(delta)} points lower than last month).`,
        });
      } else if (delta >= 5) {
        insights.push({
          id: `dept-up-${dept.department}`,
          severity: 'success',
          title: `${dept.department} improved`,
          body: `${dept.department} attendance improved by ${delta}% compared to last month.`,
        });
      }
    }

    const lateStreaks = this.findConsecutiveLateStreaks(monthRecords, 3);
    for (const streak of lateStreaks.slice(0, 3)) {
      insights.push({
        id: `late-streak-${streak.staffProfileId}`,
        severity: 'warning',
        title: `${streak.name} — late streak`,
        body: `${streak.name} has arrived late ${streak.days} consecutive working days.`,
      });
    }

    const offlineDevices = devices.filter(
      (d) =>
        d.networkStatus !== 'ONLINE' &&
        !['CONNECTED', 'ONLINE'].includes(String(d.status)),
    );
    if (offlineDevices.length) {
      insights.push({
        id: 'devices-offline',
        severity: 'critical',
        title: `${offlineDevices.length} biometric device(s) need attention`,
        body: `${offlineDevices.map((d) => String(d.name)).join(', ')} ${offlineDevices.length === 1 ? 'is' : 'are'} offline or failing handshake.`,
      });
    }

    const missingOutToday = todayRecords.filter((r) =>
      this.hasFlag(r, 'MISSED_OUT'),
    ).length;
    if (missingOutToday > 0) {
      insights.push({
        id: 'missing-out-today',
        severity: 'info',
        title: `${missingOutToday} missing OUT punch(es) today`,
        body: 'Review the daily register or trigger correction workflow for staff who forgot to punch out.',
      });
    }

    if (!insights.length) {
      insights.push({
        id: 'all-clear',
        severity: 'success',
        title: 'Attendance looks healthy',
        body: 'No major anomalies detected for today. Devices, departments, and punch patterns are within normal range.',
      });
    }

    return insights.slice(0, 8);
  }

  private buildAlerts(
    todayRecords: DailyRow[],
    devices: Array<Record<string, unknown>>,
    pendingCorrections: number,
    missingOut: number,
  ) {
    const alerts: Array<{
      id: string;
      severity: 'info' | 'warning' | 'critical';
      title: string;
      action: string;
    }> = [];

    if (missingOut > 0) {
      alerts.push({
        id: 'alert-missing-out',
        severity: 'warning',
        title: `${missingOut} staff missing OUT punch`,
        action: 'Notify HR / review corrections',
      });
    }

    const absentToday = todayRecords.filter(
      (r) => r.status === 'ABSENT',
    ).length;
    if (absentToday >= 3) {
      alerts.push({
        id: 'alert-absent',
        severity: 'critical',
        title: `${absentToday} staff marked absent today`,
        action: 'Notify Principal / HOD review',
      });
    }

    if (pendingCorrections > 0) {
      alerts.push({
        id: 'alert-corrections',
        severity: 'info',
        title: `${pendingCorrections} correction request(s) pending`,
        action: 'Open corrections workflow',
      });
    }

    for (const device of devices) {
      if (device.networkStatus === 'ONLINE') continue;
      alerts.push({
        id: `alert-device-${device.id}`,
        severity: 'critical',
        title: `${String(device.name)} offline`,
        action: 'Notify device admin',
      });
    }

    return alerts.slice(0, 6);
  }

  private buildAttendanceScore(monthRecords: DailyRow[]) {
    if (!monthRecords.length) {
      return {
        score: 100,
        breakdown: {
          attendance: 100,
          late: 0,
          missing: 0,
          leave: 0,
          overtime: 0,
        },
      };
    }
    const working = monthRecords.filter(
      (r) => !['WEEKLY_OFF', 'HOLIDAY'].includes(String(r.status)),
    );
    const total = working.length || 1;
    const present = working.filter((r) =>
      PRESENT_STATUSES.has(String(r.status)),
    ).length;
    const lateCount = working.filter((r) => (r.lateMinutes ?? 0) > 0).length;
    const missing = working.filter((r) => this.hasFlag(r, 'MISSED_OUT')).length;
    const leave = working.filter((r) => r.status === 'ON_LEAVE').length;
    const overtimeDays = working.filter(
      (r) => (r.overtimeMinutes ?? 0) > 0,
    ).length;

    const attendancePts = Math.round((present / total) * 70);
    const latePenalty = Math.min(15, lateCount * 2);
    const missingPenalty = Math.min(10, missing * 3);
    const leaveBonus = Math.min(5, leave);
    const otBonus = Math.min(10, overtimeDays);
    const score = Math.max(
      0,
      Math.min(
        100,
        attendancePts + leaveBonus + otBonus - latePenalty - missingPenalty,
      ),
    );

    return {
      score,
      breakdown: {
        attendance: Math.round((present / total) * 100),
        late: lateCount,
        missing,
        leave,
        overtime: overtimeDays,
      },
      disciplineStars:
        score >= 95
          ? 5
          : score >= 85
            ? 4
            : score >= 75
              ? 3
              : score >= 60
                ? 2
                : 1,
    };
  }

  private findConsecutiveLateStreaks(records: DailyRow[], minDays: number) {
    const byStaff = new Map<string, DailyRow[]>();
    for (const row of records) {
      byStaff.set(row.staffProfileId, [
        ...(byStaff.get(row.staffProfileId) ?? []),
        row,
      ]);
    }

    const streaks: Array<{
      staffProfileId: string;
      name: string;
      days: number;
    }> = [];
    for (const [staffProfileId, rows] of byStaff.entries()) {
      const sorted = [...rows].sort(
        (a, b) =>
          new Date(a.attendanceDate ?? 0).getTime() -
          new Date(b.attendanceDate ?? 0).getTime(),
      );
      let streak = 0;
      let best = 0;
      for (const row of sorted) {
        if (
          (row.lateMinutes ?? 0) > 0 &&
          !['WEEKLY_OFF', 'HOLIDAY', 'ON_LEAVE'].includes(String(row.status))
        ) {
          streak += 1;
          best = Math.max(best, streak);
        } else {
          streak = 0;
        }
      }
      if (best >= minDays) {
        streaks.push({
          staffProfileId,
          name: sorted[0]?.staff?.fullName ?? 'Staff member',
          days: best,
        });
      }
    }
    return streaks.sort((a, b) => b.days - a.days);
  }

  private toDeviceCard(device: Record<string, unknown>, punchesToday: number) {
    const online =
      device.networkStatus === 'ONLINE' ||
      ['CONNECTED', 'ONLINE'].includes(String(device.status));
    const syncHealth = String(device.syncHealthStatus ?? 'UNKNOWN');
    const lastSync = device.lastSyncAt
      ? new Date(String(device.lastSyncAt))
      : null;
    const minutesSinceSync = lastSync
      ? Math.round((Date.now() - lastSync.getTime()) / 60000)
      : null;

    return {
      id: device.id,
      name: device.name,
      location: device.location ?? device.building ?? 'Campus',
      online,
      healthLabel: online
        ? syncHealth === 'HEALTHY'
          ? 'Healthy'
          : 'Online'
        : 'Offline',
      punchesToday,
      userCount: device.userCount ?? 0,
      lastSyncAt: device.lastSyncAt,
      lastSyncLabel:
        minutesSinceSync == null
          ? 'Never synced'
          : minutesSinceSync < 1
            ? 'Just now'
            : `${minutesSinceSync} min ago`,
      networkQuality:
        online && minutesSinceSync != null && minutesSinceSync <= 15
          ? 'Excellent'
          : online
            ? 'Good'
            : 'Poor',
      firmwareVersion: device.firmwareVersion ?? 'Unknown',
      syncHealthStatus: syncHealth,
    };
  }

  private inferDirection(
    punch: Record<string, unknown>,
    index?: number,
    total?: number,
  ) {
    const explicit = String(punch.punchDirection ?? '').toUpperCase();
    if (explicit.includes('OUT')) return 'OUT';
    if (explicit.includes('IN')) return 'IN';
    if (index != null && total != null) {
      if (index === 0) return 'IN';
      if (index === total - 1 && total > 1) return 'OUT';
    }
    return 'IN';
  }

  private trendDirection(current: number, previous: number, invert = false) {
    const delta = current - previous;
    if (Math.abs(delta) < 0.5) return 'flat';
    const improved = invert ? delta < 0 : delta > 0;
    return improved ? 'up' : 'down';
  }

  private hasFlag(row: DailyRow, flag: string) {
    const flags = Array.isArray(row.exceptionFlags) ? row.exceptionFlags : [];
    return flags.map(String).includes(flag);
  }

  private dateOnly(value: Date) {
    return new Date(value.toISOString().slice(0, 10));
  }

  private addDays(value: Date, days: number) {
    const next = new Date(value);
    next.setDate(next.getDate() + days);
    return next;
  }

  private dateKey(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private formatHour(hour: number) {
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
  }
}
