import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import type {
  AllocateStudentsDto,
  AutoAllocateDto,
  BulkTransferDto,
  TransferStudentDto,
  UpsertCoordinatorDto,
  UpsertHouseDto,
} from '../dto/campus-competitions.dto';

@Injectable()
export class CompetitionHousesService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  private hasPermission(user: JwtUser, slug: string) {
    return user.permissions?.includes(slug) ?? false;
  }

  private requireManage(user: JwtUser) {
    if (!this.hasPermission(user, 'campus-competitions:manage')) {
      throw new ForbiddenException('Manage permission required');
    }
  }

  private requireAllocate(user: JwtUser) {
    if (
      !this.hasPermission(user, 'campus-competitions:allocate') &&
      !this.hasPermission(user, 'campus-competitions:manage')
    ) {
      throw new ForbiddenException('Allocate permission required');
    }
  }

  private async audit(
    user: JwtUser,
    action: string,
    input: Record<string, unknown> = {},
  ) {
    return this.db().competitionAuditLog.create({
      data: {
        tenantId: user.tid,
        actorId: user.sub,
        action,
        entityType: String(input.entityType ?? 'house'),
        entityId: (input.entityId as string) ?? null,
        houseId: (input.houseId as string) ?? null,
        meetId: (input.meetId as string) ?? null,
        before: input.before ?? null,
        after: input.after ?? null,
        metadata: input.metadata ?? {},
      },
    });
  }

  listHouses(user: JwtUser, status?: string) {
    return this.db().competitionHouse.findMany({
      where: {
        tenantId: user.tid,
        deletedAt: null,
        ...(status ? { status } : {}),
      },
      include: {
        coordinators: true,
        _count: {
          select: {
            memberships: { where: { status: 'ACTIVE' } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getHouse(user: JwtUser, houseId: string) {
    const house = await this.db().competitionHouse.findFirst({
      where: { id: houseId, tenantId: user.tid, deletedAt: null },
      include: {
        coordinators: true,
        memberships: {
          where: { status: 'ACTIVE' },
          take: 500,
          orderBy: { allocatedAt: 'desc' },
        },
      },
    });
    if (!house) throw new NotFoundException('House not found');
    return house;
  }

  async createHouse(user: JwtUser, dto: UpsertHouseDto) {
    this.requireManage(user);
    const code = dto.code.trim().toUpperCase();
    const existing = await this.db().competitionHouse.findFirst({
      where: { tenantId: user.tid, code, deletedAt: null },
    });
    if (existing) throw new BadRequestException('House code already exists');

    const house = await this.db().competitionHouse.create({
      data: {
        tenantId: user.tid,
        name: dto.name.trim(),
        code,
        color: dto.color?.trim() || '#2563eb',
        logoUrl: dto.logoUrl ?? null,
        motto: dto.motto?.trim() ?? '',
        description: dto.description?.trim() ?? '',
        status: dto.status ?? 'ACTIVE',
      },
    });
    await this.audit(user, 'house.created', {
      entityType: 'house',
      entityId: house.id,
      houseId: house.id,
      after: house,
    });
    return house;
  }

  async updateHouse(user: JwtUser, houseId: string, dto: UpsertHouseDto) {
    this.requireManage(user);
    const before = await this.getHouse(user, houseId);
    const code = dto.code.trim().toUpperCase();
    const house = await this.db().competitionHouse.update({
      where: { id: houseId },
      data: {
        name: dto.name.trim(),
        code,
        color: dto.color?.trim() || before.color,
        logoUrl: dto.logoUrl ?? before.logoUrl,
        motto: dto.motto?.trim() ?? before.motto,
        description: dto.description?.trim() ?? before.description,
        status: dto.status ?? before.status,
      },
    });
    await this.audit(user, 'house.updated', {
      entityType: 'house',
      entityId: houseId,
      houseId,
      before,
      after: house,
    });
    return house;
  }

  async setHouseStatus(
    user: JwtUser,
    houseId: string,
    status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED',
  ) {
    this.requireManage(user);
    await this.getHouse(user, houseId);
    return this.db().competitionHouse.update({
      where: { id: houseId },
      data: { status },
    });
  }

  async mergeHouses(user: JwtUser, fromHouseId: string, intoHouseId: string) {
    this.requireManage(user);
    if (fromHouseId === intoHouseId) {
      throw new BadRequestException('Cannot merge a house into itself');
    }
    const from = await this.getHouse(user, fromHouseId);
    const into = await this.getHouse(user, intoHouseId);

    await this.db().competitionHouseMembership.updateMany({
      where: {
        tenantId: user.tid,
        houseId: fromHouseId,
        status: 'ACTIVE',
      },
      data: { houseId: intoHouseId, source: 'TRANSFER' },
    });
    await this.db().competitionHouse.update({
      where: { id: fromHouseId },
      data: { status: 'ARCHIVED', mergedIntoId: intoHouseId },
    });
    await this.audit(user, 'house.merged', {
      entityType: 'house',
      entityId: fromHouseId,
      houseId: intoHouseId,
      before: from,
      after: into,
      metadata: { fromHouseId, intoHouseId },
    });
    return this.getHouse(user, intoHouseId);
  }

  async upsertCoordinator(
    user: JwtUser,
    houseId: string,
    dto: UpsertCoordinatorDto,
  ) {
    this.requireManage(user);
    await this.getHouse(user, houseId);
    const existing = await this.db().competitionHouseCoordinator.findFirst({
      where: {
        tenantId: user.tid,
        houseId,
        staffId: dto.staffId,
        role: dto.role,
      },
    });
    if (existing) {
      return this.db().competitionHouseCoordinator.update({
        where: { id: existing.id },
        data: { isPrimary: dto.isPrimary ?? existing.isPrimary },
      });
    }
    return this.db().competitionHouseCoordinator.create({
      data: {
        tenantId: user.tid,
        houseId,
        staffId: dto.staffId,
        role: dto.role,
        isPrimary: dto.isPrimary ?? false,
      },
    });
  }

  async removeCoordinator(user: JwtUser, coordinatorId: string) {
    this.requireManage(user);
    const row = await this.db().competitionHouseCoordinator.findFirst({
      where: { id: coordinatorId, tenantId: user.tid },
    });
    if (!row) throw new NotFoundException('Coordinator not found');
    await this.db().competitionHouseCoordinator.delete({
      where: { id: coordinatorId },
    });
    return { ok: true };
  }

  async activeMembershipForStudent(tenantId: string, studentId: string) {
    return this.db().competitionHouseMembership.findFirst({
      where: { tenantId, studentId, status: 'ACTIVE' },
      include: { house: true },
    });
  }

  async allocateStudents(user: JwtUser, dto: AllocateStudentsDto) {
    this.requireAllocate(user);
    await this.getHouse(user, dto.houseId);
    const results = [];
    for (const studentId of dto.studentIds) {
      const existing = await this.activeMembershipForStudent(
        user.tid,
        studentId,
      );
      if (existing) {
        if (existing.houseId === dto.houseId) {
          results.push({ studentId, status: 'ALREADY_ASSIGNED' });
          continue;
        }
        await this.db().competitionHouseMembership.update({
          where: { id: existing.id },
          data: { status: 'ENDED', endedAt: new Date() },
        });
        await this.db().competitionHouseTransfer.create({
          data: {
            tenantId: user.tid,
            fromHouseId: existing.houseId,
            toHouseId: dto.houseId,
            studentId,
            reason: 'Manual reallocation',
            actorId: user.sub,
          },
        });
      }
      const membership = await this.db().competitionHouseMembership.create({
        data: {
          tenantId: user.tid,
          houseId: dto.houseId,
          studentId,
          academicYearId: dto.academicYearId ?? null,
          status: 'ACTIVE',
          source: 'MANUAL',
        },
      });
      results.push({
        studentId,
        status: 'ALLOCATED',
        membershipId: membership.id,
      });
    }
    await this.audit(user, 'house.allocated', {
      entityType: 'house',
      houseId: dto.houseId,
      metadata: { count: dto.studentIds.length },
    });
    return {
      allocated: results.filter((r) => r.status === 'ALLOCATED').length,
      results,
    };
  }

  async autoAllocate(user: JwtUser, dto: AutoAllocateDto) {
    this.requireAllocate(user);
    const houses = await this.db().competitionHouse.findMany({
      where: { tenantId: user.tid, status: 'ACTIVE', deletedAt: null },
      orderBy: { name: 'asc' },
    });
    if (houses.length < 2) {
      throw new BadRequestException('At least two active houses are required');
    }

    let students: Array<{
      id: string;
      gender?: string | null;
      departmentId?: string | null;
    }>;

    if (dto.studentIds?.length) {
      const rows = await this.prisma.student.findMany({
        where: {
          tenantId: user.tid,
          id: { in: dto.studentIds },
          deletedAt: null,
        },
        select: {
          id: true,
          departmentId: true,
          masterProfile: { select: { gender: true } },
        },
      });
      students = rows.map((s) => ({
        id: s.id,
        departmentId: s.departmentId,
        gender: s.masterProfile?.gender ?? null,
      }));
    } else {
      const already = await this.db().competitionHouseMembership.findMany({
        where: { tenantId: user.tid, status: 'ACTIVE' },
        select: { studentId: true },
      });
      const assigned = new Set(
        already.map((m: { studentId: string }) => m.studentId),
      );
      const all = await this.prisma.student.findMany({
        where: { tenantId: user.tid, deletedAt: null },
        select: {
          id: true,
          departmentId: true,
          masterProfile: { select: { gender: true } },
        },
        take: 5000,
      });
      students = all
        .filter((s) => !assigned.has(s.id))
        .map((s) => ({
          id: s.id,
          departmentId: s.departmentId,
          gender: s.masterProfile?.gender ?? null,
        }));
    }

    // Balance by sorting into buckets then round-robin across houses
    const sorted = [...students].sort((a, b) => {
      const ga = (a.gender ?? '').localeCompare(b.gender ?? '');
      if (dto.balanceGender !== false && ga !== 0) return ga;
      const da = (a.departmentId ?? '').localeCompare(b.departmentId ?? '');
      if (dto.balanceDepartment !== false && da !== 0) return da;
      return a.id.localeCompare(b.id);
    });

    const counts = houses.map(() => 0);
    const results = [];
    for (const student of sorted) {
      let targetIdx = 0;
      for (let i = 1; i < counts.length; i++) {
        if (counts[i] < counts[targetIdx]) targetIdx = i;
      }
      const house = houses[targetIdx];
      counts[targetIdx] += 1;
      const membership = await this.db().competitionHouseMembership.create({
        data: {
          tenantId: user.tid,
          houseId: house.id,
          studentId: student.id,
          academicYearId: dto.academicYearId ?? null,
          status: 'ACTIVE',
          source: 'AUTO',
        },
      });
      results.push({
        studentId: student.id,
        houseId: house.id,
        houseCode: house.code,
        membershipId: membership.id,
      });
    }

    await this.audit(user, 'house.auto_allocated', {
      entityType: 'house',
      metadata: {
        students: results.length,
        houses: houses.map((h: { code: string }, i: number) => ({
          code: h.code,
          count: counts[i],
        })),
      },
    });

    return {
      allocated: results.length,
      distribution: houses.map(
        (h: { id: string; code: string; name: string }, i: number) => ({
          houseId: h.id,
          code: h.code,
          name: h.name,
          count: counts[i],
        }),
      ),
      results,
    };
  }

  async importAllocations(
    user: JwtUser,
    rows: Array<{ studentKey: string; houseCode: string }>,
  ) {
    this.requireAllocate(user);
    const houses = await this.db().competitionHouse.findMany({
      where: { tenantId: user.tid, deletedAt: null },
    });
    const byCode = new Map(
      houses.map((h: { code: string; id: string }) => [
        h.code.toUpperCase(),
        h.id,
      ]),
    );

    const results = [];
    for (const row of rows) {
      const houseId = byCode.get(row.houseCode.trim().toUpperCase());
      if (!houseId) {
        results.push({ ...row, status: 'HOUSE_NOT_FOUND' });
        continue;
      }
      const student = await this.prisma.student.findFirst({
        where: {
          tenantId: user.tid,
          deletedAt: null,
          OR: [
            { enrollmentNumber: row.studentKey },
            { admissionNumber: row.studentKey },
            { rollNumber: row.studentKey },
          ],
        },
        select: { id: true },
      });
      if (!student) {
        results.push({ ...row, status: 'STUDENT_NOT_FOUND' });
        continue;
      }
      const existing = await this.activeMembershipForStudent(
        user.tid,
        student.id,
      );
      if (existing) {
        await this.db().competitionHouseMembership.update({
          where: { id: existing.id },
          data: { status: 'ENDED', endedAt: new Date() },
        });
      }
      await this.db().competitionHouseMembership.create({
        data: {
          tenantId: user.tid,
          houseId,
          studentId: student.id,
          status: 'ACTIVE',
          source: 'IMPORT',
        },
      });
      results.push({ ...row, studentId: student.id, houseId, status: 'OK' });
    }
    return {
      imported: results.filter((r) => r.status === 'OK').length,
      results,
    };
  }

  async transferStudent(user: JwtUser, dto: TransferStudentDto) {
    this.requireAllocate(user);
    await this.getHouse(user, dto.toHouseId);
    const existing = await this.activeMembershipForStudent(
      user.tid,
      dto.studentId,
    );
    if (!existing) {
      throw new BadRequestException('Student is not allocated to a house');
    }
    if (existing.houseId === dto.toHouseId) {
      throw new BadRequestException('Student already in target house');
    }
    await this.db().competitionHouseMembership.update({
      where: { id: existing.id },
      data: { status: 'ENDED', endedAt: new Date() },
    });
    const membership = await this.db().competitionHouseMembership.create({
      data: {
        tenantId: user.tid,
        houseId: dto.toHouseId,
        studentId: dto.studentId,
        academicYearId: existing.academicYearId,
        status: 'ACTIVE',
        source: 'TRANSFER',
      },
    });
    const transfer = await this.db().competitionHouseTransfer.create({
      data: {
        tenantId: user.tid,
        fromHouseId: existing.houseId,
        toHouseId: dto.toHouseId,
        studentId: dto.studentId,
        reason: dto.reason?.trim() ?? '',
        actorId: user.sub,
      },
    });
    return { membership, transfer };
  }

  async bulkTransfer(user: JwtUser, dto: BulkTransferDto) {
    const results = [];
    for (const studentId of dto.studentIds) {
      try {
        results.push({
          studentId,
          ...(await this.transferStudent(user, {
            studentId,
            toHouseId: dto.toHouseId,
            reason: dto.reason,
          })),
          status: 'OK',
        });
      } catch (e) {
        results.push({
          studentId,
          status: 'ERROR',
          error: e instanceof Error ? e.message : 'Failed',
        });
      }
    }
    return {
      transferred: results.filter((r) => r.status === 'OK').length,
      results,
    };
  }

  transferHistory(user: JwtUser, studentId?: string) {
    return this.db().competitionHouseTransfer.findMany({
      where: {
        tenantId: user.tid,
        ...(studentId ? { studentId } : {}),
      },
      include: {
        fromHouse: { select: { id: true, name: true, code: true } },
        toHouse: { select: { id: true, name: true, code: true } },
      },
      orderBy: { transferredAt: 'desc' },
      take: 500,
    });
  }

  async houseDashboard(user: JwtUser, houseId: string, meetId?: string) {
    const house = await this.getHouse(user, houseId);
    const memberships = await this.db().competitionHouseMembership.findMany({
      where: { tenantId: user.tid, houseId, status: 'ACTIVE' },
      select: { studentId: true },
    });
    const studentIds = memberships.map(
      (m: { studentId: string }) => m.studentId,
    );
    const students = studentIds.length
      ? await this.prisma.student.findMany({
          where: { id: { in: studentIds }, tenantId: user.tid },
          select: {
            id: true,
            masterProfile: { select: { gender: true } },
          },
        })
      : [];
    const boys = students.filter((s) =>
      (s.masterProfile?.gender ?? '').toUpperCase().startsWith('M'),
    ).length;
    const girls = students.filter((s) =>
      (s.masterProfile?.gender ?? '').toUpperCase().startsWith('F'),
    ).length;

    let points = 0;
    let rank: number | null = null;
    let medals = { gold: 0, silver: 0, bronze: 0 };
    if (meetId) {
      const ledger = await this.db().housePointLedger.findMany({
        where: { tenantId: user.tid, meetId, houseId },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });
      points = ledger[0]?.balanceAfter ?? 0;
      const totals = await this.db().housePointLedger.groupBy({
        by: ['houseId'],
        where: { tenantId: user.tid, meetId },
        _sum: { delta: true },
      });
      const ranked = totals
        .map((t: { houseId: string; _sum: { delta: number | null } }) => ({
          houseId: t.houseId,
          points: t._sum.delta ?? 0,
        }))
        .sort(
          (a: { points: number }, b: { points: number }) => b.points - a.points,
        );
      rank =
        ranked.findIndex((r: { houseId: string }) => r.houseId === houseId) + 1;
      if (rank === 0) rank = null;
      const medalRows = await this.db().competitionMedal.groupBy({
        by: ['metal'],
        where: { tenantId: user.tid, meetId, houseId },
        _count: true,
      });
      for (const row of medalRows) {
        if (row.metal === 'GOLD') medals.gold = row._count;
        if (row.metal === 'SILVER') medals.silver = row._count;
        if (row.metal === 'BRONZE') medals.bronze = row._count;
      }
    }

    return {
      house,
      totalStudents: students.length,
      boys,
      girls,
      facultyCoordinators: house.coordinators?.length ?? 0,
      championshipPoints: points,
      currentRank: rank,
      medals,
    };
  }

  async myHouse(user: JwtUser) {
    const student = await this.prisma.student.findFirst({
      where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student profile not found');
    return this.activeMembershipForStudent(user.tid, student.id);
  }

  async resolveStudentId(user: JwtUser) {
    const student = await this.prisma.student.findFirst({
      where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student profile not found');
    return student.id;
  }
}
