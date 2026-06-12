import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { ShiftScopeService } from '../../common/services/shift-scope.service';
import {
  formatShiftTime,
  parseTimeToDate,
  type ShiftScope,
} from '../../common/utils/shift-scope.util';
import { CreateShiftDto, UpdateShiftDto } from './dto/shifts.dto';

const shiftInclude = {
  institution: { select: { id: true, name: true, code: true } },
  campus: { select: { id: true, name: true, code: true } },
};

@Injectable()
export class ShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shiftScope: ShiftScopeService,
  ) {}

  private normalizeCode(code: string) {
    return code.trim().toUpperCase();
  }

  private serializeShift<
    T extends { startTime: Date; endTime: Date; code: string },
  >(row: T) {
    return {
      ...row,
      code: row.code,
      startTime: formatShiftTime(row.startTime),
      endTime: formatShiftTime(row.endTime),
    };
  }

  private async assertCampus(
    tenantId: string,
    institutionId: string,
    campusId: string,
  ) {
    const campus = await this.prisma.campus.findFirst({
      where: {
        id: campusId,
        tenantId,
        institutionId,
        deletedAt: null,
      },
    });
    if (!campus) {
      throw new BadRequestException('Campus does not belong to institution');
    }
    return campus;
  }

  private async assertUnique(
    campusId: string,
    name: string,
    code: string,
    excludeId?: string,
  ) {
    const codeRow = await this.prisma.shift.findFirst({
      where: {
        campusId,
        code,
        deletedAt: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (codeRow)
      throw new ConflictException('Shift already exists for this campus.');

    const nameRow = await this.prisma.shift.findFirst({
      where: {
        campusId,
        name,
        deletedAt: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (nameRow) {
      throw new ConflictException('Shift already exists for this campus.');
    }
  }

  list(
    tenantId: string,
    filters?: {
      campusId?: string;
      institutionId?: string;
      status?: string;
    },
  ) {
    return this.prisma.shift
      .findMany({
        where: {
          tenantId,
          deletedAt: null,
          campus: { deletedAt: null },
          ...(filters?.campusId ? { campusId: filters.campusId } : {}),
          ...(filters?.institutionId
            ? { institutionId: filters.institutionId }
            : {}),
          ...(filters?.status ? { status: filters.status } : {}),
        },
        include: shiftInclude,
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      })
      .then((rows) => rows.map((r) => this.serializeShift(r)));
  }

  async get(tenantId: string, id: string) {
    const row = await this.prisma.shift.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: shiftInclude,
    });
    if (!row) throw new NotFoundException('Shift not found');
    return this.serializeShift(row);
  }

  async create(tenantId: string, dto: CreateShiftDto, createdById?: string) {
    const code = this.normalizeCode(dto.code);
    const name = dto.name.trim();
    await this.assertCampus(tenantId, dto.institutionId, dto.campusId);
    await this.assertUnique(dto.campusId, name, code);

    const row = await this.prisma.shift.create({
      data: {
        tenantId,
        institutionId: dto.institutionId,
        campusId: dto.campusId,
        name,
        code,
        startTime: parseTimeToDate(dto.startTime),
        endTime: parseTimeToDate(dto.endTime),
        shiftType: dto.shiftType ?? 'REGULAR',
        status: dto.status ?? 'ACTIVE',
        sortOrder: dto.sortOrder ?? 0,
        description: dto.description?.trim() || null,
        createdById,
      },
      include: shiftInclude,
    });
    return this.serializeShift(row);
  }

  async update(tenantId: string, id: string, dto: UpdateShiftDto) {
    const existing = await this.prisma.shift.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Shift not found');

    const name = dto.name?.trim() ?? existing.name;
    const code = dto.code ? this.normalizeCode(dto.code) : existing.code;
    await this.assertUnique(existing.campusId, name, code, id);

    const row = await this.prisma.shift.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name } : {}),
        ...(dto.code !== undefined ? { code } : {}),
        ...(dto.startTime !== undefined
          ? { startTime: parseTimeToDate(dto.startTime) }
          : {}),
        ...(dto.endTime !== undefined
          ? { endTime: parseTimeToDate(dto.endTime) }
          : {}),
        ...(dto.shiftType !== undefined ? { shiftType: dto.shiftType } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
      },
      include: shiftInclude,
    });
    return this.serializeShift(row);
  }

  async activate(tenantId: string, id: string) {
    return this.update(tenantId, id, { status: 'ACTIVE' });
  }

  async deactivate(tenantId: string, id: string) {
    const active = await this.prisma.campusShiftActiveSemester.findFirst({
      where: { shiftId: id },
    });
    if (active) {
      throw new BadRequestException(
        'Cannot deactivate shift while it is the active operational semester scope',
      );
    }
    return this.update(tenantId, id, { status: 'INACTIVE' });
  }

  async reorder(tenantId: string, shiftIds: string[]) {
    await this.prisma.$transaction(
      shiftIds.map((id, index) =>
        this.prisma.shift.updateMany({
          where: { id, tenantId, deletedAt: null },
          data: { sortOrder: index },
        }),
      ),
    );
    return { ok: true };
  }

  listByInstitution(
    tenantId: string,
    institutionId: string,
    campusId?: string,
    status?: string,
  ) {
    return this.list(tenantId, { institutionId, campusId, status });
  }

  async softDelete(tenantId: string, id: string) {
    const row = await this.prisma.shift.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Shift not found');
    return this.prisma.shift.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async shiftSummary(tenantId: string, scope: ShiftScope, campusId?: string) {
    let where = {
      tenantId,
      deletedAt: null,
      status: 'ACTIVE',
      campus: { deletedAt: null },
      ...(campusId ? { campusId } : {}),
    };
    where = this.shiftScope.applyToWhere(where, scope);

    const shifts = await this.prisma.shift.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    });

    const results = [];
    for (const shift of shifts) {
      const [students, registrations, sections] = await Promise.all([
        this.prisma.student.count({
          where: { tenantId, primaryShiftId: shift.id, deletedAt: null },
        }),
        this.prisma.semesterRegistration.count({
          where: { tenantId, shiftId: shift.id },
        }),
        this.prisma.offeringSection.count({
          where: { tenantId, shiftId: shift.id, deletedAt: null },
        }),
      ]);
      results.push({
        shiftId: shift.id,
        code: shift.code,
        name: shift.name,
        startTime: formatShiftTime(shift.startTime),
        endTime: formatShiftTime(shift.endTime),
        students,
        registrations,
        sections,
      });
    }
    return results;
  }

  async operationsSummary(user: JwtUser, campusId?: string) {
    const scope = this.shiftScope.resolveScope(user);
    let where = {
      tenantId: user.tid,
      deletedAt: null,
      status: 'ACTIVE',
      campus: { deletedAt: null },
      ...(campusId ? { campusId } : {}),
    };
    where = this.shiftScope.applyToWhere(where, scope);

    const shifts = await this.prisma.shift.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    });

    const results = [];
    for (const shift of shifts) {
      const [
        students,
        sections,
        facultyAssignments,
        timetableEntries,
        pendingTransfers,
        pendingRegistrations,
      ] = await Promise.all([
        this.prisma.student.count({
          where: {
            tenantId: user.tid,
            primaryShiftId: shift.id,
            deletedAt: null,
          },
        }),
        this.prisma.offeringSection.count({
          where: {
            tenantId: user.tid,
            shiftId: shift.id,
            deletedAt: null,
            status: 'active',
          },
        }),
        this.prisma.staffShiftAssignment.count({
          where: { tenantId: user.tid, shiftId: shift.id },
        }),
        this.prisma.timetableEntry.count({
          where: { tenantId: user.tid, shiftId: shift.id },
        }),
        this.prisma.studentShiftTransfer.count({
          where: { tenantId: user.tid, status: 'pending', toShiftId: shift.id },
        }),
        this.prisma.semesterRegistration.count({
          where: {
            tenantId: user.tid,
            shiftId: shift.id,
            status: { in: ['submitted', 'pending_approval'] },
          },
        }),
      ]);

      results.push({
        shiftId: shift.id,
        code: shift.code,
        name: shift.name,
        startTime: formatShiftTime(shift.startTime),
        endTime: formatShiftTime(shift.endTime),
        students,
        activeSections: sections,
        facultyAssignments,
        timetableEntries,
        pendingApprovals: pendingTransfers + pendingRegistrations,
      });
    }
    return results;
  }
}
