import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AdminAuditHelper } from '../../administration/admin-audit.helper';
import type {
  SupportDataListQuery,
  SupportDataRow,
} from '../support-data.types';

@Injectable()
export class AcademicRoleAdapter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditHelper,
  ) {}

  private toRow(row: {
    id: string;
    code: string;
    label: string;
    sortOrder: number;
    isActive: boolean;
  }): SupportDataRow {
    return {
      id: row.id,
      code: row.code,
      label: row.label,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
    };
  }

  async list(
    tenantId: string,
    query: SupportDataListQuery,
  ): Promise<SupportDataRow[]> {
    const q = query.q?.trim();
    const rows = await this.prisma.academicRoleDefinition.findMany({
      where: {
        tenantId,
        ...(query.activeOnly !== false ? { isActive: true } : {}),
        ...(q
          ? {
              OR: [
                { code: { contains: q, mode: 'insensitive' } },
                { label: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
    return rows.map((r) => this.toRow(r));
  }

  async create(
    tenantId: string,
    payload: Record<string, unknown>,
    actorUserId?: string,
  ): Promise<SupportDataRow> {
    const code = String(payload.code ?? '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_');
    const label = String(payload.label ?? '').trim();
    if (!code || !label)
      throw new BadRequestException('Code and label are required');

    const existing = await this.prisma.academicRoleDefinition.findFirst({
      where: { tenantId, code },
    });
    if (existing) throw new ConflictException('Role code already exists');

    const row = await this.prisma.academicRoleDefinition.create({
      data: {
        tenantId,
        code,
        label,
        sortOrder: Number(payload.sortOrder ?? 0),
        isActive: payload.isActive !== false,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      module: 'support-data',
      action: 'create',
      entityType: 'additional-roles',
      entityId: row.id,
    });

    return this.toRow(row);
  }

  async update(
    tenantId: string,
    id: string,
    payload: Record<string, unknown>,
    actorUserId?: string,
  ): Promise<SupportDataRow> {
    const row = await this.prisma.academicRoleDefinition.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Role not found');

    const updated = await this.prisma.academicRoleDefinition.update({
      where: { id },
      data: {
        ...(payload.label !== undefined
          ? { label: String(payload.label).trim() }
          : {}),
        ...(payload.sortOrder !== undefined
          ? { sortOrder: Number(payload.sortOrder) }
          : {}),
        ...(payload.isActive !== undefined
          ? { isActive: Boolean(payload.isActive) }
          : {}),
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      module: 'support-data',
      action: 'update',
      entityType: 'additional-roles',
      entityId: id,
    });

    return this.toRow(updated);
  }

  async setStatus(
    tenantId: string,
    id: string,
    isActive: boolean,
    actorUserId?: string,
  ): Promise<SupportDataRow> {
    return this.update(tenantId, id, { isActive }, actorUserId);
  }

  async archive(tenantId: string, id: string, actorUserId?: string) {
    const role = await this.prisma.academicRoleDefinition.findFirst({
      where: { id, tenantId },
    });
    if (!role) throw new NotFoundException('Role not found');

    const inUse = await this.prisma.staffAdditionalRole.count({
      where: { tenantId, roleCode: role.code, active: true },
    });
    if (inUse > 0) {
      throw new BadRequestException('Cannot archive role assigned to staff');
    }

    await this.update(tenantId, id, { isActive: false }, actorUserId);
    await this.audit.log({
      tenantId,
      userId: actorUserId,
      module: 'support-data',
      action: 'archive',
      entityType: 'additional-roles',
      entityId: id,
    });
  }

  async restore(
    tenantId: string,
    id: string,
    actorUserId?: string,
  ): Promise<SupportDataRow> {
    return this.update(tenantId, id, { isActive: true }, actorUserId);
  }

  async reorder(tenantId: string, ids: string[], actorUserId?: string) {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.academicRoleDefinition.updateMany({
          where: { id, tenantId },
          data: { sortOrder: index },
        }),
      ),
    );
    await this.audit.log({
      tenantId,
      userId: actorUserId,
      module: 'support-data',
      action: 'reorder',
      entityType: 'additional-roles',
      metadata: { ids },
    });
  }
}
