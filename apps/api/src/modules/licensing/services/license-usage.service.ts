import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class LicenseUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async getUsage(tenantId: string) {
    const [currentStudents, currentStaff, fileStorageMb] = await Promise.all([
      this.prisma.student.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.staffProfile.count({
        where: { tenantId, deletedAt: null },
      }),
      this.estimateFileStorageMb(tenantId),
    ]);

    return {
      currentStudents,
      currentStaff,
      fileStorageMb,
      databaseSizeMb: null as number | null,
      apiUsageCount: null as number | null,
    };
  }

  private async estimateFileStorageMb(tenantId: string): Promise<number> {
    const docs = await this.prisma.studentDocument.aggregate({
      where: { tenantId },
      _count: true,
    });
    return Math.round(docs._count * 0.5 * 10) / 10;
  }
}
