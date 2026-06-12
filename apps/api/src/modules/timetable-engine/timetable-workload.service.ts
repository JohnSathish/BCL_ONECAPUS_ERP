import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class TimetableWorkloadService {
  constructor(private readonly prisma: PrismaService) {}

  async facultyWeeklyLoads(tenantId: string, planId: string) {
    const entries = await this.prisma.timetablePlanEntry.findMany({
      where: {
        tenantId,
        planId,
        deletedAt: null,
        status: { not: 'CANCELLED' },
        staffProfileId: { not: null },
      },
      select: {
        staffProfileId: true,
        startTime: true,
        endTime: true,
        slotType: true,
        metadata: true,
      },
    });

    const staffIds = Array.from(
      new Set(
        entries.flatMap((entry) => {
          const team = this.entryFacultyTeam(entry);
          return team.length
            ? team.map((member) => member.staffProfileId)
            : [entry.staffProfileId].filter(Boolean);
        }),
      ),
    ) as string[];
    const workloads = staffIds.length
      ? await this.prisma.staffWorkload.findMany({
          where: { tenantId, staffProfileId: { in: staffIds } },
        })
      : [];
    const workloadByStaff = new Map(
      workloads.map((row) => [row.staffProfileId, row]),
    );

    const result = new Map<
      string,
      {
        staffProfileId: string;
        weeklyHours: number;
        theoryHours: number;
        practicalHours: number;
        maxWeeklyHours?: number;
      }
    >();

    for (const entry of entries) {
      const hours = this.slotHours(entry.startTime, entry.endTime);
      const team = this.entryFacultyTeam(entry);
      const members = team.length
        ? team
        : entry.staffProfileId
          ? [{ staffProfileId: entry.staffProfileId, allocationPercent: 100 }]
          : [];
      for (const member of members) {
        if (!member.staffProfileId) continue;
        const factor =
          member.allocationPercent == null
            ? 1
            : Number(member.allocationPercent) / 100;
        const allocatedHours = hours * factor;
        const existing = result.get(member.staffProfileId) ?? {
          staffProfileId: member.staffProfileId,
          weeklyHours: 0,
          theoryHours: 0,
          practicalHours: 0,
          maxWeeklyHours: Number(
            workloadByStaff.get(member.staffProfileId)?.weeklyHours ?? 0,
          ),
        };
        existing.weeklyHours += allocatedHours;
        if (entry.slotType === 'PRACTICAL' || entry.slotType === 'LAB') {
          existing.practicalHours += allocatedHours;
        } else {
          existing.theoryHours += allocatedHours;
        }
        result.set(member.staffProfileId, existing);
      }
    }

    return Array.from(result.values());
  }

  private slotHours(start: Date, end: Date) {
    const minutes = (end.getTime() - start.getTime()) / 60000;
    return Math.max(minutes, 0) / 60;
  }

  private entryFacultyTeam(entry: { metadata: unknown }) {
    const metadata = entry.metadata as {
      facultyTeam?: Array<{
        staffProfileId?: string;
        allocationPercent?: number | null;
      }>;
    } | null;
    return Array.isArray(metadata?.facultyTeam)
      ? metadata.facultyTeam.filter((member) => member.staffProfileId)
      : [];
  }
}
