import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AdminAuditHelper } from '../../administration/admin-audit.helper';
import type {
  SupportDataListQuery,
  SupportDataRow,
} from '../support-data.types';

@Injectable()
export class LookupAdapter {
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
    metadata: unknown;
  }): SupportDataRow {
    const metadata =
      row.metadata &&
      typeof row.metadata === 'object' &&
      !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : undefined;
    return {
      id: row.id,
      code: row.code,
      label: row.label,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
      metadata,
    };
  }

  async list(
    tenantId: string,
    lookupType: string,
    query: SupportDataListQuery,
  ): Promise<SupportDataRow[]> {
    const q = query.q?.trim();
    const rows = await this.prisma.masterLookup.findMany({
      where: {
        tenantId,
        lookupType,
        archivedAt: null,
        ...(query.activeOnly !== false ? { isActive: true } : {}),
        ...(query.campusId
          ? { OR: [{ campusId: null }, { campusId: query.campusId }] }
          : {}),
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
    if (query.activeOnly === false) {
      return rows.map((r) => this.toRow(r));
    }
    return rows.map((r) => this.toRow(r));
  }

  async listInactive(
    tenantId: string,
    lookupType: string,
    query: SupportDataListQuery,
  ) {
    const rows = await this.prisma.masterLookup.findMany({
      where: {
        tenantId,
        lookupType,
        ...(query.activeOnly === false
          ? {}
          : { isActive: true, archivedAt: null }),
        ...(query.campusId
          ? { OR: [{ campusId: null }, { campusId: query.campusId }] }
          : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
    return rows.map((r) => this.toRow(r));
  }

  private buildMetadata(payload: Record<string, unknown>) {
    const metadata: Record<string, unknown> = { ...payload };
    delete metadata.code;
    delete metadata.label;
    delete metadata.sortOrder;
    delete metadata.isActive;
    delete metadata.status;
    delete metadata.campusId;
    return Object.keys(metadata).length ? metadata : undefined;
  }

  async create(
    tenantId: string,
    lookupType: string,
    categoryCode: string,
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

    const existing = await this.prisma.masterLookup.findFirst({
      where: { tenantId, lookupType, code },
    });
    if (existing) throw new ConflictException('Code already exists');

    const row = await this.prisma.masterLookup.create({
      data: {
        tenantId,
        lookupType,
        code,
        label,
        sortOrder: Number(payload.sortOrder ?? 0),
        isActive: payload.isActive !== false,
        metadata: this.buildMetadata(payload) as
          | Prisma.InputJsonValue
          | undefined,
        campusId: (payload.campusId as string) || null,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      module: 'support-data',
      action: 'create',
      entityType: categoryCode,
      entityId: row.id,
      metadata: { code, label },
    });

    return this.toRow(row);
  }

  async update(
    tenantId: string,
    lookupType: string,
    categoryCode: string,
    id: string,
    payload: Record<string, unknown>,
    actorUserId?: string,
  ): Promise<SupportDataRow> {
    const row = await this.prisma.masterLookup.findFirst({
      where: { id, tenantId, lookupType },
    });
    if (!row) throw new NotFoundException('Entry not found');

    const label =
      payload.label !== undefined ? String(payload.label).trim() : row.label;
    const metadata = {
      ...((row.metadata as Record<string, unknown>) ?? {}),
      ...(this.buildMetadata(payload) ?? {}),
    } as Prisma.InputJsonValue;

    const updated = await this.prisma.masterLookup.update({
      where: { id },
      data: {
        label,
        ...(payload.sortOrder !== undefined
          ? { sortOrder: Number(payload.sortOrder) }
          : {}),
        ...(payload.isActive !== undefined
          ? { isActive: Boolean(payload.isActive) }
          : {}),
        metadata,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      module: 'support-data',
      action: 'update',
      entityType: categoryCode,
      entityId: id,
      metadata: { before: { label: row.label }, after: { label } },
    });

    return this.toRow(updated);
  }

  async setStatus(
    tenantId: string,
    lookupType: string,
    categoryCode: string,
    id: string,
    isActive: boolean,
    actorUserId?: string,
  ): Promise<SupportDataRow> {
    return this.update(
      tenantId,
      lookupType,
      categoryCode,
      id,
      { isActive },
      actorUserId,
    );
  }

  async archive(
    tenantId: string,
    lookupType: string,
    categoryCode: string,
    id: string,
    actorUserId?: string,
  ) {
    const row = await this.prisma.masterLookup.findFirst({
      where: { id, tenantId, lookupType },
    });
    if (!row) throw new NotFoundException('Entry not found');
    await this.prisma.masterLookup.update({
      where: { id },
      data: { isActive: false, archivedAt: new Date() },
    });
    await this.audit.log({
      tenantId,
      userId: actorUserId,
      module: 'support-data',
      action: 'archive',
      entityType: categoryCode,
      entityId: id,
    });
  }

  async restore(
    tenantId: string,
    lookupType: string,
    categoryCode: string,
    id: string,
    actorUserId?: string,
  ): Promise<SupportDataRow> {
    const row = await this.prisma.masterLookup.findFirst({
      where: { id, tenantId, lookupType },
    });
    if (!row) throw new NotFoundException('Entry not found');
    const updated = await this.prisma.masterLookup.update({
      where: { id },
      data: { isActive: true, archivedAt: null },
    });
    await this.audit.log({
      tenantId,
      userId: actorUserId,
      module: 'support-data',
      action: 'restore',
      entityType: categoryCode,
      entityId: id,
    });
    return this.toRow(updated);
  }

  async reorder(
    tenantId: string,
    lookupType: string,
    categoryCode: string,
    ids: string[],
    actorUserId?: string,
  ) {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.masterLookup.updateMany({
          where: { id, tenantId, lookupType },
          data: { sortOrder: index },
        }),
      ),
    );
    await this.audit.log({
      tenantId,
      userId: actorUserId,
      module: 'support-data',
      action: 'reorder',
      entityType: categoryCode,
      metadata: { ids },
    });
  }
}
