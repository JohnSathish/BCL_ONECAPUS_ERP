import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';

const REASON_LABELS: Record<string, string> = {
  STUDY_LEAVE: 'Study Leave',
  PHD_LEAVE: 'PhD Study Leave',
  MATERNITY_LEAVE: 'Maternity Leave',
  MEDICAL_LEAVE: 'Medical Leave',
  FDP: 'Faculty Development Program',
  RESEARCH_FELLOWSHIP: 'Research Fellowship',
  SABBATICAL: 'Sabbatical Leave',
  DEPUTATION: 'Deputation',
  OTHER: 'Other',
};

export type ReplacementTimetableOverlay = {
  assignmentId: string;
  reason: string;
  reasonLabel: string;
  originalStaffProfileId: string;
  originalStaffName: string;
  handledByName: string;
  handledByCode: string;
  startDate: string;
  endDate: string;
};

@Injectable()
export class ReplacementTimetableOverlayService {
  constructor(private readonly prisma: PrismaService) {}

  reasonLabel(reason: string): string {
    return REASON_LABELS[reason] ?? reason;
  }

  /** Active replacement assignments keyed by original staff profile ID. */
  async loadOverlayMap(
    tenantId: string,
    staffProfileIds: string[],
    asOf = new Date(),
  ): Promise<Map<string, ReplacementTimetableOverlay>> {
    const map = new Map<string, ReplacementTimetableOverlay>();
    if (!staffProfileIds.length) return map;

    const rows = await this.prisma.replacementAssignment.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        originalStaffProfileId: { in: staffProfileIds },
        startDate: { lte: asOf },
        endDate: { gte: asOf },
      },
      include: {
        originalStaff: {
          select: { id: true, fullName: true, employeeCode: true },
        },
        substitute: {
          select: { id: true, fullName: true, substituteCode: true },
        },
      },
    });

    for (const row of rows) {
      map.set(row.originalStaffProfileId, {
        assignmentId: row.id,
        reason: row.reason,
        reasonLabel: this.reasonLabel(row.reason),
        originalStaffProfileId: row.originalStaffProfileId,
        originalStaffName: row.originalStaff.fullName,
        handledByName: row.substitute.fullName,
        handledByCode: row.substitute.substituteCode,
        startDate: row.startDate.toISOString().slice(0, 10),
        endDate: row.endDate.toISOString().slice(0, 10),
      });
    }
    return map;
  }
}
