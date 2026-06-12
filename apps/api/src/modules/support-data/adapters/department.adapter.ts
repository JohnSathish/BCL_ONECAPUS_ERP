import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AdminAuditHelper } from '../../administration/admin-audit.helper';
import { OrganizationService } from '../../organization/organization.service';
import type {
  SupportDataListQuery,
  SupportDataRow,
} from '../support-data.types';

@Injectable()
export class DepartmentAdapter {
  constructor(
    private readonly org: OrganizationService,
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditHelper,
  ) {}

  private toRow(row: {
    id: string;
    code: string;
    name: string;
    departmentType: string;
    status: string;
    campusId: string | null;
    institutionId: string;
  }): SupportDataRow {
    return {
      id: row.id,
      code: row.code,
      label: row.name,
      sortOrder: 0,
      isActive: row.status === 'ACTIVE',
      metadata: {
        departmentType: row.departmentType,
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
    const rows = await this.org.listDepartments(tenantId, {
      campusId: query.campusId,
      institutionId: query.institutionId,
      ...(query.activeOnly !== false ? { status: 'ACTIVE' } : {}),
    });
    let result = rows.map((r) => this.toRow(r));
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
    return inst;
  }

  async create(
    tenantId: string,
    payload: Record<string, unknown>,
    actorUserId?: string,
  ): Promise<SupportDataRow> {
    const inst = await this.defaultInstitution(tenantId);
    const campusId = (payload.campusId as string) || undefined;
    const row = await this.org.createDepartment(tenantId, {
      institutionId: (payload.institutionId as string) || inst.id,
      campusId,
      name: String(payload.label ?? payload.name ?? ''),
      code: String(payload.code ?? ''),
      departmentType: (payload.departmentType as string) || 'ACADEMIC',
      status: (payload.status as string) || 'ACTIVE',
    });
    await this.audit.log({
      tenantId,
      userId: actorUserId,
      module: 'support-data',
      action: 'create',
      entityType: 'departments',
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
    const row = await this.org.updateDepartment(tenantId, id, {
      name: payload.label !== undefined ? String(payload.label) : undefined,
      code: payload.code !== undefined ? String(payload.code) : undefined,
      departmentType: payload.departmentType as string | undefined,
      status: payload.status as string | undefined,
      campusId: payload.campusId as string | null | undefined,
    });
    await this.audit.log({
      tenantId,
      userId: actorUserId,
      module: 'support-data',
      action: 'update',
      entityType: 'departments',
      entityId: id,
    });
    return this.toRow(row);
  }

  async setStatus(
    tenantId: string,
    id: string,
    isActive: boolean,
    actorUserId?: string,
  ): Promise<SupportDataRow> {
    if (!isActive) {
      const staffCount = await this.prisma.staffProfile.count({
        where: {
          departmentId: id,
          tenantId,
          deletedAt: null,
          status: 'ACTIVE',
        },
      });
      if (staffCount > 0) {
        throw new BadRequestException(
          'Cannot deactivate department with active staff assigned',
        );
      }
    }
    return this.update(
      tenantId,
      id,
      { status: isActive ? 'ACTIVE' : 'INACTIVE' },
      actorUserId,
    );
  }

  async archive(tenantId: string, id: string, actorUserId?: string) {
    const staffCount = await this.prisma.staffProfile.count({
      where: { departmentId: id, tenantId, deletedAt: null },
    });
    if (staffCount > 0) {
      throw new BadRequestException(
        'Cannot archive department with staff assigned',
      );
    }
    await this.org.softDeleteDepartment(tenantId, id);
    await this.audit.log({
      tenantId,
      userId: actorUserId,
      module: 'support-data',
      action: 'archive',
      entityType: 'departments',
      entityId: id,
    });
  }

  async restore(
    tenantId: string,
    id: string,
    actorUserId?: string,
  ): Promise<SupportDataRow> {
    const row = await this.prisma.department.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Department not found');
    const updated = await this.prisma.department.update({
      where: { id },
      data: { deletedAt: null, status: 'ACTIVE' },
    });
    await this.audit.log({
      tenantId,
      userId: actorUserId,
      module: 'support-data',
      action: 'restore',
      entityType: 'departments',
      entityId: id,
    });
    return this.toRow(updated);
  }

  async reorder() {
    throw new BadRequestException('Reorder not supported for departments');
  }
}
