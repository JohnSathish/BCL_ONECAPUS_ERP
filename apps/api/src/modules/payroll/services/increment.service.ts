import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { CreateIncrementBatchDto } from '../dto/payroll.dto';
import { PayrollAuditService } from './payroll-audit.service';

@Injectable()
export class IncrementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PayrollAuditService,
  ) {}

  list(tenantId: string) {
    return this.prisma.incrementBatch.findMany({
      where: { tenantId },
      include: { _count: { select: { lines: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(user: JwtUser, dto: CreateIncrementBatchDto) {
    const batch = await this.prisma.incrementBatch.create({
      data: {
        tenantId: user.tid,
        name: dto.name,
        incrementType: dto.incrementType,
        incrementValue: dto.incrementValue,
        filterJson: dto.filterJson as object | undefined,
        effectiveFrom: new Date(dto.effectiveFrom),
        createdById: user.sub,
      },
    });
    await this.audit.log({
      tenantId: user.tid,
      entityType: 'INCREMENT_BATCH',
      entityId: batch.id,
      action: 'CREATED',
      newValue: {
        name: dto.name,
        incrementType: dto.incrementType,
        incrementValue: dto.incrementValue,
      },
      userId: user.sub,
    });
    return batch;
  }

  async preview(user: JwtUser, batchId: string) {
    const batch = await this.prisma.incrementBatch.findFirst({
      where: { id: batchId, tenantId: user.tid },
    });
    if (!batch) throw new NotFoundException('Increment batch not found');

    const filter = (batch.filterJson ?? {}) as Record<string, string>;
    const assignments = await this.prisma.staffPayAssignment.findMany({
      where: {
        tenantId: user.tid,
        status: 'ACTIVE',
        ...(filter.payScaleType ? { payScaleType: filter.payScaleType } : {}),
        ...(filter.departmentId
          ? { staffProfile: { departmentId: filter.departmentId } }
          : {}),
        ...(filter.designationId
          ? { staffProfile: { designationId: filter.designationId } }
          : {}),
      },
      include: {
        staffProfile: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            department: { select: { name: true } },
            designation: { select: { label: true } },
          },
        },
      },
    });

    return {
      batch: {
        id: batch.id,
        name: batch.name,
        incrementType: batch.incrementType,
        incrementValue: Number(batch.incrementValue),
        effectiveFrom: batch.effectiveFrom,
        status: batch.status,
      },
      rows: assignments.map((a) => {
        const prev = Number(a.basicPay);
        const next =
          batch.incrementType === 'PERCENT'
            ? Math.round(prev * (1 + Number(batch.incrementValue) / 100))
            : prev + Number(batch.incrementValue);
        return {
          staffProfileId: a.staffProfileId,
          staffPayAssignmentId: a.id,
          staffName: a.staffProfile.fullName,
          employeeCode: a.staffProfile.employeeCode,
          department: a.staffProfile.department?.name ?? '—',
          designation: a.staffProfile.designation?.label ?? '—',
          previousBasicPay: prev,
          newBasicPay: next,
          change: next - prev,
        };
      }),
      summary: {
        staffCount: assignments.length,
        totalIncrease: assignments.reduce((s, a) => {
          const prev = Number(a.basicPay);
          const next =
            batch.incrementType === 'PERCENT'
              ? Math.round(prev * (1 + Number(batch.incrementValue) / 100))
              : prev + Number(batch.incrementValue);
          return s + (next - prev);
        }, 0),
      },
    };
  }

  async apply(user: JwtUser, batchId: string) {
    const batch = await this.prisma.incrementBatch.findFirst({
      where: { id: batchId, tenantId: user.tid },
    });
    if (!batch) throw new NotFoundException('Increment batch not found');
    if (batch.status === 'APPLIED')
      throw new BadRequestException('Batch already applied');

    const preview = await this.preview(user, batchId);
    const lines = [];

    for (const row of preview.rows) {
      const assignment = await this.prisma.staffPayAssignment.findFirst({
        where: {
          tenantId: user.tid,
          staffProfileId: row.staffProfileId,
          status: 'ACTIVE',
        },
      });
      if (!assignment) continue;

      const beforeSnapshot = {
        basicPay: row.previousBasicPay,
        payScaleType: assignment.payScaleType,
      };
      const afterSnapshot = {
        basicPay: row.newBasicPay,
        payScaleType: assignment.payScaleType,
      };

      await this.prisma.staffPayAssignment.update({
        where: { id: assignment.id },
        data: { basicPay: row.newBasicPay },
      });

      await this.prisma.staffProfile.update({
        where: { id: row.staffProfileId },
        data: { basicPay: row.newBasicPay },
      });

      await this.prisma.salaryRevision.create({
        data: {
          tenantId: user.tid,
          staffPayAssignmentId: assignment.id,
          revisionType:
            batch.incrementType === 'PERCENT'
              ? 'INCREMENT_PERCENT'
              : 'INCREMENT_FLAT',
          effectiveFrom: batch.effectiveFrom,
          appliedAt: new Date(),
          beforeSnapshot,
          afterSnapshot,
          notes: `Increment batch: ${batch.name}`,
          createdById: user.sub,
        },
      });

      lines.push(
        this.prisma.incrementBatchLine.create({
          data: {
            tenantId: user.tid,
            incrementBatchId: batchId,
            staffProfileId: row.staffProfileId,
            previousBasicPay: row.previousBasicPay,
            newBasicPay: row.newBasicPay,
            status: 'APPLIED',
          },
        }),
      );
    }

    await Promise.all(lines);

    const updated = await this.prisma.incrementBatch.update({
      where: { id: batchId },
      data: { status: 'APPLIED', appliedCount: preview.rows.length },
    });

    await this.audit.log({
      tenantId: user.tid,
      entityType: 'INCREMENT_BATCH',
      entityId: batchId,
      action: 'APPLIED',
      newValue: { appliedCount: preview.rows.length, name: batch.name },
      userId: user.sub,
    });

    return updated;
  }
}
