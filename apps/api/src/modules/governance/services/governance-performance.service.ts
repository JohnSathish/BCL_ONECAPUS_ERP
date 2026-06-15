import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  DEFAULT_GOVERNANCE_PERFORMANCE_WEIGHTS,
  academicYearLabel,
} from '../constants/governance.constants';
import type { PerformanceComputeDto } from '../dto/governance.dto';
import { GovernanceSettingsService } from './governance-settings.service';
import { governanceDb } from './governance-prisma.util';

@Injectable()
export class GovernancePerformanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: GovernanceSettingsService,
  ) {}

  private db() {
    return governanceDb(this.prisma);
  }

  async computeAll(tenantId: string, dto: PerformanceComputeDto) {
    const academicYear = dto.academicYear ?? academicYearLabel();
    const committees = await this.db().governanceCommittee.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        ...(dto.committeeId ? { id: dto.committeeId } : {}),
      },
    });

    const results = [];
    for (const committee of committees) {
      results.push(
        await this.computeForCommittee(tenantId, committee.id, academicYear),
      );
    }
    return { academicYear, count: results.length, snapshots: results };
  }

  async computeForCommittee(
    tenantId: string,
    committeeId: string,
    academicYear?: string,
  ) {
    const year = academicYear ?? academicYearLabel();
    const cfg = await this.settings.get(tenantId);
    const weights = {
      ...DEFAULT_GOVERNANCE_PERFORMANCE_WEIGHTS,
      ...((cfg.performanceWeights as Record<string, number> | null) ?? {}),
    };

    const yearStart = this.academicYearStart(year);
    const yearEnd = this.academicYearEnd(year);

    const [meetings, attendances, atrItems, tasks, documents] =
      await Promise.all([
        this.db().governanceMeeting.findMany({
          where: {
            tenantId,
            committeeId,
            meetingDate: { gte: yearStart, lte: yearEnd },
          },
        }),
        this.db().governanceMeetingAttendance.findMany({
          where: {
            tenantId,
            meeting: {
              committeeId,
              meetingDate: { gte: yearStart, lte: yearEnd },
            },
          },
        }),
        this.db().governanceActionItem.findMany({
          where: { tenantId, committeeId },
        }),
        this.db().governanceTask.findMany({ where: { tenantId, committeeId } }),
        this.db().governanceDocument.count({
          where: { tenantId, committeeId },
        }),
      ]);

    const completedMeetings = meetings.filter(
      (m: Record<string, unknown>) => m.status === 'COMPLETED',
    ).length;
    const meetingFrequencyScore = Math.min(completedMeetings / 4, 1) * 100;

    const presentCount = attendances.filter(
      (a: Record<string, unknown>) => a.status === 'PRESENT',
    ).length;
    const attendanceRateScore = attendances.length
      ? (presentCount / attendances.length) * 100
      : 0;

    const completedAtr = atrItems.filter(
      (a: Record<string, unknown>) => a.status === 'COMPLETED',
    ).length;
    const atrCompletionScore = atrItems.length
      ? (completedAtr / atrItems.length) * 100
      : 0;

    const completedTasks = tasks.filter(
      (t: Record<string, unknown>) => t.status === 'COMPLETED',
    ).length;
    const taskCompletionScore = tasks.length
      ? (completedTasks / tasks.length) * 100
      : 0;

    const documentationScore = Math.min(documents / 5, 1) * 100;

    const breakdown = {
      meetingFrequency: Number(
        (meetingFrequencyScore * weights.meetingFrequency).toFixed(2),
      ),
      attendanceRate: Number(
        (attendanceRateScore * weights.attendanceRate).toFixed(2),
      ),
      atrCompletion: Number(
        (atrCompletionScore * weights.atrCompletion).toFixed(2),
      ),
      taskCompletion: Number(
        (taskCompletionScore * weights.taskCompletion).toFixed(2),
      ),
      documentation: Number(
        (documentationScore * weights.documentation).toFixed(2),
      ),
    };

    const scoreTotal = Number(
      Object.values(breakdown)
        .reduce((sum, value) => sum + value, 0)
        .toFixed(2),
    );

    return this.db().governancePerformanceSnapshot.upsert({
      where: {
        tenantId_committeeId_academicYear: {
          tenantId,
          committeeId,
          academicYear: year,
        },
      },
      create: {
        tenantId,
        committeeId,
        academicYear: year,
        scoreTotal,
        scoreBreakdown: breakdown,
      },
      update: {
        scoreTotal,
        scoreBreakdown: breakdown,
        computedAt: new Date(),
      },
      include: { committee: { select: { name: true, shortCode: true } } },
    });
  }

  async leaderboard(tenantId: string, academicYear?: string) {
    const year = academicYear ?? academicYearLabel();
    return this.db().governancePerformanceSnapshot.findMany({
      where: { tenantId, academicYear: year },
      include: {
        committee: { select: { name: true, shortCode: true, category: true } },
      },
      orderBy: { scoreTotal: 'desc' },
    });
  }

  private academicYearStart(label: string) {
    const startYear = Number(label.split('-')[0]);
    return new Date(startYear, 5, 1);
  }

  private academicYearEnd(label: string) {
    const startYear = Number(label.split('-')[0]);
    return new Date(startYear + 1, 4, 30, 23, 59, 59);
  }
}
