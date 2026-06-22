import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class ProbationService {
  constructor(private readonly prisma: PrismaService) {}

  async listNearingEnd(tenantId: string, withinDays = 30) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + withinDays);

    return this.prisma.staffProfile.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: 'ACTIVE',
        probationEndDate: { gte: today, lte: end },
        confirmationDate: null,
      },
      include: {
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, label: true } },
      },
      orderBy: { probationEndDate: 'asc' },
      take: 200,
    });
  }

  async dashboard(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const countWithin = async (days: number) => {
      const end = new Date(today);
      end.setDate(end.getDate() + days);
      return this.prisma.staffProfile.count({
        where: {
          tenantId,
          deletedAt: null,
          status: 'ACTIVE',
          probationEndDate: { gte: today, lte: end },
          confirmationDate: null,
        },
      });
    };

    const [due30, due15, due7, onProbation, confirmed] = await Promise.all([
      countWithin(30),
      countWithin(15),
      countWithin(7),
      this.prisma.staffProfile.count({
        where: {
          tenantId,
          deletedAt: null,
          probationEndDate: { not: null },
          confirmationDate: null,
        },
      }),
      this.prisma.staffProfile.count({
        where: { tenantId, deletedAt: null, confirmationDate: { not: null } },
      }),
    ]);

    return { due30, due15, due7, onProbation, confirmed };
  }

  async confirm(tenantId: string, staffProfileId: string) {
    return this.prisma.staffProfile.update({
      where: { id: staffProfileId, tenantId },
      data: { confirmationDate: new Date() },
    });
  }
}
