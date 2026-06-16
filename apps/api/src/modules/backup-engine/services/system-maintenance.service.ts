import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class SystemMaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  async isActive(): Promise<boolean> {
    const flag = await this.prisma.systemMaintenanceFlag.findUnique({
      where: { id: 'singleton' },
    });
    return flag?.active ?? false;
  }

  async activate(input: {
    reason: string;
    userId?: string;
    backupRunId?: string;
  }) {
    return this.prisma.systemMaintenanceFlag.upsert({
      where: { id: 'singleton' },
      create: {
        id: 'singleton',
        active: true,
        reason: input.reason,
        startedAt: new Date(),
        startedByUserId: input.userId,
        backupRunId: input.backupRunId,
      },
      update: {
        active: true,
        reason: input.reason,
        startedAt: new Date(),
        startedByUserId: input.userId,
        backupRunId: input.backupRunId,
      },
    });
  }

  async deactivate() {
    return this.prisma.systemMaintenanceFlag.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', active: false },
      update: {
        active: false,
        reason: null,
        startedAt: null,
        startedByUserId: null,
        backupRunId: null,
      },
    });
  }

  async getStatus() {
    return this.prisma.systemMaintenanceFlag.findUnique({
      where: { id: 'singleton' },
    });
  }
}
