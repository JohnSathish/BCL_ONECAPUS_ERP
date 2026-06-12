import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdminAuditHelper } from '../../administration/admin-audit.helper';
import { PrismaService } from '../../../database/prisma.service';
import type {
  SupportDataListQuery,
  SupportDataRow,
} from '../support-data.types';

@Injectable()
export class BoardSubjectAdapter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditHelper,
  ) {}

  async list(
    tenantId: string,
    query: SupportDataListQuery,
  ): Promise<SupportDataRow[]> {
    const q = query.q?.trim();
    const rows = await this.prisma.supportBoardSubject.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(query.activeOnly !== false ? { isActive: true } : {}),
        ...(q
          ? {
              OR: [
                { subjectName: { contains: q, mode: 'insensitive' } },
                { subjectCode: { contains: q, mode: 'insensitive' } },
                { category: { contains: q, mode: 'insensitive' } },
                { boardType: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { subjectName: 'asc' }],
    });
    return rows.map((row) => this.toRow(row));
  }

  async create(
    tenantId: string,
    payload: Record<string, unknown>,
    actorUserId?: string,
  ) {
    const data = this.parsePayload(payload);
    const existing = await this.prisma.supportBoardSubject.findUnique({
      where: {
        tenantId_subjectCode: { tenantId, subjectCode: data.subjectCode },
      },
    });
    if (existing) throw new ConflictException('Subject code already exists');
    const row = await this.prisma.supportBoardSubject.create({
      data: { tenantId, ...data },
    });
    await this.log(tenantId, actorUserId, 'create', row.id, data);
    return this.toRow(row);
  }

  async update(
    tenantId: string,
    id: string,
    payload: Record<string, unknown>,
    actorUserId?: string,
  ) {
    const existing = await this.prisma.supportBoardSubject.findFirst({
      where: { tenantId, id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Board subject not found');
    const data = this.parsePayload(payload, existing);
    const row = await this.prisma.supportBoardSubject.update({
      where: { id },
      data,
    });
    await this.log(tenantId, actorUserId, 'update', row.id, {
      before: existing,
      after: data,
    });
    return this.toRow(row);
  }

  async setStatus(
    tenantId: string,
    id: string,
    isActive: boolean,
    actorUserId?: string,
  ) {
    const row = await this.prisma.supportBoardSubject.update({
      where: { id },
      data: { isActive },
    });
    await this.log(
      tenantId,
      actorUserId,
      isActive ? 'activate' : 'deactivate',
      id,
    );
    return this.toRow(row);
  }

  async archive(tenantId: string, id: string, actorUserId?: string) {
    await this.prisma.supportBoardSubject.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    });
    await this.log(tenantId, actorUserId, 'delete', id);
  }

  async restore(tenantId: string, id: string, actorUserId?: string) {
    const row = await this.prisma.supportBoardSubject.update({
      where: { id },
      data: { isActive: true, deletedAt: null },
    });
    await this.log(tenantId, actorUserId, 'restore', id);
    return this.toRow(row);
  }

  async reorder(tenantId: string, ids: string[], actorUserId?: string) {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.supportBoardSubject.updateMany({
          where: { tenantId, id },
          data: { sortOrder: index + 1 },
        }),
      ),
    );
    await this.log(tenantId, actorUserId, 'reorder', 'bulk', { ids });
  }

  private parsePayload(
    payload: Record<string, unknown>,
    existing?: {
      subjectName: string;
      subjectCode: string;
      category: string;
      boardType: string | null;
      sortOrder: number;
      isActive: boolean;
    },
  ) {
    const subjectName = String(
      payload.subjectName ?? payload.label ?? existing?.subjectName ?? '',
    ).trim();
    const subjectCode = String(
      payload.subjectCode ?? payload.code ?? existing?.subjectCode ?? '',
    )
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_');
    if (!subjectName || !subjectCode) {
      throw new BadRequestException(
        'Subject name and subject code are required',
      );
    }
    return {
      subjectName,
      subjectCode,
      category: String(
        payload.category ?? existing?.category ?? 'GENERAL',
      ).toUpperCase(),
      boardType: payload.boardType
        ? String(payload.boardType).toUpperCase()
        : (existing?.boardType ?? 'GENERAL'),
      sortOrder: Number(payload.sortOrder ?? existing?.sortOrder ?? 0),
      isActive:
        payload.status === 'INACTIVE'
          ? false
          : payload.isActive !== undefined
            ? Boolean(payload.isActive)
            : (existing?.isActive ?? true),
    };
  }

  private toRow(row: {
    id: string;
    subjectCode: string;
    subjectName: string;
    category: string;
    boardType: string | null;
    sortOrder: number;
    isActive: boolean;
  }): SupportDataRow {
    return {
      id: row.id,
      code: row.subjectCode,
      label: row.subjectName,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
      metadata: {
        subjectName: row.subjectName,
        subjectCode: row.subjectCode,
        category: row.category,
        boardType: row.boardType ?? 'GENERAL',
        status: row.isActive ? 'ACTIVE' : 'INACTIVE',
      },
    };
  }

  private log(
    tenantId: string,
    userId: string | undefined,
    action: string,
    entityId: string,
    metadata?: Record<string, unknown>,
  ) {
    return this.audit.log({
      tenantId,
      userId,
      module: 'support-data',
      action,
      entityType: 'board-subjects',
      entityId,
      metadata,
    });
  }
}
