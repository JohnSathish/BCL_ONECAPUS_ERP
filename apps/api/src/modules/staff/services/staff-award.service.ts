import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

export const AWARD_LEVELS = [
  'INTERNATIONAL',
  'NATIONAL',
  'STATE',
  'UNIVERSITY',
  'COLLEGE',
] as const;

@Injectable()
export class StaffAwardService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, staffProfileId: string) {
    await this.assertStaff(tenantId, staffProfileId);
    return this.prisma.staffAward.findMany({
      where: { tenantId, staffProfileId },
      orderBy: [{ awardDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(
    tenantId: string,
    staffProfileId: string,
    input: {
      title: string;
      organization?: string;
      level?: string;
      awardDate?: string;
      description?: string;
      certificateUrl?: string;
    },
  ) {
    await this.assertStaff(tenantId, staffProfileId);
    return this.prisma.staffAward.create({
      data: {
        tenantId,
        staffProfileId,
        title: input.title.trim(),
        organization: input.organization?.trim(),
        level: input.level,
        awardDate: input.awardDate ? new Date(input.awardDate) : undefined,
        description: input.description?.trim(),
        certificateUrl: input.certificateUrl,
      },
    });
  }

  async update(
    tenantId: string,
    staffProfileId: string,
    awardId: string,
    input: Partial<{
      title: string;
      organization: string | null;
      level: string | null;
      awardDate: string | null;
      description: string | null;
      certificateUrl: string | null;
    }>,
  ) {
    await this.assertAward(tenantId, staffProfileId, awardId);
    return this.prisma.staffAward.update({
      where: { id: awardId },
      data: {
        title: input.title?.trim(),
        organization: input.organization,
        level: input.level,
        awardDate:
          input.awardDate === null
            ? null
            : input.awardDate
              ? new Date(input.awardDate)
              : undefined,
        description: input.description,
        certificateUrl: input.certificateUrl,
      },
    });
  }

  async remove(tenantId: string, staffProfileId: string, awardId: string) {
    await this.assertAward(tenantId, staffProfileId, awardId);
    await this.prisma.staffAward.delete({ where: { id: awardId } });
    return { ok: true };
  }

  private async assertStaff(tenantId: string, staffProfileId: string) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { id: staffProfileId, tenantId, deletedAt: null },
    });
    if (!staff) throw new NotFoundException('Staff member not found');
  }

  private async assertAward(
    tenantId: string,
    staffProfileId: string,
    awardId: string,
  ) {
    const award = await this.prisma.staffAward.findFirst({
      where: { id: awardId, tenantId, staffProfileId },
    });
    if (!award) throw new NotFoundException('Award not found');
  }
}
