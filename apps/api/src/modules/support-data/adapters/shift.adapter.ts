import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AdminAuditHelper } from '../../administration/admin-audit.helper';
import { ShiftsService } from '../../shifts/shifts.service';
import type {
  SupportDataListQuery,
  SupportDataRow,
} from '../support-data.types';

@Injectable()
export class ShiftAdapter {
  constructor(
    private readonly shifts: ShiftsService,
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditHelper,
  ) {}

  private toRow(row: {
    id: string;
    code: string;
    name: string;
    startTime: string;
    endTime: string;
    sortOrder: number;
    status: string;
    campusId: string;
    institutionId: string;
  }): SupportDataRow {
    return {
      id: row.id,
      code: row.code,
      label: row.name,
      sortOrder: row.sortOrder,
      isActive: row.status === 'ACTIVE',
      metadata: {
        startTime: row.startTime,
        endTime: row.endTime,
        status: row.status,
        campusId: row.campusId,
        institutionId: row.institutionId,
      },
    };
  }

  async list(
    tenantId: string,
    query: SupportDataListQuery,
  ): Promise<SupportDataRow[]> {
    const rows = await this.shifts.list(tenantId, {
      campusId: query.campusId,
      institutionId: query.institutionId,
      ...(query.activeOnly !== false ? { status: 'ACTIVE' } : {}),
    });
    let result = rows.map((r) => this.toRow(r as never));
    const q = query.q?.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (r) =>
          r.code.toLowerCase().includes(q) || r.label.toLowerCase().includes(q),
      );
    }
    return result;
  }

  private async defaultInstitution(tenantId: string) {
    const inst = await this.prisma.institution.findFirst({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    if (!inst) throw new BadRequestException('No institution configured');
    const campus = await this.prisma.campus.findFirst({
      where: { tenantId, institutionId: inst.id, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    if (!campus) throw new BadRequestException('No campus configured');
    return { inst, campus };
  }

  async create(
    tenantId: string,
    payload: Record<string, unknown>,
    actorUserId?: string,
  ): Promise<SupportDataRow> {
    const { inst, campus } = await this.defaultInstitution(tenantId);
    const row = await this.shifts.create(
      tenantId,
      {
        institutionId: (payload.institutionId as string) || inst.id,
        campusId: (payload.campusId as string) || campus.id,
        name: String(payload.label ?? payload.name ?? ''),
        code: String(payload.code ?? ''),
        startTime: String(payload.startTime ?? '09:00'),
        endTime: String(payload.endTime ?? '17:00'),
        sortOrder: Number(payload.sortOrder ?? 0),
        status: (payload.status as string) || 'ACTIVE',
      },
      actorUserId,
    );
    await this.audit.log({
      tenantId,
      userId: actorUserId,
      module: 'support-data',
      action: 'create',
      entityType: 'shifts',
      entityId: row.id,
    });
    return this.toRow(row as never);
  }

  async update(
    tenantId: string,
    id: string,
    payload: Record<string, unknown>,
    actorUserId?: string,
  ): Promise<SupportDataRow> {
    const row = await this.shifts.update(tenantId, id, {
      name: payload.label !== undefined ? String(payload.label) : undefined,
      code: payload.code !== undefined ? String(payload.code) : undefined,
      startTime:
        payload.startTime !== undefined ? String(payload.startTime) : undefined,
      endTime:
        payload.endTime !== undefined ? String(payload.endTime) : undefined,
      sortOrder:
        payload.sortOrder !== undefined ? Number(payload.sortOrder) : undefined,
      status: payload.status as string | undefined,
    });
    await this.audit.log({
      tenantId,
      userId: actorUserId,
      module: 'support-data',
      action: 'update',
      entityType: 'shifts',
      entityId: id,
    });
    return this.toRow(row as never);
  }

  async setStatus(
    tenantId: string,
    id: string,
    isActive: boolean,
    actorUserId?: string,
  ): Promise<SupportDataRow> {
    const row = isActive
      ? await this.shifts.activate(tenantId, id)
      : await this.shifts.deactivate(tenantId, id);
    await this.audit.log({
      tenantId,
      userId: actorUserId,
      module: 'support-data',
      action: isActive ? 'activate' : 'deactivate',
      entityType: 'shifts',
      entityId: id,
    });
    return this.toRow(row as never);
  }

  async archive(tenantId: string, id: string, actorUserId?: string) {
    await this.setStatus(tenantId, id, false, actorUserId);
    await this.audit.log({
      tenantId,
      userId: actorUserId,
      module: 'support-data',
      action: 'archive',
      entityType: 'shifts',
      entityId: id,
    });
  }

  async restore(
    tenantId: string,
    id: string,
    actorUserId?: string,
  ): Promise<SupportDataRow> {
    return this.setStatus(tenantId, id, true, actorUserId);
  }

  async reorder(tenantId: string, ids: string[], actorUserId?: string) {
    await this.shifts.reorder(tenantId, ids);
    await this.audit.log({
      tenantId,
      userId: actorUserId,
      module: 'support-data',
      action: 'reorder',
      entityType: 'shifts',
      metadata: { ids },
    });
  }
}
