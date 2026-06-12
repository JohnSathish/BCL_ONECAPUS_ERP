import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import {
  AllotQuarterDto,
  OccupancyHistoryQueryDto,
  VacateQuarterDto,
} from '../dto/accommodation.dto';
import { AccommodationAuditService } from './accommodation-audit.service';

@Injectable()
export class QuarterAllotmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AccommodationAuditService,
  ) {}

  async searchStaff(tenantId: string, q: string) {
    const term = q.trim();
    if (!term) return [];
    return this.prisma.staffProfile.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: 'ACTIVE',
        OR: [
          { fullName: { contains: term, mode: 'insensitive' } },
          { employeeCode: { contains: term, mode: 'insensitive' } },
          { mobile: { contains: term } },
          { id: term.length === 36 ? term : undefined },
        ],
      },
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        mobile: true,
        department: { select: { id: true, name: true } },
        quarterOccupancies: {
          where: { status: 'ACTIVE' },
          take: 1,
          include: { quarter: { select: { code: true, quarterNumber: true } } },
        },
      },
      take: 20,
      orderBy: { fullName: 'asc' },
    });
  }

  listAvailable(tenantId: string) {
    return this.prisma.staffQuarter.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['VACANT', 'RESERVED'] },
      },
      orderBy: [{ block: 'asc' }, { quarterNumber: 'asc' }],
    });
  }

  async allot(user: JwtUser, dto: AllotQuarterDto) {
    const [staff, quarter] = await Promise.all([
      this.prisma.staffProfile.findFirst({
        where: { id: dto.staffProfileId, tenantId: user.tid, deletedAt: null },
      }),
      this.prisma.staffQuarter.findFirst({
        where: { id: dto.quarterId, tenantId: user.tid, deletedAt: null },
      }),
    ]);
    if (!staff) throw new NotFoundException('Staff member not found');
    if (!quarter) throw new NotFoundException('Quarter not found');
    if (quarter.status === 'OCCUPIED')
      throw new BadRequestException('Quarter is already occupied');
    if (quarter.status === 'MAINTENANCE')
      throw new BadRequestException('Quarter is under maintenance');

    const existingStaff = await this.prisma.quarterOccupancy.findFirst({
      where: {
        tenantId: user.tid,
        staffProfileId: dto.staffProfileId,
        status: 'ACTIVE',
      },
    });
    if (existingStaff)
      throw new BadRequestException(
        'Staff member already has an active quarter allotment',
      );

    const occupancy = await this.prisma.$transaction(async (tx) => {
      const occ = await tx.quarterOccupancy.create({
        data: {
          tenantId: user.tid,
          quarterId: dto.quarterId,
          staffProfileId: dto.staffProfileId,
          status: 'ACTIVE',
          allottedAt: new Date(dto.allottedAt),
          monthlyRent: dto.monthlyRent ?? quarter.monthlyRent,
          waterCharge: dto.waterCharge ?? quarter.waterCharge,
          electricityCharge: dto.electricityCharge ?? quarter.electricityCharge,
          maintenanceCharge: dto.maintenanceCharge ?? quarter.maintenanceCharge,
          internetCharge: dto.internetCharge ?? quarter.internetCharge,
          payrollDeductionEnabled: dto.payrollDeductionEnabled ?? true,
          notes: dto.notes?.trim() || null,
          createdById: user.sub,
        },
        include: {
          quarter: true,
          staffProfile: { select: { fullName: true, employeeCode: true } },
        },
      });
      await tx.staffQuarter.update({
        where: { id: dto.quarterId },
        data: { status: 'OCCUPIED' },
      });
      return occ;
    });

    await this.audit.log(
      user.tid,
      'OCCUPANCY',
      occupancy.id,
      'QUARTER_ALLOCATED',
      user.sub,
      null,
      occupancy,
    );
    return occupancy;
  }

  async vacate(user: JwtUser, occupancyId: string, dto: VacateQuarterDto) {
    const occupancy = await this.prisma.quarterOccupancy.findFirst({
      where: { id: occupancyId, tenantId: user.tid, status: 'ACTIVE' },
      include: { quarter: true },
    });
    if (!occupancy) throw new NotFoundException('Active occupancy not found');

    const updated = await this.prisma.$transaction(async (tx) => {
      const occ = await tx.quarterOccupancy.update({
        where: { id: occupancyId },
        data: {
          status: 'COMPLETED',
          vacatedAt: new Date(dto.vacatedAt),
          finalMeterReading: dto.finalMeterReading?.trim() || null,
          finalCharges: dto.finalCharges ?? null,
          vacateNotes: dto.remarks?.trim() || null,
          vacatedById: user.sub,
          payrollDeductionEnabled: false,
        },
        include: {
          quarter: true,
          staffProfile: { select: { fullName: true, employeeCode: true } },
        },
      });
      await tx.staffQuarter.update({
        where: { id: occupancy.quarterId },
        data: { status: 'VACANT' },
      });
      return occ;
    });

    await this.audit.log(
      user.tid,
      'OCCUPANCY',
      occupancyId,
      'QUARTER_VACATED',
      user.sub,
      occupancy,
      updated,
    );
    return updated;
  }

  async history(tenantId: string, query: OccupancyHistoryQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where = {
      tenantId,
      ...(query.quarterId ? { quarterId: query.quarterId } : {}),
      ...(query.staffProfileId ? { staffProfileId: query.staffProfileId } : {}),
      ...(query.search
        ? {
            OR: [
              {
                staffProfile: {
                  fullName: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
              },
              {
                staffProfile: {
                  employeeCode: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
              },
              {
                quarter: {
                  code: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
              },
              {
                quarter: {
                  quarterNumber: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
              },
            ],
          }
        : {}),
      ...(query.departmentId
        ? { staffProfile: { departmentId: query.departmentId } }
        : {}),
      ...(query.status
        ? { status: query.status === 'ACTIVE' ? 'ACTIVE' : 'COMPLETED' }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.quarterOccupancy.findMany({
        where,
        include: {
          quarter: {
            select: {
              id: true,
              code: true,
              quarterNumber: true,
              quarterType: true,
              block: true,
            },
          },
          staffProfile: {
            select: {
              id: true,
              fullName: true,
              employeeCode: true,
              department: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ allottedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.quarterOccupancy.count({ where }),
    ]);

    return {
      data: data.map((o) => ({
        id: o.id,
        status: o.status,
        quarter: o.quarter,
        staffProfile: o.staffProfile,
        allottedAt: o.allottedAt,
        vacatedAt: o.vacatedAt,
        monthlyRent: Number(o.monthlyRent),
        waterCharge: Number(o.waterCharge),
        electricityCharge: Number(o.electricityCharge),
        maintenanceCharge: Number(o.maintenanceCharge),
        internetCharge: Number(o.internetCharge),
        payrollDeductionEnabled: o.payrollDeductionEnabled,
        notes: o.notes,
        vacateNotes: o.vacateNotes,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getStaffAccommodation(tenantId: string, staffProfileId: string) {
    const active = await this.prisma.quarterOccupancy.findFirst({
      where: { tenantId, staffProfileId, status: 'ACTIVE' },
      include: { quarter: true },
    });
    const history = await this.prisma.quarterOccupancy.findMany({
      where: { tenantId, staffProfileId },
      include: {
        quarter: {
          select: {
            code: true,
            quarterNumber: true,
            quarterType: true,
            block: true,
          },
        },
      },
      orderBy: { allottedAt: 'desc' },
    });
    return {
      status: active ? 'OCCUPIED' : 'NONE',
      active: active
        ? {
            occupancyId: active.id,
            quarterNumber: active.quarter.code,
            quarterType: active.quarter.quarterType,
            building: active.quarter.block,
            allottedAt: active.allottedAt,
            monthlyRent: Number(active.monthlyRent),
            waterCharge: Number(active.waterCharge),
            electricityCharge: Number(active.electricityCharge),
            maintenanceCharge: Number(active.maintenanceCharge),
            internetCharge: Number(active.internetCharge),
            payrollDeductionEnabled: active.payrollDeductionEnabled,
          }
        : null,
      history: history.map((h) => ({
        id: h.id,
        status: h.status,
        quarterNumber: h.quarter.code,
        quarterType: h.quarter.quarterType,
        building: h.quarter.block,
        allottedAt: h.allottedAt,
        vacatedAt: h.vacatedAt,
        monthlyRent: Number(h.monthlyRent),
      })),
    };
  }
}
