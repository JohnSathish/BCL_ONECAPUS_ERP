import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import {
  CreateQuarterDto,
  QuarterListQueryDto,
  UpdateQuarterDto,
} from '../dto/accommodation.dto';
import { AccommodationAuditService } from './accommodation-audit.service';

@Injectable()
export class QuarterMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AccommodationAuditService,
  ) {}

  private async nextCode(tenantId: string) {
    const count = await this.prisma.staffQuarter.count({
      where: { tenantId, deletedAt: null },
    });
    return `QTR-${String(count + 1).padStart(3, '0')}`;
  }

  async list(tenantId: string, query: QuarterListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where: Prisma.StaffQuarterWhereInput = {
      tenantId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.quarterType ? { quarterType: query.quarterType } : {}),
      ...(query.block
        ? { block: { contains: query.block, mode: 'insensitive' } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              {
                quarterNumber: { contains: query.search, mode: 'insensitive' },
              },
              { block: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.staffQuarter.findMany({
        where,
        include: {
          occupancies: {
            where: { status: 'ACTIVE' },
            take: 1,
            include: {
              staffProfile: {
                select: {
                  id: true,
                  fullName: true,
                  employeeCode: true,
                  department: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: [{ block: 'asc' }, { quarterNumber: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.staffQuarter.count({ where }),
    ]);

    return {
      data: data.map((q) => this.toQuarterRow(q)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async get(tenantId: string, id: string) {
    const quarter = await this.prisma.staffQuarter.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        occupancies: {
          orderBy: { allottedAt: 'desc' },
          include: {
            staffProfile: {
              select: {
                id: true,
                fullName: true,
                employeeCode: true,
                department: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });
    if (!quarter) throw new NotFoundException('Quarter not found');
    return this.toQuarterDetail(quarter);
  }

  async create(user: JwtUser, dto: CreateQuarterDto) {
    const code = await this.nextCode(user.tid);
    const quarter = await this.prisma.staffQuarter.create({
      data: {
        tenantId: user.tid,
        code,
        quarterNumber: dto.quarterNumber.trim(),
        quarterType: dto.quarterType,
        block: dto.block?.trim() || null,
        floor: dto.floor?.trim() || null,
        numberOfRooms: dto.numberOfRooms ?? null,
        status: dto.status ?? 'VACANT',
        monthlyRent: dto.monthlyRent,
        waterCharge: dto.waterCharge ?? 0,
        electricityCharge: dto.electricityCharge ?? 0,
        maintenanceCharge: dto.maintenanceCharge ?? 0,
        internetCharge: dto.internetCharge ?? 0,
        remarks: dto.remarks?.trim() || null,
      },
    });
    await this.audit.log(
      user.tid,
      'QUARTER',
      quarter.id,
      'QUARTER_CREATED',
      user.sub,
      null,
      quarter,
    );
    return quarter;
  }

  async update(user: JwtUser, id: string, dto: UpdateQuarterDto) {
    const existing = await this.prisma.staffQuarter.findFirst({
      where: { id, tenantId: user.tid, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Quarter not found');

    const quarter = await this.prisma.staffQuarter.update({
      where: { id },
      data: {
        quarterNumber: dto.quarterNumber?.trim(),
        quarterType: dto.quarterType,
        block: dto.block?.trim() || null,
        floor: dto.floor?.trim() || null,
        numberOfRooms: dto.numberOfRooms ?? null,
        status: dto.status,
        monthlyRent: dto.monthlyRent,
        waterCharge: dto.waterCharge ?? 0,
        electricityCharge: dto.electricityCharge ?? 0,
        maintenanceCharge: dto.maintenanceCharge ?? 0,
        internetCharge: dto.internetCharge ?? 0,
        remarks: dto.remarks?.trim() || null,
      },
    });
    await this.audit.log(
      user.tid,
      'QUARTER',
      id,
      'QUARTER_EDITED',
      user.sub,
      existing,
      quarter,
    );
    return quarter;
  }

  async archive(user: JwtUser, id: string) {
    const quarter = await this.prisma.staffQuarter.findFirst({
      where: { id, tenantId: user.tid, deletedAt: null },
    });
    if (!quarter) throw new NotFoundException('Quarter not found');
    if (quarter.status === 'OCCUPIED') {
      throw new BadRequestException('Cannot archive an occupied quarter');
    }
    const updated = await this.prisma.staffQuarter.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.log(
      user.tid,
      'QUARTER',
      id,
      'QUARTER_ARCHIVED',
      user.sub,
      quarter,
      updated,
    );
    return updated;
  }

  async setStatus(user: JwtUser, id: string, status: string) {
    const quarter = await this.prisma.staffQuarter.findFirst({
      where: { id, tenantId: user.tid, deletedAt: null },
    });
    if (!quarter) throw new NotFoundException('Quarter not found');
    if (status !== 'OCCUPIED' && quarter.status === 'OCCUPIED') {
      throw new BadRequestException('Quarter is occupied — vacate first');
    }
    const updated = await this.prisma.staffQuarter.update({
      where: { id },
      data: { status },
    });
    await this.audit.log(
      user.tid,
      'QUARTER',
      id,
      'QUARTER_STATUS_CHANGED',
      user.sub,
      { status: quarter.status },
      { status },
    );
    return updated;
  }

  listTypes(tenantId: string) {
    return this.prisma.quarterTypeConfig.findMany({
      where: { tenantId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createType(user: JwtUser, name: string, slug?: string) {
    const normalizedSlug = (slug ?? name)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
    return this.prisma.quarterTypeConfig.create({
      data: {
        tenantId: user.tid,
        slug: normalizedSlug,
        name: name.trim(),
        isSystem: false,
      },
    });
  }

  private toQuarterRow(
    q: Prisma.StaffQuarterGetPayload<{
      include: {
        occupancies: {
          include: {
            staffProfile: {
              select: {
                id: true;
                fullName: true;
                employeeCode: true;
                department: { select: { name: true } };
              };
            };
          };
        };
      };
    }>,
  ) {
    const active = q.occupancies[0] ?? null;
    return {
      id: q.id,
      code: q.code,
      quarterNumber: q.quarterNumber,
      quarterType: q.quarterType,
      block: q.block,
      floor: q.floor,
      numberOfRooms: q.numberOfRooms,
      status: q.status,
      monthlyRent: Number(q.monthlyRent),
      waterCharge: Number(q.waterCharge),
      electricityCharge: Number(q.electricityCharge),
      maintenanceCharge: Number(q.maintenanceCharge),
      internetCharge: Number(q.internetCharge),
      remarks: q.remarks,
      activeOccupant: active
        ? {
            staffProfileId: active.staffProfile.id,
            fullName: active.staffProfile.fullName,
            employeeCode: active.staffProfile.employeeCode,
            department: active.staffProfile.department?.name ?? null,
            allottedAt: active.allottedAt,
          }
        : null,
    };
  }

  private toQuarterDetail(
    q: Prisma.StaffQuarterGetPayload<{
      include: {
        occupancies: {
          include: {
            staffProfile: {
              select: {
                id: true;
                fullName: true;
                employeeCode: true;
                department: { select: { id: true; name: true } };
              };
            };
          };
        };
      };
    }>,
  ) {
    return {
      ...this.toQuarterRow(q),
      occupancyHistory: q.occupancies.map((o) => ({
        id: o.id,
        status: o.status,
        staffProfileId: o.staffProfileId,
        staffName: o.staffProfile.fullName,
        employeeCode: o.staffProfile.employeeCode,
        department: o.staffProfile.department?.name ?? null,
        allottedAt: o.allottedAt,
        vacatedAt: o.vacatedAt,
        monthlyRent: Number(o.monthlyRent),
        notes: o.notes,
        vacateNotes: o.vacateNotes,
      })),
    };
  }
}
