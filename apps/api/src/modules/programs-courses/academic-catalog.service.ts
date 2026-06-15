import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { OfferingSectionStreamsService } from '../../common/services/offering-section-streams.service';
import { ShiftScopeService } from '../../common/services/shift-scope.service';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../shared/cache/cache.service';
import { paginate, PaginationQueryDto } from '../../common/dto/pagination.dto';
import type { CourseListQueryDto } from './dto/course-list-query.dto';
import { isAcademicDepartment } from '../organization/department-rules';
import {
  CBCS_COURSE_TYPES,
  isNepCurriculumCategory,
  NEP_CATEGORY_ON_MASTER_MESSAGE,
} from '../../common/constants/academic-categories';
import {
  isCourseDeliveryType,
  normalizeCourseDeliveryInput,
  type AttendanceMode,
  type CourseDeliveryType,
  type CreditCalculationMode,
} from '../../common/constants/course-delivery';
import { courseDeliveryDefaultsFromCredits } from '../../common/services/course-delivery-fee.service';
import { normalizeCourseEligibilityRules } from '../academic-engine/domain/course-eligibility.engine';
import {
  computeTotalContactHours,
  validateCourseAcademicStructure,
} from '../../common/services/course-academic-structure.validator';
import { assertProgrammeCodeNotCourseLike } from '../../common/validation/program-code.validation';
import { resolveVtcTrackFields } from '../../common/services/vtc-track-metadata';
import type {
  CreateCourseDto,
  CreateCourseOfferingDto,
  CreateProgramDto,
  CreateProgramVersionDto,
  UpdateCourseDto,
  UpdateCourseOfferingDto,
  UpdateOfferingSectionDto,
  UpdateProgramDto,
} from './dto/programs-courses.dto';

export const programVersionSummarySelect = {
  id: true,
  programId: true,
  version: true,
  status: true,
  cbcsEnabled: true,
  effectiveFrom: true,
  publishedAt: true,
  archivedAt: true,
  createdAt: true,
  createdById: true,
  createdBy: { select: { id: true, email: true } },
} as const;

export const programInclude = {
  department: { select: { id: true, name: true, code: true } },
  versions: {
    where: { deletedAt: null },
    orderBy: { version: 'desc' as const },
    select: programVersionSummarySelect,
  },
} satisfies Prisma.ProgramInclude;

export const offeringIncludeBasic = {
  course: true,
  semester: true,
  programVersion: { include: { program: true } },
} satisfies Prisma.CourseOfferingInclude;

export const courseInclude = {
  department: { select: { id: true, name: true, code: true } },
} satisfies Prisma.CourseInclude;

const courseListOfferingInclude = {
  where: { deletedAt: null },
  orderBy: [{ semesterSequence: 'asc' as const }, { category: 'asc' as const }],
  take: 8,
  select: {
    category: true,
    semesterSequence: true,
    programVersion: {
      select: {
        version: true,
        program: { select: { code: true, name: true } },
      },
    },
  },
} satisfies Prisma.CourseInclude['offerings'];

export type CourseMappingSummary = {
  programCode: string;
  programName: string;
  version: number;
  category: string | null;
  semesterSequence: number | null;
};

const MAPPING_SUMMARY_CAP = 8;

export const sectionStreamInclude = {
  eligibleStreams: {
    include: {
      stream: { select: { id: true, code: true, name: true } },
    },
  },
} satisfies Prisma.OfferingSectionInclude;

export const offeringIncludeWithSections = {
  course: true,
  semester: true,
  programVersion: { include: { program: true } },
  sections: {
    where: { deletedAt: null, status: 'active' },
    include: {
      shift: true,
      seatLedger: true,
      staffProfile: {
        select: {
          id: true,
          employeeCode: true,
          fullName: true,
          portalUser: { select: { email: true } },
        },
      },
      classroom: true,
      ...sectionStreamInclude,
    },
  },
} satisfies Prisma.CourseOfferingInclude;

@Injectable()
export class AcademicCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shiftScope: ShiftScopeService,
    private readonly sectionStreams: OfferingSectionStreamsService,
    private readonly cache: CacheService,
  ) {}

  private normalizeCode(code: string) {
    return code.trim().toUpperCase();
  }

  private resolveVtcFieldsForCourse(
    code: string,
    title: string,
    dto: { vtcTrackGroupCode?: string | null; vtcTrackStage?: number | null },
    existing?: {
      vtcTrackGroupCode: string | null;
      vtcTrackStage: number | null;
    },
  ) {
    const isVtcLike = code.toUpperCase().startsWith('VTC');
    if (
      !isVtcLike &&
      dto.vtcTrackGroupCode == null &&
      dto.vtcTrackStage == null &&
      !existing?.vtcTrackGroupCode
    ) {
      return {};
    }
    const resolved = resolveVtcTrackFields({
      code,
      title,
      vtcTrackGroupCode:
        dto.vtcTrackGroupCode !== undefined
          ? dto.vtcTrackGroupCode
          : existing?.vtcTrackGroupCode,
      vtcTrackStage:
        dto.vtcTrackStage !== undefined
          ? dto.vtcTrackStage
          : existing?.vtcTrackStage,
    });
    return {
      vtcTrackGroupCode: resolved.vtcTrackGroupCode,
      vtcTrackStage: resolved.vtcTrackStage,
    };
  }

  private normalizeCurriculumCategory(category: string) {
    return category.trim().toUpperCase();
  }

  private assertCbcsCourseType(courseType: string) {
    const normalized = courseType.trim().toUpperCase();
    // CBCS types overlap NEP labels (e.g. ELECTIVE) — allow listed catalog types first.
    if ((CBCS_COURSE_TYPES as readonly string[]).includes(normalized)) {
      return;
    }
    if (isNepCurriculumCategory(normalized)) {
      throw new BadRequestException(NEP_CATEGORY_ON_MASTER_MESSAGE);
    }
  }

  private throwCourseCodeConflict(code: string, existingTitle: string): never {
    throw new HttpException(
      {
        statusCode: HttpStatus.CONFLICT,
        message: `A course with code "${code}" already exists.`,
        fieldErrors: {
          code: `This course code is already in use (existing: ${existingTitle}).`,
        },
      },
      HttpStatus.CONFLICT,
    );
  }

  private throwCourseTitleDepartmentConflict(
    title: string,
    otherCode: string,
    hasDepartment: boolean,
  ): never {
    throw new HttpException(
      {
        statusCode: HttpStatus.CONFLICT,
        message: hasDepartment
          ? 'A course with this title already exists in the selected department.'
          : 'A course with this title already exists for courses with no department.',
        fieldErrors: hasDepartment
          ? {
              title: `This title is already used in this department (existing course ${otherCode}).`,
              departmentId:
                'Change title or department so the combination is unique.',
            }
          : {
              title: `This title is already used for another course with no department (existing ${otherCode}).`,
            },
      },
      HttpStatus.CONFLICT,
    );
  }

  private async findActiveCourseByTitleAndDepartment(
    tenantId: string,
    title: string,
    departmentId: string | null,
    excludeCourseId?: string,
  ) {
    return this.prisma.course.findFirst({
      where: {
        tenantId,
        title,
        deletedAt: null,
        ...(departmentId ? { departmentId } : { departmentId: null }),
        ...(excludeCourseId ? { NOT: { id: excludeCourseId } } : {}),
      },
    });
  }

  private mapCoursePrismaUniqueError(e: unknown): never {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      const target = (e.meta?.target as string[] | undefined)?.join(',') ?? '';
      if (target.includes('code')) {
        throw new HttpException(
          {
            statusCode: HttpStatus.CONFLICT,
            message: 'A course with this code already exists.',
            fieldErrors: { code: 'This course code is already in use.' },
          },
          HttpStatus.CONFLICT,
        );
      }
      if (target.includes('title')) {
        throw new HttpException(
          {
            statusCode: HttpStatus.CONFLICT,
            message: 'This title is already used for this department.',
            fieldErrors: {
              title:
                'Duplicate title in this department (or duplicate title with no department).',
              departmentId: 'Adjust department or title.',
            },
          },
          HttpStatus.CONFLICT,
        );
      }
    }
    throw e;
  }

  async checkCourseDuplicates(
    tenantId: string,
    params: {
      code?: string;
      title?: string;
      departmentId?: string;
      excludeCourseId?: string;
    },
  ) {
    const rawCode = params.code?.trim();
    const code =
      rawCode && rawCode.length >= 2 ? this.normalizeCode(rawCode) : undefined;
    const titleTrim =
      params.title?.trim() && params.title.trim().length >= 2
        ? params.title.trim()
        : undefined;
    const departmentId =
      params.departmentId && params.departmentId.length > 0
        ? params.departmentId
        : null;
    const exclude = params.excludeCourseId;

    let codeConflict: { code: string; title: string } | null = null;
    let titleConflict: {
      code: string;
      title: string;
      departmentId: string | null;
    } | null = null;

    if (code) {
      const hit = await this.prisma.course.findFirst({
        where: {
          tenantId,
          code,
          deletedAt: null,
          ...(exclude ? { NOT: { id: exclude } } : {}),
        },
      });
      if (hit) codeConflict = { code: hit.code, title: hit.title };
    }

    if (titleTrim) {
      const hit = await this.findActiveCourseByTitleAndDepartment(
        tenantId,
        titleTrim,
        departmentId,
        exclude,
      );
      if (hit) {
        titleConflict = {
          code: hit.code,
          title: hit.title,
          departmentId: hit.departmentId,
        };
      }
    }

    return {
      codeTaken: Boolean(codeConflict),
      titleTakenInDepartment: Boolean(titleConflict),
      codeConflict,
      titleConflict,
    };
  }

  private async assertDepartment(tenantId: string, departmentId: string) {
    const row = await this.prisma.department.findFirst({
      where: { id: departmentId, tenantId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Department not found');
    if (!isAcademicDepartment(row.departmentType)) {
      throw new BadRequestException(
        'Courses and programmes must use an academic department, not an administrative unit',
      );
    }
    return row;
  }

  private async assertProgramCodeUnique(
    tenantId: string,
    code: string,
    excludeId?: string,
  ) {
    const conflict = await this.prisma.program.findFirst({
      where: {
        tenantId,
        code,
        deletedAt: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (conflict) {
      throw new ConflictException(`Program code "${code}" already exists`);
    }
  }

  async assertProgramVersion(tenantId: string, programVersionId: string) {
    const version = await this.prisma.programVersion.findFirst({
      where: { id: programVersionId, tenantId, deletedAt: null },
      include: { program: true },
    });
    if (!version) throw new NotFoundException('Program version not found');
    return version;
  }

  async assertOffering(tenantId: string, offeringId: string) {
    const offering = await this.prisma.courseOffering.findFirst({
      where: { id: offeringId, tenantId, deletedAt: null },
      include: offeringIncludeBasic,
    });
    if (!offering) throw new NotFoundException('Course offering not found');
    return offering;
  }

  async listPrograms(tenantId: string, query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    if (!query.search) {
      return this.cache.wrap(
        `programmes:${tenantId}:${page}:${limit}`,
        86400,
        () => this.fetchPrograms(tenantId, query),
      );
    }
    return this.fetchPrograms(tenantId, query);
  }

  private async fetchPrograms(tenantId: string, query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ProgramWhereInput = {
      tenantId,
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.program.count({ where }),
      this.prisma.program.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: programInclude,
        orderBy: { code: 'asc' },
      }),
    ]);

    return paginate(data, total, page, limit);
  }

  private async bustProgrammeCache(tenantId: string) {
    await this.cache.delByPrefix(`programmes:${tenantId}:`);
  }

  getProgram(tenantId: string, id: string) {
    return this.prisma.program
      .findFirst({
        where: { id, tenantId, deletedAt: null },
        include: programInclude,
      })
      .then((row) => {
        if (!row) throw new NotFoundException('Program not found');
        return row;
      });
  }

  async createProgram(tenantId: string, dto: CreateProgramDto) {
    const code = this.normalizeCode(dto.code);
    const name = dto.name.trim();
    assertProgrammeCodeNotCourseLike(code);
    if (!dto.departmentId) {
      throw new BadRequestException(
        'Department is required when creating a programme',
      );
    }
    if (!dto.level?.trim()) {
      throw new BadRequestException(
        'Programme type (level) is required when creating a programme',
      );
    }
    await this.assertDepartment(tenantId, dto.departmentId);

    const existing = await this.prisma.program.findFirst({
      where: { tenantId, code },
    });

    if (existing) {
      if (existing.deletedAt === null) {
        throw new ConflictException(`Program code "${code}" already exists`);
      }
      const row = await this.prisma.program.update({
        where: { id: existing.id },
        data: {
          deletedAt: null,
          name,
          level: dto.level ?? existing.level,
          ...(dto.departmentId !== undefined
            ? { departmentId: dto.departmentId }
            : {}),
        },
        include: programInclude,
      });
      await this.bustProgrammeCache(tenantId);
      return row;
    }

    const row = await this.prisma.program.create({
      data: {
        tenantId,
        code,
        name,
        departmentId: dto.departmentId,
        level: dto.level,
      },
      include: programInclude,
    });
    await this.bustProgrammeCache(tenantId);
    return row;
  }

  async updateProgram(tenantId: string, id: string, dto: UpdateProgramDto) {
    const existing = await this.prisma.program.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Program not found');

    const code = dto.code ? this.normalizeCode(dto.code) : existing.code;
    const name = dto.name?.trim() ?? existing.name;

    if (dto.code !== undefined) {
      assertProgrammeCodeNotCourseLike(code);
      await this.assertProgramCodeUnique(tenantId, code, id);
    }
    if (dto.departmentId) {
      await this.assertDepartment(tenantId, dto.departmentId);
    }

    const row = await this.prisma.program.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name } : {}),
        ...(dto.code !== undefined ? { code } : {}),
        ...(dto.level !== undefined ? { level: dto.level } : {}),
        ...(dto.departmentId !== undefined
          ? { departmentId: dto.departmentId }
          : {}),
      },
      include: programInclude,
    });
    await this.bustProgrammeCache(tenantId);
    return row;
  }

  /** @deprecated Use ProgramVersionLifecycleService.createDraft */
  async createProgramVersion(tenantId: string, dto: CreateProgramVersionDto) {
    await this.getProgram(tenantId, dto.programId);

    const latest = await this.prisma.programVersion.findFirst({
      where: { programId: dto.programId, tenantId, deletedAt: null },
      orderBy: { version: 'desc' },
    });

    return this.prisma.programVersion.create({
      data: {
        tenantId,
        programId: dto.programId,
        version: dto.version ?? (latest?.version ?? 0) + 1,
        status: 'DRAFT',
        cbcsEnabled: dto.cbcsEnabled ?? true,
        nepProfile: { multipleEntryExit: true, abcEnabled: true },
      },
      select: programVersionSummarySelect,
    });
  }

  private buildOfferingFilter(
    query: CourseListQueryDto,
  ): Prisma.CourseOfferingWhereInput {
    return {
      deletedAt: null,
      ...(query.programVersionId
        ? { programVersionId: query.programVersionId }
        : {}),
      ...(query.semesterSequence != null
        ? { semesterSequence: query.semesterSequence }
        : {}),
      ...(query.category ? { category: query.category } : {}),
    };
  }

  private hasCurriculumFilters(query: CourseListQueryDto): boolean {
    return Boolean(
      query.programVersionId ||
      query.semesterSequence != null ||
      query.category,
    );
  }

  private buildCourseSearchOr(
    term: string,
    offeringFilter: Prisma.CourseOfferingWhereInput,
  ): Prisma.CourseWhereInput[] {
    const contains = { contains: term, mode: 'insensitive' as const };
    return [
      { code: contains },
      { title: contains },
      { courseType: contains },
      { department: { OR: [{ name: contains }, { code: contains }] } },
      {
        offerings: {
          some: {
            ...offeringFilter,
            OR: [
              { category: contains },
              {
                programVersion: {
                  program: { OR: [{ code: contains }, { name: contains }] },
                },
              },
            ],
          },
        },
      },
    ];
  }

  async listCourses(
    tenantId: string,
    query: CourseListQueryDto | PaginationQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 30;
    const listQuery = query as CourseListQueryDto;
    const offeringFilter = this.buildOfferingFilter(listQuery);
    const curriculumFilters = this.hasCurriculumFilters(listQuery);
    const searchTerm = listQuery.search?.trim();

    const where: Prisma.CourseWhereInput = {
      tenantId,
      deletedAt: null,
      ...(listQuery.departmentId
        ? { departmentId: listQuery.departmentId }
        : {}),
      ...(listQuery.courseType ? { courseType: listQuery.courseType } : {}),
      ...(listQuery.deliveryType
        ? { deliveryType: listQuery.deliveryType }
        : {}),
      ...(curriculumFilters ? { offerings: { some: offeringFilter } } : {}),
      ...(searchTerm
        ? { OR: this.buildCourseSearchOr(searchTerm, offeringFilter) }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.course.count({ where }),
      this.prisma.course.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          ...courseInclude,
          offerings: courseListOfferingInclude,
          _count: {
            select: {
              offerings: { where: { deletedAt: null } },
            },
          },
        },
        orderBy: { code: 'asc' },
      }),
    ]);

    const data = rows.map((row) => {
      const { offerings, _count, ...course } = row;
      const totalMappings = _count.offerings;
      const mappingSummary: CourseMappingSummary[] = (offerings ?? [])
        .filter((o) => o.programVersion != null)
        .map((o) => ({
          programCode: o.programVersion!.program.code,
          programName: o.programVersion!.program.name,
          version: o.programVersion!.version,
          category: o.category,
          semesterSequence: o.semesterSequence,
        }));
      return {
        ...course,
        mappingSummary,
        mappingSummaryTotal: totalMappings,
        mappingSummaryTruncated: totalMappings > MAPPING_SUMMARY_CAP,
      };
    });

    return paginate(data, total, page, limit);
  }

  private resolveCourseDeliveryData(
    dto: Pick<
      CreateCourseDto,
      | 'deliveryType'
      | 'creditCalculationMode'
      | 'theoryCredits'
      | 'practicalCredits'
      | 'theoryHoursPerWeek'
      | 'practicalHoursPerWeek'
      | 'credits'
      | 'totalContactHours'
      | 'totalTheoryContactHours'
      | 'totalPracticalContactHours'
      | 'attendanceMode'
      | 'labRequired'
      | 'requiresTimetableSlots'
    >,
  ) {
    const credits = dto.credits;
    if (!dto.deliveryType) {
      return courseDeliveryDefaultsFromCredits(credits);
    }
    if (!isCourseDeliveryType(dto.deliveryType)) {
      throw new BadRequestException('Invalid deliveryType');
    }
    return normalizeCourseDeliveryInput({
      deliveryType: dto.deliveryType as CourseDeliveryType,
      creditCalculationMode: dto.creditCalculationMode as
        | CreditCalculationMode
        | undefined,
      theoryCredits: dto.theoryCredits,
      practicalCredits: dto.practicalCredits,
      theoryHoursPerWeek: dto.theoryHoursPerWeek,
      practicalHoursPerWeek: dto.practicalHoursPerWeek,
      credits,
      totalContactHours: dto.totalContactHours,
      totalTheoryContactHours: dto.totalTheoryContactHours,
      totalPracticalContactHours: dto.totalPracticalContactHours,
      attendanceMode: dto.attendanceMode as AttendanceMode | undefined,
      labRequired: dto.labRequired,
      requiresTimetableSlots: dto.requiresTimetableSlots,
    });
  }

  private resolveContactHours(
    dto: {
      totalTheoryContactHours?: number;
      totalPracticalContactHours?: number;
      totalContactHours?: number;
    },
    delivery: ReturnType<typeof normalizeCourseDeliveryInput>,
    existing?: {
      totalTheoryContactHours: number;
      totalPracticalContactHours: number;
      totalContactHours: number;
    },
  ) {
    const totalTheoryContactHours = Math.max(
      0,
      dto.totalTheoryContactHours ?? existing?.totalTheoryContactHours ?? 0,
    );
    const totalPracticalContactHours = Math.max(
      0,
      dto.totalPracticalContactHours ??
        existing?.totalPracticalContactHours ??
        0,
    );
    let totalContactHours = Math.max(
      0,
      dto.totalContactHours ??
        existing?.totalContactHours ??
        delivery.totalContactHours ??
        0,
    );
    if (delivery.creditCalculationMode === 'AUTO_CALCULATED') {
      totalContactHours = computeTotalContactHours(
        totalTheoryContactHours,
        totalPracticalContactHours,
      );
    } else if (totalContactHours === 0) {
      totalContactHours = computeTotalContactHours(
        totalTheoryContactHours,
        totalPracticalContactHours,
      );
    }
    return {
      totalTheoryContactHours,
      totalPracticalContactHours,
      totalContactHours,
    };
  }

  private courseDeliveryPersistence(
    delivery: ReturnType<typeof normalizeCourseDeliveryInput>,
  ) {
    return {
      deliveryType: delivery.deliveryType,
      creditCalculationMode: delivery.creditCalculationMode,
      requiresTheorySplit: delivery.requiresTheorySplit,
      requiresPracticalSplit: delivery.requiresPracticalSplit,
      attendanceMode: delivery.attendanceMode,
      labRequired: delivery.labRequired,
      requiresTimetableSlots: delivery.requiresTimetableSlots,
      hasPractical: delivery.hasPractical,
      theoryCredits: delivery.theoryCredits,
      practicalCredits: delivery.practicalCredits,
      theoryHoursPerWeek: delivery.theoryHoursPerWeek,
      practicalHoursPerWeek: delivery.practicalHoursPerWeek,
    };
  }

  private assertCourseAcademicStructure(
    delivery: ReturnType<typeof normalizeCourseDeliveryInput>,
    contact: {
      totalTheoryContactHours: number;
      totalPracticalContactHours: number;
      totalContactHours: number;
    },
  ) {
    validateCourseAcademicStructure({
      deliveryType: delivery.deliveryType,
      creditCalculationMode: delivery.creditCalculationMode,
      credits: delivery.credits,
      theoryCredits: delivery.theoryCredits,
      practicalCredits: delivery.practicalCredits,
      theoryHoursPerWeek: delivery.theoryHoursPerWeek,
      practicalHoursPerWeek: delivery.practicalHoursPerWeek,
      totalTheoryContactHours: contact.totalTheoryContactHours,
      totalPracticalContactHours: contact.totalPracticalContactHours,
      totalContactHours: contact.totalContactHours,
    });
  }

  private mergeCourseDeliveryUpdate(
    existing: {
      deliveryType: string;
      theoryCredits: Prisma.Decimal;
      practicalCredits: Prisma.Decimal;
      theoryHoursPerWeek: number;
      practicalHoursPerWeek: number;
      credits: Prisma.Decimal;
    },
    dto: UpdateCourseDto,
  ) {
    const credits =
      dto.credits !== undefined ? dto.credits : Number(existing.credits);
    const deliveryType = (dto.deliveryType ??
      existing.deliveryType) as CourseDeliveryType;
    if (dto.deliveryType && !isCourseDeliveryType(dto.deliveryType)) {
      throw new BadRequestException('Invalid deliveryType');
    }
    return normalizeCourseDeliveryInput({
      deliveryType,
      creditCalculationMode: dto.creditCalculationMode as
        | CreditCalculationMode
        | undefined,
      theoryCredits:
        dto.theoryCredits !== undefined
          ? dto.theoryCredits
          : Number(existing.theoryCredits),
      practicalCredits:
        dto.practicalCredits !== undefined
          ? dto.practicalCredits
          : Number(existing.practicalCredits),
      theoryHoursPerWeek:
        dto.theoryHoursPerWeek !== undefined
          ? dto.theoryHoursPerWeek
          : existing.theoryHoursPerWeek,
      practicalHoursPerWeek:
        dto.practicalHoursPerWeek !== undefined
          ? dto.practicalHoursPerWeek
          : existing.practicalHoursPerWeek,
      credits,
      totalContactHours: dto.totalContactHours,
      totalTheoryContactHours: dto.totalTheoryContactHours,
      totalPracticalContactHours: dto.totalPracticalContactHours,
      attendanceMode: dto.attendanceMode as AttendanceMode | undefined,
      labRequired: dto.labRequired,
      requiresTimetableSlots: dto.requiresTimetableSlots,
    });
  }

  async getCourse(tenantId: string, id: string) {
    const row = await this.prisma.course.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: courseInclude,
    });
    if (!row) throw new NotFoundException('Course not found');
    return row;
  }

  async createCourse(tenantId: string, dto: CreateCourseDto) {
    const code = this.normalizeCode(dto.code);
    const titleTrim = dto.title.trim();
    const departmentId = dto.departmentId ?? null;
    this.assertCbcsCourseType(dto.courseType);
    if (dto.departmentId) {
      await this.assertDepartment(tenantId, dto.departmentId);
    }

    const existing = await this.prisma.course.findFirst({
      where: { tenantId, code },
    });

    let excludeIdForTitle: string | undefined;
    if (existing) {
      if (existing.deletedAt === null) {
        this.throwCourseCodeConflict(code, existing.title);
      }
      excludeIdForTitle = existing.id;
    }

    const dupTitle = await this.findActiveCourseByTitleAndDepartment(
      tenantId,
      titleTrim,
      departmentId,
      excludeIdForTitle,
    );
    if (dupTitle) {
      this.throwCourseTitleDepartmentConflict(
        titleTrim,
        dupTitle.code,
        Boolean(departmentId),
      );
    }

    const delivery = this.resolveCourseDeliveryData(dto);
    const contact = this.resolveContactHours(dto, delivery);
    this.assertCourseAcademicStructure(delivery, contact);
    const vtcFields = this.resolveVtcFieldsForCourse(code, titleTrim, dto);

    if (existing?.deletedAt) {
      return this.prisma.course.update({
        where: { id: existing.id },
        data: {
          deletedAt: null,
          title: titleTrim,
          credits: delivery.credits,
          ...this.courseDeliveryPersistence(delivery),
          totalTheoryContactHours: contact.totalTheoryContactHours,
          totalPracticalContactHours: contact.totalPracticalContactHours,
          totalContactHours: contact.totalContactHours,
          courseType: dto.courseType,
          description: dto.description,
          ...vtcFields,
          ...(dto.departmentId !== undefined
            ? { departmentId: dto.departmentId }
            : {}),
          ...(dto.subjectSlug !== undefined
            ? { subjectSlug: dto.subjectSlug }
            : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.syllabusVersion !== undefined
            ? { syllabusVersion: dto.syllabusVersion }
            : {}),
          ...(dto.eligibilityRules !== undefined
            ? {
                eligibilityRules: normalizeCourseEligibilityRules(
                  dto.eligibilityRules,
                ),
              }
            : {}),
        },
        include: courseInclude,
      });
    }

    try {
      return await this.prisma.course.create({
        data: {
          tenantId,
          code,
          title: titleTrim,
          credits: delivery.credits,
          ...this.courseDeliveryPersistence(delivery),
          totalTheoryContactHours: contact.totalTheoryContactHours,
          totalPracticalContactHours: contact.totalPracticalContactHours,
          totalContactHours: contact.totalContactHours,
          courseType: dto.courseType,
          description: dto.description,
          departmentId: dto.departmentId,
          subjectSlug: dto.subjectSlug,
          status: dto.status ?? 'ACTIVE',
          syllabusVersion: dto.syllabusVersion,
          ...vtcFields,
          ...(dto.eligibilityRules !== undefined
            ? {
                eligibilityRules: normalizeCourseEligibilityRules(
                  dto.eligibilityRules,
                ),
              }
            : {}),
        },
        include: courseInclude,
      });
    } catch (e) {
      this.mapCoursePrismaUniqueError(e);
    }
  }

  async updateCourse(tenantId: string, id: string, dto: UpdateCourseDto) {
    const existing = await this.prisma.course.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Course not found');

    if (dto.courseType) {
      this.assertCbcsCourseType(dto.courseType);
    }
    if (dto.departmentId) {
      await this.assertDepartment(tenantId, dto.departmentId);
    }

    const code = dto.code ? this.normalizeCode(dto.code) : existing.code;
    if (dto.code && code !== existing.code) {
      const conflict = await this.prisma.course.findFirst({
        where: { tenantId, code, deletedAt: null, NOT: { id } },
      });
      if (conflict) {
        this.throwCourseCodeConflict(code, conflict.title);
      }
    }

    const nextTitle =
      dto.title !== undefined ? dto.title.trim() : existing.title;
    const nextDeptId =
      dto.departmentId !== undefined ? dto.departmentId : existing.departmentId;

    const titleChanged =
      dto.title !== undefined && nextTitle !== existing.title;
    const deptChanged =
      dto.departmentId !== undefined &&
      (nextDeptId ?? null) !== (existing.departmentId ?? null);
    if (titleChanged || deptChanged) {
      const dup = await this.findActiveCourseByTitleAndDepartment(
        tenantId,
        nextTitle,
        nextDeptId ?? null,
        existing.id,
      );
      if (dup) {
        this.throwCourseTitleDepartmentConflict(
          nextTitle,
          dup.code,
          Boolean(nextDeptId),
        );
      }
    }

    const deliveryPatch =
      dto.deliveryType !== undefined ||
      dto.creditCalculationMode !== undefined ||
      dto.theoryCredits !== undefined ||
      dto.practicalCredits !== undefined ||
      dto.theoryHoursPerWeek !== undefined ||
      dto.practicalHoursPerWeek !== undefined ||
      dto.credits !== undefined
        ? this.mergeCourseDeliveryUpdate(existing, dto)
        : null;

    const contactFieldsTouched =
      dto.totalTheoryContactHours !== undefined ||
      dto.totalPracticalContactHours !== undefined ||
      dto.totalContactHours !== undefined;

    const resolvedDelivery =
      deliveryPatch ??
      (deliveryPatch || contactFieldsTouched
        ? normalizeCourseDeliveryInput({
            deliveryType: existing.deliveryType as CourseDeliveryType,
            creditCalculationMode:
              existing.creditCalculationMode as CreditCalculationMode,
            theoryCredits: Number(existing.theoryCredits),
            practicalCredits: Number(existing.practicalCredits),
            theoryHoursPerWeek: existing.theoryHoursPerWeek,
            practicalHoursPerWeek: existing.practicalHoursPerWeek,
            credits: Number(existing.credits),
            totalContactHours: existing.totalContactHours,
            totalTheoryContactHours: existing.totalTheoryContactHours,
            totalPracticalContactHours: existing.totalPracticalContactHours,
          })
        : null);

    const contactPatch =
      resolvedDelivery && (deliveryPatch || contactFieldsTouched)
        ? this.resolveContactHours(dto, resolvedDelivery, existing)
        : null;

    if (resolvedDelivery && contactPatch) {
      this.assertCourseAcademicStructure(resolvedDelivery, contactPatch);
    }

    const nextCode = dto.code !== undefined ? code : existing.code;
    const vtcFields = this.resolveVtcFieldsForCourse(
      nextCode,
      nextTitle,
      dto,
      existing,
    );

    try {
      return await this.prisma.course.update({
        where: { id },
        data: {
          ...(dto.code !== undefined ? { code } : {}),
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(deliveryPatch
            ? {
                credits: deliveryPatch.credits,
                ...this.courseDeliveryPersistence(deliveryPatch),
              }
            : {}),
          ...(contactPatch
            ? {
                totalTheoryContactHours: contactPatch.totalTheoryContactHours,
                totalPracticalContactHours:
                  contactPatch.totalPracticalContactHours,
                totalContactHours: contactPatch.totalContactHours,
              }
            : {}),
          ...(dto.courseType !== undefined
            ? { courseType: dto.courseType }
            : {}),
          ...(dto.description !== undefined
            ? { description: dto.description }
            : {}),
          ...(dto.departmentId !== undefined
            ? { departmentId: dto.departmentId }
            : {}),
          ...(dto.subjectSlug !== undefined
            ? { subjectSlug: dto.subjectSlug }
            : {}),
          ...vtcFields,
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.syllabusVersion !== undefined
            ? { syllabusVersion: dto.syllabusVersion }
            : {}),
          ...(dto.eligibilityRules !== undefined
            ? {
                eligibilityRules: normalizeCourseEligibilityRules(
                  dto.eligibilityRules,
                ),
              }
            : {}),
        },
        include: courseInclude,
      });
    } catch (e) {
      this.mapCoursePrismaUniqueError(e);
    }
  }

  async assertProgramReadyForAdmission(tenantId: string, programId: string) {
    const program = await this.getProgram(tenantId, programId);
    const version = await this.prisma.programVersion.findFirst({
      where: { programId, tenantId, status: 'PUBLISHED', deletedAt: null },
    });
    if (!version) {
      throw new BadRequestException(
        `Program "${program.code}" has no published curriculum version. Publish a version before admissions.`,
      );
    }
    const ruleCount = await this.prisma.semesterStructureRule.count({
      where: { programVersionId: version.id, tenantId },
    });
    return {
      program,
      programVersion: version,
      hasStructureRules: ruleCount > 0,
    };
  }

  listOfferings(tenantId: string, programVersionId?: string) {
    return this.prisma.courseOffering.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(programVersionId ? { programVersionId } : {}),
      },
      include: offeringIncludeWithSections,
      orderBy: [
        { semesterSequence: 'asc' },
        { category: 'asc' },
        { createdAt: 'desc' },
      ],
    });
  }

  private async assertCurriculumSlotUnique(
    tenantId: string,
    programVersionId: string,
    courseId: string,
    semesterSequence?: number | null,
    category?: string | null,
    excludeOfferingId?: string,
  ) {
    const existing = await this.prisma.courseOffering.findFirst({
      where: {
        tenantId,
        programVersionId,
        courseId,
        deletedAt: null,
        semesterSequence: semesterSequence ?? null,
        category: category ?? null,
        ...(excludeOfferingId ? { NOT: { id: excludeOfferingId } } : {}),
      },
      include: { course: { select: { code: true } } },
    });
    if (existing) {
      throw new ConflictException(
        `Course "${existing.course.code}" is already mapped to this curriculum slot (semester ${semesterSequence ?? '—'}, category ${category ?? '—'}). Add delivery sections instead of duplicating the course.`,
      );
    }
  }

  listOfferingsForEngine(
    tenantId: string,
    filters: {
      programVersionId?: string;
      semesterSequence?: number;
      category?: string;
    },
  ) {
    return this.prisma.courseOffering.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(filters.programVersionId
          ? { programVersionId: filters.programVersionId }
          : {}),
        ...(filters.semesterSequence
          ? { semesterSequence: filters.semesterSequence }
          : {}),
        ...(filters.category ? { category: filters.category } : {}),
      },
      include: offeringIncludeWithSections,
      orderBy: [
        { semesterSequence: 'asc' },
        { category: 'asc' },
        { majorPaperIndex: 'asc' },
        { displayOrder: 'asc' },
        { course: { code: 'asc' } },
      ],
    });
  }

  async createOffering(tenantId: string, dto: CreateCourseOfferingDto) {
    await this.assertProgramVersion(tenantId, dto.programVersionId);
    const category = this.normalizeCurriculumCategory(dto.category);
    await this.assertCurriculumSlotUnique(
      tenantId,
      dto.programVersionId,
      dto.courseId,
      dto.semesterSequence,
      category,
    );

    return this.prisma.courseOffering.create({
      data: {
        tenantId,
        programVersionId: dto.programVersionId,
        courseId: dto.courseId,
        semesterId: dto.semesterId,
        isElective: dto.isElective ?? false,
        category,
        semesterSequence: dto.semesterSequence,
        displayOrder: dto.displayOrder,
        majorPaperIndex: dto.majorPaperIndex,
        capacity: dto.capacity,
        waitlistCapacity: dto.waitlistCapacity,
      },
      include: offeringIncludeWithSections,
    });
  }

  async updateOffering(
    tenantId: string,
    id: string,
    data: UpdateCourseOfferingDto,
  ) {
    const current = await this.prisma.courseOffering.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!current) throw new NotFoundException('Course offering not found');
    if (!current.programVersionId || current.mappingSource === 'SHARED_POOL') {
      throw new BadRequestException(
        'Shared pool offerings must be edited from Category Pools admin',
      );
    }

    const nextCategory =
      data.category !== undefined
        ? this.normalizeCurriculumCategory(data.category)
        : current.category != null && current.category !== ''
          ? this.normalizeCurriculumCategory(current.category)
          : null;
    const nextSemSeq =
      data.semesterSequence !== undefined
        ? data.semesterSequence
        : current.semesterSequence;

    if (data.category !== undefined || data.semesterSequence !== undefined) {
      await this.assertCurriculumSlotUnique(
        tenantId,
        current.programVersionId,
        current.courseId,
        nextSemSeq ?? null,
        nextCategory,
        id,
      );
    }

    return this.prisma.courseOffering.update({
      where: { id },
      data: {
        ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
        ...(data.waitlistCapacity !== undefined
          ? { waitlistCapacity: data.waitlistCapacity }
          : {}),
        ...(data.category !== undefined
          ? { category: this.normalizeCurriculumCategory(data.category) }
          : {}),
        ...(data.semesterSequence !== undefined
          ? { semesterSequence: data.semesterSequence }
          : {}),
        ...(data.displayOrder !== undefined
          ? { displayOrder: data.displayOrder }
          : {}),
        ...(data.isElective !== undefined
          ? { isElective: data.isElective }
          : {}),
        ...(data.semesterId !== undefined
          ? { semesterId: data.semesterId }
          : {}),
        ...(data.majorPaperIndex !== undefined
          ? { majorPaperIndex: data.majorPaperIndex }
          : {}),
      },
      include: offeringIncludeWithSections,
    });
  }

  countOfferings(tenantId: string, where?: Prisma.CourseOfferingWhereInput) {
    return this.prisma.courseOffering.count({
      where: { tenantId, deletedAt: null, ...where },
    });
  }

  async getCatalogSummary(tenantId: string) {
    const [programs, courses, programVersions, offerings] =
      await this.prisma.$transaction([
        this.prisma.program.count({ where: { tenantId, deletedAt: null } }),
        this.prisma.course.count({ where: { tenantId, deletedAt: null } }),
        this.prisma.programVersion.count({
          where: { tenantId, deletedAt: null },
        }),
        this.prisma.courseOffering.count({
          where: { tenantId, deletedAt: null },
        }),
      ]);

    return { programs, courses, programVersions, offerings };
  }

  softDeleteProgram(tenantId: string, id: string) {
    return this.prisma.program.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  softDeleteCourse(tenantId: string, id: string) {
    return this.prisma.course.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  /** Permanent delete — excluded from demo seed recreation. */
  async hardDeleteOffering(tenantId: string, id: string) {
    const offering = await this.prisma.courseOffering.findFirst({
      where: { id, tenantId },
      include: {
        course: { select: { code: true } },
        sections: {
          include: {
            shift: { select: { code: true } },
            seatLedger: true,
          },
        },
      },
    });
    if (!offering) throw new NotFoundException('Curriculum mapping not found');
    if (
      !offering.programVersionId ||
      offering.mappingSource === 'SHARED_POOL'
    ) {
      throw new BadRequestException(
        'Shared pool offerings must be removed from Category Pools admin',
      );
    }

    for (const section of offering.sections) {
      this.assertSectionDeletable(section);
    }

    await this.addExcludedCurriculumKeys(tenantId, [
      this.curriculumOfferingKey(offering),
      ...offering.sections.map((s) => this.curriculumSectionKey(offering, s)),
    ]);

    await this.prisma.$transaction(async (tx) => {
      for (const section of offering.sections) {
        await this.deleteSectionGraph(tx, section.id);
      }
      await tx.semesterRegistrationLine.deleteMany({
        where: { offeringId: id },
      });
      await tx.courseOffering.delete({ where: { id } });
    });

    return { ok: true, permanent: true };
  }

  async listOfferingSections(user: JwtUser, offeringId: string) {
    await this.assertOffering(user.tid, offeringId);
    const scope = this.shiftScope.resolveScope(user);
    let where = {
      courseOfferingId: offeringId,
      tenantId: user.tid,
      deletedAt: null,
    };
    where = this.shiftScope.applyToWhere(where, scope);
    return this.prisma.offeringSection.findMany({
      where,
      include: {
        shift: true,
        seatLedger: true,
        staffProfile: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            portalUser: { select: { email: true } },
          },
        },
        classroom: true,
        ...sectionStreamInclude,
      },
      orderBy: [{ shift: { sortOrder: 'asc' } }, { sectionCode: 'asc' }],
    });
  }

  async createOfferingSection(
    user: JwtUser,
    offeringId: string,
    dto: {
      shiftId: string;
      sectionCode?: string;
      studentGroup?: string;
      streamIds?: string[];
      capacity?: number;
      waitlistCapacity?: number;
      facultyId?: string;
      classroomId?: string;
    },
  ) {
    await this.assertOffering(user.tid, offeringId);
    const shiftId =
      this.shiftScope.assertCanUseShiftId(user, dto.shiftId) ?? dto.shiftId;
    this.shiftScope.assertShiftAccess(
      this.shiftScope.resolveScope(user),
      shiftId,
    );

    const sectionCode = (dto.sectionCode ?? 'A').trim().toUpperCase();
    const conflict = await this.prisma.offeringSection.findFirst({
      where: {
        courseOfferingId: offeringId,
        shiftId,
        sectionCode,
        deletedAt: null,
      },
    });
    if (conflict) {
      throw new ConflictException(
        `Section "${sectionCode}" already exists for this shift on this curriculum mapping`,
      );
    }

    if (dto.facultyId && !user.allShifts) {
      await this.assertStaffShift(user.tid, dto.facultyId, shiftId);
    }

    const section = await this.prisma.offeringSection.create({
      data: {
        tenantId: user.tid,
        courseOfferingId: offeringId,
        shiftId,
        sectionCode,
        studentGroup: dto.studentGroup?.trim() || null,
        capacity: dto.capacity ?? 80,
        waitlistCapacity: dto.waitlistCapacity ?? 10,
        staffProfileId: dto.facultyId,
        classroomId: dto.classroomId,
      },
      include: {
        shift: true,
        seatLedger: true,
        staffProfile: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            portalUser: { select: { email: true } },
          },
        },
        classroom: true,
      },
    });

    await this.prisma.offeringSeatLedger.upsert({
      where: { offeringSectionId: section.id },
      create: { tenantId: user.tid, offeringSectionId: section.id },
      update: {},
    });

    await this.sectionStreams.syncForSection(
      user.tid,
      section.id,
      dto.streamIds,
    );

    return this.prisma.offeringSection.findUniqueOrThrow({
      where: { id: section.id },
      include: {
        shift: true,
        seatLedger: true,
        staffProfile: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            portalUser: { select: { email: true } },
          },
        },
        classroom: true,
        ...sectionStreamInclude,
      },
    });
  }

  async updateOfferingSection(
    user: JwtUser,
    sectionId: string,
    dto: UpdateOfferingSectionDto,
  ) {
    const row = await this.prisma.offeringSection.findFirst({
      where: { id: sectionId, tenantId: user.tid, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Offering section not found');
    this.shiftScope.assertShiftAccess(
      this.shiftScope.resolveScope(user),
      row.shiftId,
    );

    const nextShiftId = dto.shiftId ?? row.shiftId;
    if (dto.shiftId) {
      this.shiftScope.assertShiftAccess(
        this.shiftScope.resolveScope(user),
        nextShiftId,
      );
    }
    const nextCode =
      dto.sectionCode !== undefined
        ? dto.sectionCode.trim().toUpperCase()
        : row.sectionCode;

    if (dto.shiftId !== undefined || dto.sectionCode !== undefined) {
      const dup = await this.prisma.offeringSection.findFirst({
        where: {
          courseOfferingId: row.courseOfferingId,
          shiftId: nextShiftId,
          sectionCode: nextCode,
          deletedAt: null,
          NOT: { id: sectionId },
        },
      });
      if (dup) {
        throw new ConflictException(
          `Section "${nextCode}" already exists for this shift on this curriculum mapping`,
        );
      }
    }

    const staffProfileId = dto.facultyId ?? row.staffProfileId;
    if (staffProfileId && !user.allShifts) {
      await this.assertStaffShift(user.tid, staffProfileId, nextShiftId);
    }

    await this.prisma.offeringSection.update({
      where: { id: sectionId },
      data: {
        ...(dto.shiftId !== undefined ? { shiftId: dto.shiftId } : {}),
        ...(dto.sectionCode !== undefined
          ? { sectionCode: dto.sectionCode.trim().toUpperCase() }
          : {}),
        ...(dto.studentGroup !== undefined
          ? { studentGroup: dto.studentGroup?.trim() || null }
          : {}),
        ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
        ...(dto.waitlistCapacity !== undefined
          ? { waitlistCapacity: dto.waitlistCapacity }
          : {}),
        ...(dto.facultyId !== undefined
          ? { staffProfileId: dto.facultyId }
          : {}),
        ...(dto.classroomId !== undefined
          ? { classroomId: dto.classroomId }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });

    if (dto.streamIds !== undefined) {
      await this.sectionStreams.syncForSection(
        user.tid,
        sectionId,
        dto.streamIds,
      );
    }

    return this.prisma.offeringSection.findUniqueOrThrow({
      where: { id: sectionId },
      include: {
        shift: true,
        seatLedger: true,
        staffProfile: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            portalUser: { select: { email: true } },
          },
        },
        classroom: true,
        ...sectionStreamInclude,
      },
    });
  }

  /** Permanent delete — excluded from demo seed recreation. */
  async hardDeleteOfferingSection(user: JwtUser, sectionId: string) {
    const row = await this.prisma.offeringSection.findFirst({
      where: { id: sectionId, tenantId: user.tid },
      include: {
        shift: { select: { code: true } },
        seatLedger: true,
        courseOffering: {
          include: { course: { select: { code: true } } },
        },
      },
    });
    if (!row) throw new NotFoundException('Offering section not found');
    this.shiftScope.assertShiftAccess(
      this.shiftScope.resolveScope(user),
      row.shiftId,
    );
    this.assertSectionDeletable(row);

    await this.addExcludedCurriculumKeys(user.tid, [
      this.curriculumSectionKey(row.courseOffering, row),
    ]);

    await this.prisma.$transaction(async (tx) => {
      await this.deleteSectionGraph(tx, sectionId);
    });

    return { ok: true, permanent: true };
  }

  private curriculumOfferingKey(offering: {
    programVersionId: string | null;
    categoryPoolId?: string | null;
    course: { code: string };
    semesterSequence: number | null;
  }) {
    const scope =
      offering.programVersionId ?? `pool:${offering.categoryPoolId ?? 'none'}`;
    return `${scope}:${offering.course.code}:${offering.semesterSequence ?? 0}`;
  }

  private curriculumSectionKey(
    offering: {
      programVersionId: string | null;
      categoryPoolId?: string | null;
      course: { code: string };
      semesterSequence: number | null;
    },
    section: { shift: { code: string }; sectionCode: string },
  ) {
    return `${this.curriculumOfferingKey(offering)}:${section.shift.code}:${section.sectionCode}`;
  }

  private assertSectionDeletable(section: {
    sectionCode: string;
    seatLedger?: { confirmedCount: number; waitlistCount: number } | null;
  }) {
    const confirmed = section.seatLedger?.confirmedCount ?? 0;
    const waitlisted = section.seatLedger?.waitlistCount ?? 0;
    if (confirmed > 0 || waitlisted > 0) {
      throw new BadRequestException(
        `Cannot permanently delete section ${section.sectionCode}: students are enrolled or waitlisted`,
      );
    }
  }

  private async deleteSectionGraph(
    tx: Prisma.TransactionClient,
    sectionId: string,
  ) {
    await tx.offeringSectionStream.deleteMany({
      where: { offeringSectionId: sectionId },
    });
    await tx.semesterRegistrationLine.deleteMany({
      where: { offeringSectionId: sectionId },
    });
    await tx.offeringSeatLedger.deleteMany({
      where: { offeringSectionId: sectionId },
    });
    await tx.offeringSection.delete({ where: { id: sectionId } });
  }

  private async addExcludedCurriculumKeys(tenantId: string, keys: string[]) {
    if (keys.length === 0) return;
    const existing = await this.prisma.tenantAcademicSettings.findUnique({
      where: { tenantId },
    });
    const profile =
      (existing?.nepProfile as Record<string, unknown> | null) ?? {};
    const current = Array.isArray(profile.excludedCurriculumKeys)
      ? (profile.excludedCurriculumKeys as string[])
      : [];
    const merged = [...new Set([...current, ...keys])];
    await this.prisma.tenantAcademicSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        nepProfile: { ...profile, excludedCurriculumKeys: merged },
      },
      update: {
        nepProfile: { ...profile, excludedCurriculumKeys: merged },
      },
    });
  }

  private async assertStaffShift(
    tenantId: string,
    staffProfileId: string,
    shiftId: string,
  ) {
    const mapping = await this.prisma.staffShiftAssignment.findFirst({
      where: { tenantId, staffProfileId, shiftId },
    });
    if (!mapping) {
      throw new BadRequestException(
        'Faculty is not assigned to teach in this shift',
      );
    }
  }
}
