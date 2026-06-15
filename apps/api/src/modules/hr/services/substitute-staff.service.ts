import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import {
  CreateSubstituteStaffDto,
  SUBSTITUTE_DOCUMENT_TYPES,
  SubstituteStaffQueryDto,
  UpdateSubstituteStaffDto,
} from '../dto/substitute-staff.dto';

const REASON_LABELS: Record<string, string> = {
  STUDY_LEAVE: 'Study Leave',
  PHD_LEAVE: 'PhD Study Leave',
  MATERNITY_LEAVE: 'Maternity Leave',
  MEDICAL_LEAVE: 'Medical Leave',
  FDP: 'Faculty Development Program',
  RESEARCH_FELLOWSHIP: 'Research Fellowship',
  SABBATICAL: 'Sabbatical Leave',
  DEPUTATION: 'Deputation',
  OTHER: 'Other',
};

@Injectable()
export class SubstituteStaffService {
  constructor(private readonly prisma: PrismaService) {}

  private async nextSubstituteCode(tenantId: string): Promise<string> {
    const count = await this.prisma.substituteStaff.count({
      where: { tenantId },
    });
    return `SUB-${String(count + 1).padStart(4, '0')}`;
  }

  async list(tenantId: string, query: SubstituteStaffQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.SubstituteStaffWhereInput = {
      tenantId,
      deletedAt: null,
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { fullName: { contains: query.search, mode: 'insensitive' } },
              {
                substituteCode: { contains: query.search, mode: 'insensitive' },
              },
              { email: { contains: query.search, mode: 'insensitive' } },
              { mobile: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.substituteStaff.findMany({
        where,
        include: {
          department: { select: { id: true, name: true, code: true } },
          assignments: {
            where: { status: 'ACTIVE' },
            take: 1,
            include: {
              originalStaff: {
                select: { id: true, fullName: true, employeeCode: true },
              },
            },
          },
        },
        orderBy: [{ status: 'asc' }, { fullName: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.substituteStaff.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.toRow(row)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async get(tenantId: string, id: string) {
    const row = await this.prisma.substituteStaff.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        department: { select: { id: true, name: true, code: true } },
        linkedStaffProfile: {
          select: { id: true, fullName: true, employeeCode: true },
        },
        documents: { orderBy: { documentType: 'asc' } },
        assignments: {
          orderBy: { startDate: 'desc' },
          include: {
            originalStaff: {
              select: {
                id: true,
                fullName: true,
                employeeCode: true,
                department: { select: { name: true } },
              },
            },
            department: { select: { id: true, name: true } },
            subjects: true,
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Substitute staff not found');
    return this.toDetail(row);
  }

  async create(user: JwtUser, dto: CreateSubstituteStaffDto) {
    const substituteCode =
      dto.substituteCode?.trim() || (await this.nextSubstituteCode(user.tid));
    const existing = await this.prisma.substituteStaff.findFirst({
      where: { tenantId: user.tid, substituteCode, deletedAt: null },
    });
    if (existing)
      throw new BadRequestException('Substitute code already exists');

    const created = await this.prisma.substituteStaff.create({
      data: {
        tenantId: user.tid,
        substituteCode,
        fullName: dto.fullName.trim(),
        category: dto.category ?? 'REPLACEMENT_FACULTY',
        gender: dto.gender,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        mobile: dto.mobile?.trim(),
        email: dto.email?.trim().toLowerCase(),
        address: dto.address,
        qualification: dto.qualification,
        specialization: dto.specialization,
        departmentId: dto.departmentId,
        joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : new Date(),
        linkedStaffProfileId: dto.linkedStaffProfileId,
        createdById: user.sub,
      },
      include: { department: { select: { id: true, name: true, code: true } } },
    });

    await this.ensureDocumentSlots(user.tid, created.id);
    return this.get(user.tid, created.id);
  }

  async update(user: JwtUser, id: string, dto: UpdateSubstituteStaffDto) {
    const existing = await this.prisma.substituteStaff.findFirst({
      where: { id, tenantId: user.tid, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Substitute staff not found');

    await this.prisma.substituteStaff.update({
      where: { id },
      data: {
        fullName: dto.fullName?.trim(),
        category: dto.category,
        gender: dto.gender,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        mobile: dto.mobile?.trim(),
        email: dto.email?.trim().toLowerCase(),
        address: dto.address,
        qualification: dto.qualification,
        specialization: dto.specialization,
        departmentId: dto.departmentId,
        joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : undefined,
        relievingDate: dto.relievingDate
          ? new Date(dto.relievingDate)
          : undefined,
        status: dto.status,
        linkedStaffProfileId: dto.linkedStaffProfileId,
      },
    });
    return this.get(user.tid, id);
  }

  async ensureDocumentSlots(tenantId: string, substituteStaffId: string) {
    const existing = await this.prisma.substituteStaffDocument.findMany({
      where: { tenantId, substituteStaffId },
      select: { documentType: true },
    });
    const have = new Set(existing.map((row) => row.documentType));
    const missing = SUBSTITUTE_DOCUMENT_TYPES.filter((type) => !have.has(type));
    if (!missing.length) return;
    await this.prisma.substituteStaffDocument.createMany({
      data: missing.map((documentType) => ({
        tenantId,
        substituteStaffId,
        documentType,
        status: 'PENDING',
      })),
    });
  }

  private toRow(
    row: Prisma.SubstituteStaffGetPayload<{
      include: {
        department: { select: { id: true; name: true; code: true } };
        assignments: {
          include: {
            originalStaff: {
              select: { id: true; fullName: true; employeeCode: true };
            };
          };
        };
      };
    }>,
  ) {
    const active = row.assignments[0];
    return {
      id: row.id,
      substituteCode: row.substituteCode,
      fullName: row.fullName,
      category: row.category,
      department: row.department?.name ?? null,
      departmentId: row.departmentId,
      mobile: row.mobile,
      email: row.email,
      status: row.status,
      joiningDate: row.joiningDate,
      currentAssignment: active
        ? {
            id: active.id,
            originalStaffName: active.originalStaff.fullName,
            originalEmployeeCode: active.originalStaff.employeeCode,
            startDate: active.startDate,
            endDate: active.endDate,
            reason: active.reason,
          }
        : null,
    };
  }

  private toDetail(
    row: Prisma.SubstituteStaffGetPayload<{
      include: {
        department: { select: { id: true; name: true; code: true } };
        linkedStaffProfile: {
          select: { id: true; fullName: true; employeeCode: true };
        };
        documents: true;
        assignments: {
          include: {
            originalStaff: {
              select: {
                id: true;
                fullName: true;
                employeeCode: true;
                department: { select: { name: true } };
              };
            };
            department: { select: { id: true; name: true } };
            subjects: true;
          };
        };
      };
    }>,
  ) {
    return {
      ...this.toRow({
        ...row,
        assignments: row.assignments.filter((a) => a.status === 'ACTIVE'),
      }),
      gender: row.gender,
      dateOfBirth: row.dateOfBirth,
      address: row.address,
      qualification: row.qualification,
      specialization: row.specialization,
      photoUrl: row.photoUrl,
      relievingDate: row.relievingDate,
      linkedStaffProfile: row.linkedStaffProfile,
      documents: row.documents,
      assignments: row.assignments.map((a) => ({
        id: a.id,
        assignmentCode: a.assignmentCode,
        reason: a.reason,
        reasonLabel: REASON_LABELS[a.reason] ?? a.reason,
        startDate: a.startDate,
        endDate: a.endDate,
        status: a.status,
        salaryArrangement: a.salaryArrangement,
        monthlyAgreedAmount: a.monthlyAgreedAmount,
        fullWorkloadTransfer: a.fullWorkloadTransfer,
        remarks: a.remarks,
        originalStaff: a.originalStaff,
        department: a.department,
        subjects: a.subjects,
      })),
    };
  }
}
