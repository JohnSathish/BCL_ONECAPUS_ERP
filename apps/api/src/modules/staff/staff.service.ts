import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '@prisma/client';

import type { JwtUser } from '../../common/decorators/current-user.decorator';

import { paginate } from '../../common/dto/pagination.dto';

import { ShiftScopeService } from '../../common/services/shift-scope.service';

import { PrismaService } from '../../database/prisma.service';
import {
  assertBiometricIdUnique,
  normalizeBiometricId,
} from './utils/staff-biometric.util';

import type {
  CreateStaffDto,
  GenerateEmployeeCodeDto,
  StaffDirectoryQueryDto,
  UpdateStaffDto,
} from './dto/staff.dto';

import { EmployeeCodeService } from './services/employee-code.service';
import { StaffEmploymentService } from './services/staff-employment.service';
import { allowedDesignationCategories } from './services/staff-employment-rules';

import { StaffProfileService } from './services/staff-profile.service';

import { StaffProvisioningService } from './services/staff-provisioning.service';
import { LicenseEnforcementService } from '../licensing/services/license-enforcement.service';

const directoryInclude = {
  department: { select: { id: true, code: true, name: true } },

  designation: { select: { id: true, code: true, label: true } },

  primaryShift: { select: { id: true, code: true, name: true } },

  additionalRoles: {
    where: { active: true },

    select: { roleCode: true, roleName: true, active: true },
  },

  portalUser: {
    select: {
      id: true,

      email: true,

      isActive: true,

      accountStatus: true,

      mustResetPassword: true,
    },
  },

  _count: {
    select: {
      subjectAssignments: true,

      offeringSections: true,

      publications: true,
    },
  },

  quarterOccupancies: {
    where: { status: 'ACTIVE' },
    take: 1,
    include: { quarter: { select: { code: true, quarterNumber: true } } },
  },
} satisfies Prisma.StaffProfileInclude;

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,

    private readonly shiftScope: ShiftScopeService,

    private readonly profileService: StaffProfileService,

    private readonly provisioning: StaffProvisioningService,

    private readonly employment: StaffEmploymentService,

    private readonly employeeCodes: EmployeeCodeService,

    private readonly licenseEnforcement: LicenseEnforcementService,
  ) {}

  async listDirectory(user: JwtUser, query: StaffDirectoryQueryDto) {
    const tenantId = user.tid;

    const scope = this.shiftScope.resolveScope(user, query.shiftId);

    const page = query.page ?? 1;

    const limit = query.limit ?? 20;

    const ids = query.ids?.split(',').filter(Boolean);

    const terminalStatuses = ['RELIEVED', 'RETIRED', 'CONTRACT_ENDED'];

    let where: Prisma.StaffProfileWhereInput = {
      tenantId,

      deletedAt: null,

      ...(ids?.length ? { id: { in: ids } } : {}),

      ...(query.staffType ? { staffType: query.staffType } : {}),

      ...(query.departmentId ? { departmentId: query.departmentId } : {}),

      ...(query.designationId ? { designationId: query.designationId } : {}),

      ...(query.status
        ? { status: query.status }
        : { status: { notIn: terminalStatuses } }),

      ...(query.activeTeachingOnly
        ? { staffType: 'TEACHING', status: 'ACTIVE' }
        : {}),

      ...(query.additionalRoleCode
        ? {
            additionalRoles: {
              some: { roleCode: query.additionalRoleCode, active: true },
            },
          }
        : {}),

      ...(query.hodOnly
        ? {
            additionalRoles: {
              some: { roleCode: 'HOD', active: true },
            },
          }
        : {}),

      ...(query.hasPublications ? { publications: { some: {} } } : {}),
    };

    if (query.shiftId) {
      where = {
        ...where,
        AND: [
          ...(Array.isArray(where.AND)
            ? where.AND
            : where.AND
              ? [where.AND]
              : []),
          {
            OR: [
              { primaryShiftId: query.shiftId },
              {
                shiftAssignments: {
                  some: { shiftId: query.shiftId, active: true },
                },
              },
            ],
          },
        ],
      };
    }

    if (query.search) {
      const searchOr: Prisma.StaffProfileWhereInput[] = [
        { employeeCode: { contains: query.search, mode: 'insensitive' } },
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { mobile: { contains: query.search, mode: 'insensitive' } },
        { rfidNo: { contains: query.search, mode: 'insensitive' } },
        { shortCode: { contains: query.search, mode: 'insensitive' } },
        {
          department: {
            name: { contains: query.search, mode: 'insensitive' },
          },
        },
        {
          portalUser: {
            email: { contains: query.search, mode: 'insensitive' },
          },
        },
      ];
      where = {
        ...where,
        AND: [
          ...(Array.isArray(where.AND)
            ? where.AND
            : where.AND
              ? [where.AND]
              : []),
          { OR: searchOr },
        ],
      };
    }

    if (!query.shiftId) {
      where = this.shiftScope.applyPrimaryShiftWhere(where, scope);
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.staffProfile.count({ where }),

      this.prisma.staffProfile.findMany({
        where,

        include: directoryInclude,

        orderBy: [{ employeeCode: 'asc' }],

        skip: (page - 1) * limit,

        take: limit,
      }),
    ]);

    const data = rows.map((row) => this.profileService.toDirectoryRow(row));

    return paginate(data, total, page, limit);
  }

  async getOne(user: JwtUser, id: string) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { id, tenantId: user.tid, deletedAt: null },

      include: this.provisioning.defaultInclude(),
    });

    if (!staff) throw new NotFoundException('Staff member not found');

    const scope = this.shiftScope.resolveScope(user);

    if (
      !scope.allShifts &&
      staff.primaryShiftId &&
      !scope.shiftIds.includes(staff.primaryShiftId) &&
      scope.activeShiftId !== staff.primaryShiftId
    ) {
      throw new ForbiddenException('Shift access denied');
    }

    return staff;
  }

  async generateEmployeeCode(
    tenantId: string,
    dto: GenerateEmployeeCodeDto,
    actorId?: string,
  ) {
    if (dto.staffProfileId) {
      const check = await this.employeeCodes.canRegenerateForStaff(
        tenantId,
        dto.staffProfileId,
        dto.staffType,
      );
      if (!check.allowed) {
        throw new ConflictException(
          check.reason ?? 'Employee code cannot be regenerated',
        );
      }
    }

    if (dto.preview !== false) {
      return this.employeeCodes.previewNextEmployeeCode(tenantId, {
        institutionId: dto.institutionId,
        staffType: dto.staffType,
        joiningDate: dto.joiningDate,
      });
    }

    return this.employeeCodes.allocateNextEmployeeCode(tenantId, {
      institutionId: dto.institutionId,
      staffType: dto.staffType,
      joiningDate: dto.joiningDate,
      staffProfileId: dto.staffProfileId,
      actorId,
      action: dto.staffProfileId ? 'REGENERATE' : 'ALLOCATE',
    });
  }

  async create(user: JwtUser, dto: CreateStaffDto) {
    await this.licenseEnforcement.assertWriteAllowed(user.tid, 'staff.create');

    const result = await this.provisioning.create(user.tid, dto, user.sub);

    if (
      dto.additionalRoleCodes?.length ||
      dto.additionalShiftIds?.length ||
      dto.shortCode
    ) {
      await this.employment.applyEmploymentUpdate(user.tid, result.staff.id, {
        additionalRoleCodes: dto.additionalRoleCodes,

        additionalShiftIds: dto.additionalShiftIds,

        shortCode: dto.shortCode,
      });
    }

    const refreshed = await this.prisma.staffProfile.findFirst({
      where: { id: result.staff.id },

      include: this.provisioning.defaultInclude(),
    });

    return {
      ...refreshed,

      generatedPassword: result.generatedPassword,
    };
  }

  async update(tenantId: string, id: string, dto: UpdateStaffDto) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!staff) throw new NotFoundException('Staff member not found');

    if (dto.employeeCode && dto.employeeCode !== staff.employeeCode) {
      const taken = await this.prisma.staffProfile.findFirst({
        where: {
          tenantId,

          employeeCode: dto.employeeCode.trim(),

          deletedAt: null,

          NOT: { id },
        },
      });

      if (taken) throw new ConflictException('Employee code already in use');
    }

    if (dto.rfidNo && dto.rfidNo !== staff.rfidNo) {
      const rfidTaken = await this.prisma.staffProfile.findFirst({
        where: {
          tenantId,

          rfidNo: dto.rfidNo.trim(),

          deletedAt: null,

          NOT: { id },
        },
      });

      if (rfidTaken) throw new ConflictException('RFID number already in use');
    }

    const nextBiometricId =
      dto.biometricId === null
        ? null
        : normalizeBiometricId(dto.biometricId ?? undefined);
    if (nextBiometricId && nextBiometricId !== staff.biometricId) {
      await assertBiometricIdUnique(this.prisma, tenantId, nextBiometricId, {
        campusId: staff.campusId,
        departmentId: staff.departmentId,
        primaryShiftId: staff.primaryShiftId,
        excludeStaffId: id,
      });
    }

    const hasEmploymentFields =
      dto.departmentId !== undefined ||
      dto.designationId !== undefined ||
      dto.primaryShiftId !== undefined ||
      dto.additionalShiftIds !== undefined ||
      dto.additionalRoleCodes !== undefined ||
      dto.shortCode !== undefined ||
      dto.probationEndDate !== undefined ||
      dto.confirmationDate !== undefined ||
      dto.relievingDate !== undefined ||
      dto.retirementDate !== undefined ||
      dto.lastWorkingDate !== undefined ||
      dto.resignationReason !== undefined;

    if (hasEmploymentFields) {
      await this.employment.applyEmploymentUpdate(tenantId, id, {
        departmentId: dto.departmentId,

        designationId: dto.designationId,

        primaryShiftId: dto.primaryShiftId,

        additionalShiftIds: dto.additionalShiftIds,

        additionalRoleCodes: dto.additionalRoleCodes,

        shortCode: dto.shortCode,

        staffType: dto.staffType,

        employmentType: dto.employmentType,

        status: dto.status,

        joiningDate: dto.joiningDate,

        probationEndDate: dto.probationEndDate,

        confirmationDate: dto.confirmationDate,

        relievingDate: dto.relievingDate,

        retirementDate: dto.retirementDate,

        lastWorkingDate: dto.lastWorkingDate,

        resignationReason: dto.resignationReason,
      });
    }

    const basicUpdate: Prisma.StaffProfileUpdateInput = {
      employeeCode: dto.employeeCode?.trim(),
      fullName: dto.fullName?.trim(),
      email: dto.email?.trim().toLowerCase(),
      mobile: dto.mobile?.trim(),
      rfidNo: dto.rfidNo === null ? null : dto.rfidNo?.trim(),
      ...(dto.biometricId !== undefined
        ? { biometricId: dto.biometricId === null ? null : nextBiometricId }
        : {}),
    };

    if (!hasEmploymentFields) {
      Object.assign(basicUpdate, {
        staffType: dto.staffType,
        employmentType: dto.employmentType,
        departmentId: dto.departmentId,
        designationId: dto.designationId,
        primaryShiftId: dto.primaryShiftId,
        status: dto.status,
        joiningDate:
          dto.joiningDate === null
            ? null
            : dto.joiningDate
              ? new Date(dto.joiningDate)
              : undefined,
      });
    }

    return this.prisma.staffProfile.update({
      where: { id },
      data: basicUpdate,
      include: this.provisioning.defaultInclude(),
    });
  }

  async deactivate(tenantId: string, id: string) {
    return this.provisioning.deactivate(tenantId, id);
  }

  async exportCsv(user: JwtUser, query: StaffDirectoryQueryDto) {
    const result = await this.listDirectory(user, {
      ...query,

      page: 1,

      limit: 10_000,
    });

    const header = [
      'ID',

      'Employee Code',

      'Short Code',

      'Name',

      'Email',

      'Mobile',

      'Staff Type',

      'Employment Type',

      'Department',

      'Designation',

      'Additional Roles',

      'Shift',

      'Status',

      'RFID',

      'Portal Active',
    ];

    const lines = [header.join(',')];

    for (const row of result.data) {
      const roles = (row.additionalRoles ?? []).map((r) => r.label).join('; ');

      lines.push(
        [
          row.id,

          row.employeeCode,

          row.shortCode ?? '',

          `"${(row.fullName ?? '').replace(/"/g, '""')}"`,

          row.email ?? '',

          row.mobile ?? '',

          row.staffType,

          row.employmentType,

          row.department ?? '',

          row.designation ?? '',

          `"${roles.replace(/"/g, '""')}"`,

          row.shift ?? '',

          row.status,

          row.rfidNo ?? '',

          row.portalActive ? 'yes' : 'no',
        ].join(','),
      );
    }

    const truncated = result.meta.total > 10_000;

    return {
      csv: lines.join('\n'),

      rowCount: result.data.length,

      total: result.meta.total,

      truncated,
    };
  }

  async listDesignations(tenantId: string, staffType?: string) {
    const categories = staffType
      ? allowedDesignationCategories(staffType)
      : undefined;

    return this.prisma.designation.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(categories?.length ? { category: { in: categories } } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      select: {
        id: true,
        code: true,
        label: true,
        category: true,
        sortOrder: true,
      },
    });
  }

  listAcademicRoles(tenantId: string) {
    return this.employment.listAcademicRoles(tenantId);
  }
}
