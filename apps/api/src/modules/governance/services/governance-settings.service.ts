import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  DEFAULT_GOVERNANCE_PERFORMANCE_WEIGHTS,
  academicYearLabel,
} from '../constants/governance.constants';
import type { UpdateSettingsDto } from '../dto/governance.dto';
import { governanceDb } from './governance-prisma.util';

@Injectable()
export class GovernanceSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return governanceDb(this.prisma);
  }

  async get(tenantId: string) {
    const existing = await this.db().governanceSettings.findUnique({
      where: { tenantId },
    });
    if (existing) return existing;

    return this.db().governanceSettings.create({
      data: {
        tenantId,
        defaultAcademicYear: academicYearLabel(),
        performanceWeights: DEFAULT_GOVERNANCE_PERFORMANCE_WEIGHTS,
      },
    });
  }

  async update(tenantId: string, dto: UpdateSettingsDto) {
    await this.get(tenantId);
    return this.db().governanceSettings.update({
      where: { tenantId },
      data: {
        defaultAcademicYear: dto.defaultAcademicYear,
        noticePrefix: dto.noticePrefix,
        notifyEmail: dto.notifyEmail,
        notifyInApp: dto.notifyInApp,
        notifyPush: dto.notifyPush,
        notifySms: dto.notifySms,
        qrAttendanceEnabled: dto.qrAttendanceEnabled,
        performanceWeights: dto.performanceWeights,
        metadata: dto.metadata,
      },
    });
  }
}
