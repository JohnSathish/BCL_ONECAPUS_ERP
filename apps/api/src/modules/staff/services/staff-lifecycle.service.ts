import { Injectable, Optional, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { GovernanceMemberService } from '../../governance/services/governance-member.service';

const TERMINAL_STATUSES = ['RELIEVED', 'RETIRED', 'CONTRACT_ENDED'] as const;

@Injectable()
export class StaffLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(forwardRef(() => GovernanceMemberService))
    private readonly governanceMembers?: GovernanceMemberService,
  ) {}

  async applyRelievingEffects(tenantId: string, staffProfileId: string) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { id: staffProfileId, tenantId, deletedAt: null },
      include: { portalUser: { select: { id: true } } },
    });
    if (!staff) return;

    const now = new Date();
    const relievingPast =
      staff.relievingDate != null && staff.relievingDate <= now;
    const isTerminal =
      TERMINAL_STATUSES.includes(
        staff.status as (typeof TERMINAL_STATUSES)[number],
      ) || relievingPast;

    if (!isTerminal) return;

    await this.prisma.$transaction(async (tx) => {
      let status = staff.status;
      if (relievingPast && staff.status === 'ACTIVE') {
        status = staff.retirementDate ? 'RETIRED' : 'RELIEVED';
      }

      await tx.staffProfile.update({
        where: { id: staffProfileId },
        data: { status },
      });

      await tx.staffShiftAssignment.updateMany({
        where: { staffProfileId, tenantId },
        data: { active: false, isPrimary: false },
      });

      await tx.staffAdditionalRole.updateMany({
        where: { staffProfileId, tenantId, active: true },
        data: { active: false, endDate: now },
      });

      await tx.department.updateMany({
        where: { hodId: staffProfileId, tenantId },
        data: { hodId: null },
      });

      const deactivatePortal = await this.shouldDeactivatePortal(tenantId);
      if (deactivatePortal && staff.portalUserId) {
        await tx.user.update({
          where: { id: staff.portalUserId },
          data: { isActive: false, accountStatus: 'inactive' },
        });
      }
    });

    await this.governanceMembers
      ?.handleStaffRelieved(tenantId, staffProfileId)
      .catch(() => undefined);
  }

  private async shouldDeactivatePortal(tenantId: string): Promise<boolean> {
    const settings = await this.prisma.tenantAcademicSettings.findUnique({
      where: { tenantId },
      select: { nepProfile: true },
    });
    const profile = settings?.nepProfile as Record<string, unknown> | null;
    const staffSettings = profile?.staff as Record<string, unknown> | undefined;
    const relieving = staffSettings?.relieving as
      | Record<string, unknown>
      | undefined;
    if (relieving?.deactivatePortal === false) return false;
    return true;
  }
}
