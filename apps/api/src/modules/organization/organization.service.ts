import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { UpsertAcademicSettingsDto } from './dto/academic-settings.dto';
import { DEFAULT_SHARED_POOL_SECTION_CAPACITY } from '../../common/constants/academic-capacity';
import {
  CreateAcademicYearDto,
  CreateCampusDto,
  CreateDepartmentDto,
  CreateInstitutionDto,
  CreateSemesterDto,
  DEPARTMENT_STATUSES,
  DEPARTMENT_TYPES,
  UpdateDepartmentDto,
} from './dto/organization.dto';
import {
  type DepartmentGroup,
  isAcademicDepartment,
  resolveDepartmentListFilter,
} from './department-rules';

const DEFAULT_NEP_PROFILE = {
  multipleEntryExit: true,
  abcEnabled: true,
  interdisciplinaryEnabled: true,
  skillCoursesRequired: true,
};

const DEFAULT_CREDIT_POLICY = {
  minCreditsPerSemester: 18,
  maxCreditsPerSemester: 26,
  minCreditsForDegree: 160,
  gradePointScale: 10,
  defaultSharedPoolCapacity: DEFAULT_SHARED_POOL_SECTION_CAPACITY,
};

const departmentInclude = {
  institution: { select: { id: true, name: true, code: true } },
  campus: { select: { id: true, name: true, code: true } },
  hod: {
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      portalUser: { select: { id: true, email: true } },
    },
  },
} satisfies Prisma.DepartmentInclude;

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeCode(code: string) {
    return code.trim().toUpperCase();
  }

  private async assertDepartmentUniqueness(
    tenantId: string,
    institutionId: string,
    name: string,
    code: string,
    excludeId?: string,
  ) {
    const codeConflict = await this.prisma.department.findFirst({
      where: {
        tenantId,
        code,
        deletedAt: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (codeConflict) {
      throw new ConflictException(`Department code "${code}" already exists`);
    }

    const nameConflict = await this.prisma.department.findFirst({
      where: {
        institutionId,
        name,
        deletedAt: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (nameConflict) {
      throw new ConflictException(
        `Department name "${name}" already exists for this institution`,
      );
    }
  }

  private async resolveCampusInstitution(
    tenantId: string,
    institutionId: string,
    campusId?: string,
  ) {
    const institution = await this.prisma.institution.findFirst({
      where: { id: institutionId, tenantId, deletedAt: null },
    });
    if (!institution) throw new NotFoundException('Institution not found');

    if (!campusId) return institution;

    const campus = await this.prisma.campus.findFirst({
      where: { id: campusId, tenantId, institutionId, deletedAt: null },
    });
    if (!campus) {
      throw new BadRequestException(
        'Campus does not belong to the selected institution',
      );
    }
    return institution;
  }

  private async assertHod(tenantId: string, hodId?: string | null) {
    if (!hodId) return;
    const staff = await this.prisma.staffProfile.findFirst({
      where: { id: hodId, tenantId, deletedAt: null, staffType: 'TEACHING' },
    });
    if (!staff)
      throw new NotFoundException('Head of department (faculty) not found');
  }

  listInstitutions(tenantId: string) {
    return this.prisma.institution.findMany({
      where: { tenantId, deletedAt: null },
      include: { campuses: { where: { deletedAt: null } } },
      orderBy: { name: 'asc' },
    });
  }

  createInstitution(tenantId: string, dto: CreateInstitutionDto) {
    return this.prisma.institution.create({
      data: { tenantId, name: dto.name, code: dto.code },
    });
  }

  listCampuses(tenantId: string, institutionId?: string) {
    return this.prisma.campus.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(institutionId ? { institutionId } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  createCampus(tenantId: string, dto: CreateCampusDto) {
    return this.prisma.campus.create({
      data: {
        tenantId,
        institutionId: dto.institutionId,
        name: dto.name,
        code: dto.code,
      },
    });
  }

  listDepartments(
    tenantId: string,
    filters?: {
      campusId?: string;
      institutionId?: string;
      status?: string;
      type?: DepartmentGroup;
      departmentType?: string;
    },
  ) {
    return this.prisma.department.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(filters?.campusId ? { campusId: filters.campusId } : {}),
        ...(filters?.institutionId
          ? { institutionId: filters.institutionId }
          : {}),
        ...(filters?.status ? { status: filters.status } : {}),
        ...resolveDepartmentListFilter({
          type: filters?.type,
          departmentType: filters?.departmentType,
        }),
      },
      include: departmentInclude,
      orderBy: [{ code: 'asc' }],
    });
  }

  async assertAcademicDepartment(tenantId: string, departmentId: string) {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, tenantId, deletedAt: null },
      select: { id: true, departmentType: true, name: true },
    });
    if (!department) {
      throw new BadRequestException('Invalid department');
    }
    if (!isAcademicDepartment(department.departmentType)) {
      throw new BadRequestException(
        'Students must be assigned to an academic department, not an administrative unit',
      );
    }
    return department;
  }

  async getDepartment(tenantId: string, id: string) {
    const row = await this.prisma.department.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: departmentInclude,
    });
    if (!row) throw new NotFoundException('Department not found');
    return row;
  }

  async createDepartment(tenantId: string, dto: CreateDepartmentDto) {
    const code = this.normalizeCode(dto.code);
    const name = dto.name.trim();
    const departmentType = dto.departmentType ?? 'ACADEMIC';
    const status = dto.status ?? 'ACTIVE';

    if (
      !DEPARTMENT_TYPES.includes(
        departmentType as (typeof DEPARTMENT_TYPES)[number],
      )
    ) {
      throw new BadRequestException('Invalid department type');
    }
    if (
      !DEPARTMENT_STATUSES.includes(
        status as (typeof DEPARTMENT_STATUSES)[number],
      )
    ) {
      throw new BadRequestException('Invalid department status');
    }

    await this.resolveCampusInstitution(
      tenantId,
      dto.institutionId,
      dto.campusId,
    );
    await this.assertDepartmentUniqueness(
      tenantId,
      dto.institutionId,
      name,
      code,
    );
    await this.assertHod(tenantId, dto.hodId);

    return this.prisma.department.create({
      data: {
        tenantId,
        institutionId: dto.institutionId,
        campusId: dto.campusId,
        name,
        code,
        departmentType,
        hodId: dto.hodId,
        status,
      },
      include: departmentInclude,
    });
  }

  async updateDepartment(
    tenantId: string,
    id: string,
    dto: UpdateDepartmentDto,
  ) {
    const existing = await this.prisma.department.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Department not found');

    const name = dto.name?.trim() ?? existing.name;
    const code = dto.code ? this.normalizeCode(dto.code) : existing.code;
    const campusId =
      dto.campusId === undefined ? existing.campusId : dto.campusId;

    if (campusId) {
      await this.resolveCampusInstitution(
        tenantId,
        existing.institutionId,
        campusId,
      );
    }
    await this.assertDepartmentUniqueness(
      tenantId,
      existing.institutionId,
      name,
      code,
      id,
    );
    await this.assertHod(tenantId, dto.hodId);

    if (
      dto.departmentType &&
      !DEPARTMENT_TYPES.includes(dto.departmentType as never)
    ) {
      throw new BadRequestException('Invalid department type');
    }
    if (dto.status && !DEPARTMENT_STATUSES.includes(dto.status as never)) {
      throw new BadRequestException('Invalid department status');
    }

    return this.prisma.department.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name } : {}),
        ...(dto.code !== undefined ? { code } : {}),
        ...(dto.campusId !== undefined ? { campusId: dto.campusId } : {}),
        ...(dto.departmentType !== undefined
          ? { departmentType: dto.departmentType }
          : {}),
        ...(dto.hodId !== undefined ? { hodId: dto.hodId } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: departmentInclude,
    });
  }

  listFacultyForHod(tenantId: string, departmentId?: string) {
    return this.prisma.staffProfile
      .findMany({
        where: {
          tenantId,
          deletedAt: null,
          staffType: 'TEACHING',
          ...(departmentId ? { departmentId } : {}),
        },
        select: {
          id: true,
          employeeCode: true,
          fullName: true,
          departmentId: true,
          portalUser: { select: { email: true } },
        },
        orderBy: { employeeCode: 'asc' },
      })
      .then((rows) =>
        rows.map((row) => ({
          ...row,
          user: row.portalUser,
        })),
      );
  }

  listAcademicYears(tenantId: string) {
    return this.prisma.academicYear.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        semesters: { where: { deletedAt: null }, orderBy: { sequence: 'asc' } },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async createAcademicYear(tenantId: string, dto: CreateAcademicYearDto) {
    let institutionId = dto.institutionId;
    if (!institutionId) {
      const inst = await this.prisma.institution.findFirst({
        where: { tenantId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      });
      if (!inst) {
        throw new BadRequestException(
          'Create an institution before academic years',
        );
      }
      institutionId = inst.id;
    }
    return this.prisma.academicYear.create({
      data: {
        tenantId,
        institutionId,
        name: dto.name,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      },
    });
  }

  async createSemester(tenantId: string, dto: CreateSemesterDto) {
    const ay = await this.prisma.academicYear.findFirst({
      where: { id: dto.academicYearId, tenantId, deletedAt: null },
    });
    if (!ay) throw new NotFoundException('Academic year not found');

    const sequence = dto.sequence ?? 1;
    const semesterNumber = sequence;
    const semesterType = semesterNumber % 2 === 1 ? 'ODD' : 'EVEN';

    return this.prisma.semester.create({
      data: {
        tenantId,
        institutionId: ay.institutionId,
        academicYearId: dto.academicYearId,
        name: dto.name,
        sequence,
        semesterNumber,
        semesterType,
        progressionOrder: semesterNumber,
        academicYearIndex: ay.academicYearIndex ?? 1,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }

  async getAcademicSettings(tenantId: string) {
    const existing = await this.prisma.tenantAcademicSettings.findUnique({
      where: { tenantId },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.tenantAcademicSettings.create({
      data: {
        tenantId,
        cbcsEnabled: true,
        nepProfile: DEFAULT_NEP_PROFILE,
        creditPolicy: DEFAULT_CREDIT_POLICY,
      },
    });
  }

  async upsertAcademicSettings(
    tenantId: string,
    dto: UpsertAcademicSettingsDto,
  ) {
    const current = await this.getAcademicSettings(tenantId);

    const nepProfile = {
      ...(current.nepProfile as Prisma.JsonObject),
      ...(dto.nepProfile ?? {}),
    };

    const creditPolicy = {
      ...(current.creditPolicy as Prisma.JsonObject),
      ...(dto.creditPolicy ?? {}),
    };

    return this.prisma.tenantAcademicSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        cbcsEnabled: dto.cbcsEnabled ?? true,
        nepProfile,
        creditPolicy,
      },
      update: {
        cbcsEnabled: dto.cbcsEnabled ?? current.cbcsEnabled,
        nepProfile,
        creditPolicy,
      },
    });
  }

  async getSetupSummary(tenantId: string) {
    const [institutions, departments, academicYears, settings] =
      await Promise.all([
        this.prisma.institution.count({ where: { tenantId, deletedAt: null } }),
        this.prisma.department.count({ where: { tenantId, deletedAt: null } }),
        this.prisma.academicYear.count({
          where: { tenantId, deletedAt: null },
        }),
        this.getAcademicSettings(tenantId),
      ]);

    const campuses = await this.prisma.campus.count({
      where: { tenantId, deletedAt: null },
    });

    const semesters = await this.prisma.semester.count({
      where: { tenantId, deletedAt: null },
    });

    return {
      institutions,
      campuses,
      departments,
      academicYears,
      semesters,
      cbcsEnabled: settings.cbcsEnabled,
    };
  }

  async softDeleteInstitution(tenantId: string, id: string) {
    const row = await this.prisma.institution.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Institution not found');
    return this.prisma.institution.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async softDeleteCampus(tenantId: string, id: string) {
    const row = await this.prisma.campus.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Campus not found');
    return this.prisma.campus.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async softDeleteDepartment(tenantId: string, id: string) {
    const row = await this.prisma.department.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Department not found');
    return this.prisma.department.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
