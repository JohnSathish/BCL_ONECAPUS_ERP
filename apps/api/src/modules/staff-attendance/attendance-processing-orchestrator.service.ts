import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StaffAttendanceEngineService } from './staff-attendance-engine.service';

@Injectable()
export class AttendanceProcessingOrchestratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: StaffAttendanceEngineService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async processRun(runId: string) {
    const run = await this.db().staffAttendanceProcessingRun.findUnique({
      where: { id: runId },
    });
    if (!run)
      throw new NotFoundException('Attendance processing run not found');

    await this.db().staffAttendanceProcessingRun.update({
      where: { id: runId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    try {
      const from = run.fromDate ? new Date(run.fromDate) : this.today();
      const to = run.toDate ? new Date(run.toDate) : this.today();
      const result =
        run.departmentId && !run.staffProfileId
          ? await this.recomputeDepartment(
              run.tenantId,
              run.departmentId,
              from,
              to,
            )
          : await this.engine.recomputeRange(
              run.tenantId,
              from,
              to,
              run.staffProfileId ?? undefined,
            );
      const updated = await this.db().staffAttendanceProcessingRun.update({
        where: { id: runId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          processedPunches: result.processedPunches,
          generatedRecords: result.records,
        },
      });
      return updated;
    } catch (error) {
      await this.db().staffAttendanceProcessingRun.update({
        where: { id: runId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  private today() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private async recomputeDepartment(
    tenantId: string,
    departmentId: string,
    from: Date,
    to: Date,
  ) {
    const staffRows = await this.db().staffProfile.findMany({
      where: { tenantId, departmentId, deletedAt: null },
      select: { id: true },
      take: 10000,
    });
    let processedPunches = 0;
    let records = 0;
    for (const staff of staffRows) {
      const result = await this.engine.recomputeRange(
        tenantId,
        from,
        to,
        staff.id,
      );
      processedPunches += result.processedPunches;
      records += result.records;
    }
    return { processedPunches, records };
  }
}
