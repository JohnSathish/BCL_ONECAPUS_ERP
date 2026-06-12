import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { QueueService } from '../../shared/queue/queue.service';

@Injectable()
export class DeviceHealthMonitorService implements OnModuleInit {
  private readonly logger = new Logger(DeviceHealthMonitorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  onModuleInit() {
    setInterval(() => {
      void this.queueDueHealthChecks();
    }, 60_000).unref();
    setInterval(() => {
      void this.queueDueAttendanceJobs();
    }, 60_000).unref();
  }

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  private async queueDueHealthChecks() {
    try {
      const devices = await this.db().staffBiometricDevice.findMany({
        where: {
          deletedAt: null,
          registrationStatus: { not: 'DISABLED' },
          autoSyncEnabled: true,
        },
        select: {
          id: true,
          tenantId: true,
          lastDiagnosticAt: true,
          heartbeatIntervalSec: true,
        },
        take: 100,
      });
      const now = Date.now();
      for (const device of devices) {
        const intervalMs =
          Math.max(60, Number(device.heartbeatIntervalSec ?? 60)) * 1000;
        const last = device.lastDiagnosticAt
          ? new Date(device.lastDiagnosticAt).getTime()
          : 0;
        if (now - last >= intervalMs) {
          await this.queue.enqueueStaffBiometricHealthCheckDevice({
            tenantId: device.tenantId,
            deviceId: device.id,
          });
        }
      }
    } catch (error) {
      this.logger.warn(
        `Could not queue biometric health checks: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async queueDueAttendanceJobs() {
    try {
      const devices = await this.db().staffBiometricDevice.findMany({
        where: {
          deletedAt: null,
          registrationStatus: { not: 'DISABLED' },
          autoSyncEnabled: true,
        },
        select: {
          id: true,
          tenantId: true,
          syncFrequencyMin: true,
          lastSyncAt: true,
        },
        take: 100,
      });
      const now = Date.now();
      const tenants = new Set<string>();
      for (const device of devices) {
        tenants.add(device.tenantId);
        const intervalMs =
          Math.max(1, Number(device.syncFrequencyMin ?? 15)) * 60_000;
        const last = device.lastSyncAt
          ? new Date(device.lastSyncAt).getTime()
          : 0;
        if (now - last < intervalMs) continue;
        const batch = await this.db().staffAttendanceSyncBatch.create({
          data: {
            tenantId: device.tenantId,
            deviceId: device.id,
            mode: 'SCHEDULED',
            status: 'QUEUED',
          },
        });
        await this.queue.enqueueStaffBiometricSyncDevice({
          tenantId: device.tenantId,
          deviceId: device.id,
          batchId: batch.id,
          userId: 'system',
          mode: 'INCREMENTAL',
        });
      }
      for (const tenantId of tenants) {
        await this.queue.enqueueStaffAttendanceProcessBatch({ tenantId });
      }
    } catch (error) {
      this.logger.warn(
        `Could not queue scheduled attendance jobs: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
