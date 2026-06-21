import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { IaSettingsDto } from './dto/ia.dto';

@Injectable()
export class IaSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(tenantId: string) {
    let row = await this.prisma.tenantExaminationSettings.findUnique({
      where: { tenantId },
    });
    if (!row) {
      row = await this.prisma.tenantExaminationSettings.create({
        data: { tenantId },
      });
    }
    return row;
  }

  async update(tenantId: string, dto: IaSettingsDto) {
    await this.getOrCreate(tenantId);
    return this.prisma.tenantExaminationSettings.update({
      where: { tenantId },
      data: {
        ...(dto.legacyUniversityExamMode !== undefined
          ? { legacyUniversityExamMode: dto.legacyUniversityExamMode }
          : {}),
        ...(dto.iaPassMarkPercent !== undefined
          ? { iaPassMarkPercent: dto.iaPassMarkPercent }
          : {}),
        ...(dto.attendanceMinPercent !== undefined
          ? { attendanceMinPercent: dto.attendanceMinPercent }
          : {}),
        ...(dto.blockAdmitOnDefaulter !== undefined
          ? { blockAdmitOnDefaulter: dto.blockAdmitOnDefaulter }
          : {}),
      },
    });
  }

  async assertLegacyEnabled(tenantId: string) {
    const settings = await this.getOrCreate(tenantId);
    if (!settings.legacyUniversityExamMode) {
      throw new ForbiddenException(
        'Legacy university examination mode is disabled for this institution.',
      );
    }
  }

  async isLegacyEnabled(tenantId: string) {
    const settings = await this.getOrCreate(tenantId);
    return settings.legacyUniversityExamMode;
  }
}
