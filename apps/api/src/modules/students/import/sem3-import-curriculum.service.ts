import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { assignMajorPaperSlots } from '../../academic-engine/domain/major-paper-assignment';
import { CurriculumResolutionService } from '../../academic-engine/services/curriculum-resolution.service';
import { PrismaService } from '../../../database/prisma.service';

export type Sem3PaperOption = {
  title: string;
  code: string;
  courseId: string;
  offeringId: string;
};

export type Sem3MajorDepartmentOption = {
  departmentName: string;
  paper1: Sem3PaperOption;
  paper2: Sem3PaperOption;
};

export type Sem3ImportCurriculumCatalog = {
  programVersionId: string;
  programCode: string;
  programName: string;
  semesterSequence: number;
  majorDepartments: Sem3MajorDepartmentOption[];
  mdcPapers: Sem3PaperOption[];
  aecPapers: Sem3PaperOption[];
  secPapers: Sem3PaperOption[];
  vtcPapers: Sem3PaperOption[];
};

type CurriculumOffering = {
  id: string;
  category: string | null;
  semesterSequence: number | null;
  majorPaperIndex: number | null;
  courseId: string;
  course: {
    id: string;
    code: string;
    title: string;
    department?: { id: string; name: string; code: string } | null;
  };
  categoryPoolId: string | null;
};

@Injectable()
export class Sem3ImportCurriculumService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly curriculum: CurriculumResolutionService,
  ) {}

  async resolveProgramVersion(
    tenantId: string,
    input: { programVersionId?: string; programme?: string },
  ) {
    if (input.programVersionId) {
      const version = await this.prisma.programVersion.findFirst({
        where: {
          id: input.programVersionId,
          tenantId,
          deletedAt: null,
          status: 'PUBLISHED',
        },
        include: { program: { select: { code: true, name: true } } },
      });
      if (!version) {
        throw new NotFoundException(
          'Programme version not found or not published',
        );
      }
      return version;
    }

    const programme = input.programme?.trim();
    if (!programme) {
      throw new BadRequestException(
        'Programme is required to generate the Semester 3 import template',
      );
    }

    const normalized = programme.trim().toUpperCase();
    const version = await this.prisma.programVersion.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        status: 'PUBLISHED',
        program: {
          deletedAt: null,
          OR: [
            { code: { equals: normalized, mode: 'insensitive' } },
            { name: { equals: programme.trim(), mode: 'insensitive' } },
          ],
        },
      },
      include: { program: { select: { code: true, name: true } } },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    });
    if (!version) {
      throw new NotFoundException(
        `Published programme version not found for ${programme}`,
      );
    }
    return version;
  }

  async listPublishedProgrammes(tenantId: string) {
    const versions = await this.prisma.programVersion.findMany({
      where: { tenantId, deletedAt: null, status: 'PUBLISHED' },
      include: { program: { select: { code: true, name: true } } },
      orderBy: [{ program: { code: 'asc' } }, { effectiveFrom: 'desc' }],
    });
    const seen = new Set<string>();
    return versions
      .filter((version) => {
        const key = version.program.code.toUpperCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((version) => ({
        programVersionId: version.id,
        code: version.program.code,
        name: version.program.name,
      }));
  }

  async buildCatalog(
    tenantId: string,
    input: {
      programVersionId?: string;
      programme?: string;
      semesterSequence?: number;
    },
  ): Promise<Sem3ImportCurriculumCatalog> {
    const semesterSequence = input.semesterSequence ?? 3;
    const version = await this.resolveProgramVersion(tenantId, input);
    const resolved = await this.curriculum.resolveProgrammeCurriculum(
      tenantId,
      version.id,
      semesterSequence,
    );

    const offerings: CurriculumOffering[] = [
      ...resolved.directOfferings.map((offering) => ({
        id: offering.id,
        category: offering.category,
        semesterSequence: offering.semesterSequence,
        majorPaperIndex: offering.majorPaperIndex,
        courseId: offering.courseId,
        course: offering.course,
        categoryPoolId: offering.categoryPoolId,
      })),
      ...resolved.inheritedPoolOfferings.map(({ offering }) => ({
        id: offering.id,
        category: offering.category,
        semesterSequence: offering.semesterSequence,
        majorPaperIndex: offering.majorPaperIndex,
        courseId: offering.courseId,
        course: offering.course,
        categoryPoolId: offering.categoryPoolId,
      })),
    ];

    const byCategory = (category: string) =>
      offerings.filter(
        (offering) =>
          String(offering.category ?? '').toUpperCase() === category &&
          (offering.semesterSequence == null ||
            offering.semesterSequence === semesterSequence),
      );

    const majorDepartments = this.buildMajorDepartments(byCategory('MAJOR'));
    const mdcPapers = this.buildCategoryPaperOptions(byCategory('MDC'));
    const aecPapers = this.buildCategoryPaperOptions(byCategory('AEC'));
    const secPapers = this.buildCategoryPaperOptions(byCategory('SEC'));
    const vtcPapers = this.buildCategoryPaperOptions(byCategory('VTC'));

    return {
      programVersionId: version.id,
      programCode: version.program.code,
      programName: version.program.name,
      semesterSequence,
      majorDepartments,
      mdcPapers,
      aecPapers,
      secPapers,
      vtcPapers,
    };
  }

  async buildTenantMajorDepartments(
    tenantId: string,
    semesterSequence = 3,
  ): Promise<Sem3MajorDepartmentOption[]> {
    const versions = await this.prisma.programVersion.findMany({
      where: { tenantId, deletedAt: null, status: 'PUBLISHED' },
      select: { id: true },
    });
    const merged = new Map<string, Sem3MajorDepartmentOption>();
    for (const version of versions) {
      const catalog = await this.buildCatalog(tenantId, {
        programVersionId: version.id,
        semesterSequence,
      });
      for (const department of catalog.majorDepartments) {
        const key = this.normalizeLabel(department.departmentName);
        if (!merged.has(key)) merged.set(key, department);
      }
    }
    return [...merged.values()].sort((a, b) =>
      a.departmentName.localeCompare(b.departmentName),
    );
  }

  resolveMajorDepartment(
    catalog: Sem3ImportCurriculumCatalog,
    input: string,
  ): Sem3MajorDepartmentOption | undefined {
    const normalized = this.normalizeLabel(input);
    return catalog.majorDepartments.find(
      (department) =>
        this.normalizeLabel(department.departmentName) === normalized,
    );
  }

  resolveCategoryPaper(
    options: Sem3PaperOption[],
    input: string,
    categoryLabel: string,
  ): Sem3PaperOption | undefined {
    const normalized = this.normalizeLabel(input);
    const exactTitle = options.find(
      (option) => this.normalizeLabel(option.title) === normalized,
    );
    if (exactTitle) return exactTitle;

    const exactCode = options.find(
      (option) => this.normalizeLabel(option.code) === normalized,
    );
    if (exactCode) return exactCode;

    const partial = options.filter(
      (option) =>
        this.normalizeLabel(option.title).includes(normalized) ||
        normalized.includes(this.normalizeLabel(option.title)),
    );
    if (partial.length === 1) return partial[0];

    if (!options.length) {
      return undefined;
    }
    return undefined;
  }

  private buildCategoryPaperOptions(
    offerings: CurriculumOffering[],
  ): Sem3PaperOption[] {
    const seen = new Set<string>();
    const options: Sem3PaperOption[] = [];
    for (const offering of offerings.sort((a, b) =>
      a.course.title.localeCompare(b.course.title),
    )) {
      if (seen.has(offering.courseId)) continue;
      seen.add(offering.courseId);
      options.push({
        title: offering.course.title,
        code: offering.course.code,
        courseId: offering.courseId,
        offeringId: offering.id,
      });
    }
    return options;
  }

  private buildMajorDepartments(
    majorOfferings: CurriculumOffering[],
  ): Sem3MajorDepartmentOption[] {
    const grouped = new Map<string, CurriculumOffering[]>();
    for (const offering of majorOfferings) {
      const departmentName =
        offering.course.department?.name?.trim() ||
        this.departmentFromCourseCode(offering.course.code);
      if (!departmentName) continue;
      const key = this.normalizeLabel(departmentName);
      const bucket = grouped.get(key) ?? [];
      bucket.push(offering);
      grouped.set(key, bucket);
    }

    const departments: Sem3MajorDepartmentOption[] = [];
    for (const [key, bucket] of grouped.entries()) {
      const assigned = assignMajorPaperSlots(
        bucket.map((offering) => ({
          majorPaperIndex: offering.majorPaperIndex,
          displayOrder: null,
          courseId: offering.courseId,
          course: { code: offering.course.code },
        })),
        2,
      );
      if (assigned.length < 2) continue;

      const paper1Offering = bucket.find(
        (offering) => offering.courseId === assigned[0].courseId,
      );
      const paper2Offering = bucket.find(
        (offering) => offering.courseId === assigned[1].courseId,
      );
      if (!paper1Offering || !paper2Offering) continue;

      departments.push({
        departmentName: bucket[0].course.department?.name ?? key,
        paper1: this.toPaperOption(paper1Offering),
        paper2: this.toPaperOption(paper2Offering),
      });
    }

    return departments.sort((a, b) =>
      a.departmentName.localeCompare(b.departmentName),
    );
  }

  private toPaperOption(offering: CurriculumOffering): Sem3PaperOption {
    return {
      title: offering.course.title,
      code: offering.course.code,
      courseId: offering.courseId,
      offeringId: offering.id,
    };
  }

  private departmentFromCourseCode(code: string) {
    const prefix = code.split('-')[0]?.trim().toUpperCase();
    const map: Record<string, string> = {
      ECO: 'Economics',
      EDU: 'Education',
      ENG: 'English',
      GAR: 'Garo',
      GEO: 'Geography',
      HIS: 'History',
      PHI: 'Philosophy',
      POL: 'Political Science',
      SOC: 'Sociology',
      BOT: 'Botany',
      CHE: 'Chemistry',
      MAT: 'Mathematics',
      PHY: 'Physics',
      ZOO: 'Zoology',
      COM: 'Commerce',
      CS: 'Computer Science',
      BCA: 'Computer Science',
    };
    return prefix ? map[prefix] : undefined;
  }

  normalizeLabel(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
