import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AdminAuditHelper } from '../../administration/admin-audit.helper';
import { DESIGNATION_CATEGORIES } from '../../staff/services/staff-employment-rules';
import type {
  SupportDataListQuery,
  SupportDataRow,
} from '../support-data.types';

@Injectable()
export class DesignationAdapter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditHelper,
  ) {}

  private toRow(row: {
    id: string;
    code: string;
    label: string;
    category: string;
    sortOrder: number;
    isActive: boolean;
  }): SupportDataRow {
    return {
      id: row.id,
      code: row.code,
      label: row.label,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
      metadata: { category: row.category },
    };
  }

  async list(
    tenantId: string,
    query: SupportDataListQuery,
  ): Promise<SupportDataRow[]> {
    const q = query.q?.trim();
    const rows = await this.prisma.designation.findMany({
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
    const category = String(payload.category ?? 'TEACHING');
    if (!code || !label)
      throw new BadRequestException('Code and label are required');
    if (!DESIGNATION_CATEGORIES.includes(category as never)) {
      throw new BadRequestException('Invalid designation category');
    }
    if (code === 'HOD') {
      throw new BadRequestException(
        'Head of Department is an additional role, not a designation',
      );
    }

    const existing = await this.prisma.designation.findFirst({
      where: { tenantId, code },
    });
    if (existing)
      throw new ConflictException('Designation code already exists');

    const row = await this.prisma.designation.create({
      data: {
        tenantId,
        code,
        label,
        category,
        sortOrder: Number(payload.sortOrder ?? 0),
        isActive: payload.isActive !== false,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      module: 'support-data',
      action: 'create',
      entityType: 'designations',
      entityId: row.id,
      metadata: { code, category },
    });

    return this.toRow(row);
  }

  async update(
    tenantId: string,
    id: string,
    payload: Record<string, unknown>,
    actorUserId?: string,
  ): Promise<SupportDataRow> {
    const row = await this.prisma.designation.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Designation not found');

    const category =
      payload.category !== undefined ? String(payload.category) : row.category;
    if (!DESIGNATION_CATEGORIES.includes(category as never)) {
      throw new BadRequestException('Invalid designation category');
    }

    const updated = await this.prisma.designation.update({
      where: { id },
      data: {
        ...(payload.label !== undefined
          ? { label: String(payload.label).trim() }
          : {}),
        ...(payload.category !== undefined ? { category } : {}),
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
      entityType: 'designations',
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
    const staffCount = await this.prisma.staffProfile.count({
      where: { designationId: id, tenantId, deletedAt: null },
    });
    if (staffCount > 0) {
      throw new BadRequestException(
        'Cannot archive designation assigned to staff',
      );
    }
    await this.update(tenantId, id, { isActive: false }, actorUserId);
    await this.audit.log({
      tenantId,
      userId: actorUserId,
      module: 'support-data',
      action: 'archive',
      entityType: 'designations',
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
        this.prisma.designation.updateMany({
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
      entityType: 'designations',
      metadata: { ids },
    });
  }
}
