import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { StaffAttendanceEngineService } from './staff-attendance-engine.service';
import { StaffAttendanceService } from './staff-attendance.service';
import { DeviceHealthService } from './device-health.service';
import { AttendanceProcessingOrchestratorService } from './attendance-processing-orchestrator.service';

@Injectable()
export class StaffAttendanceProcessor {
  constructor(
    private readonly service: StaffAttendanceService,
    private readonly engine: StaffAttendanceEngineService,
    private readonly health: DeviceHealthService,
    private readonly processing: AttendanceProcessingOrchestratorService,
  ) {}

  async process(job: Job<Record<string, unknown>>): Promise<unknown> {
    if (job.name === 'staff-biometric-sync-device') {
      return this.service.syncDeviceInternal(
        String(job.data.tenantId),
        String(job.data.deviceId),
        String(job.data.batchId),
      );
    }
    if (job.name === 'staff-attendance-process-batch') {
      return this.engine.processBatch(
        String(job.data.tenantId),
        job.data.batchId ? String(job.data.batchId) : undefined,
      );
    }
    if (job.name === 'staff-attendance-recompute-range') {
      return this.engine.recomputeRange(
        String(job.data.tenantId),
        new Date(String(job.data.from)),
        new Date(String(job.data.to)),
        job.data.staffProfileId ? String(job.data.staffProfileId) : undefined,
      );
    }
    if (job.name === 'staff-attendance-reprocess-run') {
      return this.processing.processRun(String(job.data.runId));
    }
    if (job.name === 'staff-attendance-daily-summary') {
      const date = job.data.date ? new Date(String(job.data.date)) : new Date();
      return this.engine.recomputeRange(String(job.data.tenantId), date, date);
    }
    if (job.name === 'staff-attendance-monthly-summary') {
      const month = job.data.month
        ? new Date(`${String(job.data.month).slice(0, 7)}-01`)
        : new Date();
      const from = new Date(month.getFullYear(), month.getMonth(), 1);
      const to = new Date(month.getFullYear(), month.getMonth() + 1, 0);
      return this.engine.recomputeRange(String(job.data.tenantId), from, to);
    }
    if (job.name === 'staff-biometric-push-users') {
      return {
        queued: true,
        note: 'Push users are processed through the API path in phase 1.',
      };
    }
    if (job.name === 'staff-biometric-health-check-device') {
      return this.health.monitorDevice(
        String(job.data.tenantId),
        String(job.data.deviceId),
      );
    }
    if (job.name === 'staff-biometric-health-check-all') {
      return this.health.monitorAll(String(job.data.tenantId));
    }
    if (job.name === 'staff-biometric-retry-failed-sync') {
      return {
        queued: true,
        note: 'Retry failed sync is coordinated by scheduled device sync discovery.',
      };
    }
    return null;
  }
}
