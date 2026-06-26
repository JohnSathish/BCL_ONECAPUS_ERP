import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { slugifySubject } from '../../academic-engine/domain/nep-categories';
import { CurriculumResolutionService } from '../../academic-engine/services/curriculum-resolution.service';
import { MajorMinorEligibilityService } from '../../academic-engine/services/major-minor-eligibility.service';
import { PrismaService } from '../../../database/prisma.service';

export type Sem1PaperOption = {
  title: string;
  code: string;
  courseId: string;
  offeringId: string;
};

export type Sem1MajorDepartmentOption = {
  departmentName: string;
  subjectSlug: string;
  paper: Sem1PaperOption;
};

export type Sem1ImportCurriculumCatalog = {
  programVersionId: string;
  programCode: string;
  programName: string;
  curriculumLabel: string;
  semesterSequence: 1;
  majorDepartments: Sem1MajorDepartmentOption[];
  mdcDepartments: Sem1PaperOption[];
  aecPapers: Sem1PaperOption[];
  secPapers: Sem1PaperOption[];
  vacPaper: Sem1PaperOption;
  minorByMajor: Record<string, string[]>;
};

type CurriculumOffering = {
  id: string;
  category: string | null;
  semesterSequence: number | null;
  courseId: string;
  course: {
    id: string;
    code: string;
    title: string;
    subjectSlug?: string | null;
    department?: { id: string; name: string; code: string } | null;
  };
};

@Injectable()
export class Sem1ImportCurriculumService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly curriculum: CurriculumResolutionService,
    private readonly majorMinorEligibility: MajorMinorEligibilityService,
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
        include: {
          program: { select: { code: true, name: true } },
          structureTemplate: {
            include: {
              lastAppliedFyugpTemplate: {
                select: { templateName: true, programmeLevel: true },
              },
            },
          },
        },
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
        'Programme is required to generate the Semester 1 import template',
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
      include: {
        program: { select: { code: true, name: true } },
        structureTemplate: {
          include: {
            lastAppliedFyugpTemplate: {
              select: { templateName: true, programmeLevel: true },
            },
          },
        },
      },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    });
    if (!version) {
      throw new NotFoundException(
        `Published programme version not found for ${programme}`,
      );
    }
    return version;
  }

  curriculumLabelFromVersion(version: {
    structureTemplate?: {
      structureType?: string;
      lastAppliedFyugpTemplate?: {
        templateName: string;
        programmeLevel: string;
      } | null;
    } | null;
  }) {
    const template = version.structureTemplate?.lastAppliedFyugpTemplate;
    if (template?.templateName?.trim()) return template.templateName.trim();
    if (template?.programmeLevel?.trim()) return template.programmeLevel.trim();
    const structureType = version.structureTemplate?.structureType;
    if (structureType?.includes('FYUGP')) return 'FYUGP';
    return structureType ?? 'Curriculum';
  }

  async listPublishedProgrammes(tenantId: string) {
    const versions = await this.prisma.programVersion.findMany({
      where: { tenantId, deletedAt: null, status: 'PUBLISHED' },
      include: {
        program: { select: { code: true, name: true } },
        structureTemplate: {
          include: {
            lastAppliedFyugpTemplate: {
              select: { templateName: true, programmeLevel: true },
            },
          },
        },
      },
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
        curriculumLabel: this.curriculumLabelFromVersion(version),
      }));
  }

  async buildCatalog(
    tenantId: string,
    input: {
      programVersionId?: string;
      programme?: string;
      semesterSequence?: number;
      academicYearId?: string;
    },
  ): Promise<Sem1ImportCurriculumCatalog> {
    const semesterSequence = input.semesterSequence ?? 1;
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
        courseId: offering.courseId,
        course: offering.course,
      })),
      ...resolved.inheritedPoolOfferings.map(({ offering }) => ({
        id: offering.id,
        category: offering.category,
        semesterSequence: offering.semesterSequence,
        courseId: offering.courseId,
        course: offering.course,
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
    const mdcDepartments = this.buildCategoryPaperOptions(byCategory('MDC'));
    const aecPapers = this.buildCategoryPaperOptions(byCategory('AEC'));
    const secPapers = this.buildCategoryPaperOptions(byCategory('SEC'));
    const vacOfferings = byCategory('VAC');
    const vacOffering = vacOfferings[0];
    if (!vacOffering) {
      throw new BadRequestException(
        'Semester 1 VAC offering is not configured for this programme.',
      );
    }

    const minorByMajor = await this.buildMinorByMajor(
      tenantId,
      version.id,
      semesterSequence,
      majorDepartments,
      input.academicYearId,
    );

    return {
      programVersionId: version.id,
      programCode: version.program.code,
      programName: version.program.name,
      curriculumLabel: this.curriculumLabelFromVersion(version),
      semesterSequence: 1,
      majorDepartments,
      mdcDepartments,
      aecPapers,
      secPapers,
      vacPaper: this.toPaperOption(vacOffering),
      minorByMajor,
    };
  }

  async listEligibleMinorsForMajor(
    tenantId: string,
    input: {
      programVersionId: string;
      majorDepartment: string;
      academicYearId?: string;
      semesterSequence?: number;
    },
  ) {
    const catalog = await this.buildCatalog(tenantId, {
      programVersionId: input.programVersionId,
      semesterSequence: input.semesterSequence ?? 1,
      academicYearId: input.academicYearId,
    });
    const major = this.resolveMajorDepartment(catalog, input.majorDepartment);
    if (!major) {
      throw new NotFoundException(
        `Unknown major department "${input.majorDepartment}" for this programme.`,
      );
    }
    const minors =
      catalog.minorByMajor[this.normalizeLabel(major.departmentName)] ?? [];
    return {
      majorDepartment: major.departmentName,
      majorPaper: major.paper,
      vacPaper: catalog.vacPaper,
      eligibleMinors: minors,
    };
  }

  async buildTenantMajorDepartments(
    tenantId: string,
    semesterSequence = 1,
  ): Promise<Sem1MajorDepartmentOption[]> {
    const versions = await this.prisma.programVersion.findMany({
      where: { tenantId, deletedAt: null, status: 'PUBLISHED' },
      select: { id: true },
    });
    const merged = new Map<string, Sem1MajorDepartmentOption>();
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
    catalog: Sem1ImportCurriculumCatalog,
    input: string,
  ): Sem1MajorDepartmentOption | undefined {
    const normalized = this.normalizeLabel(input);
    return catalog.majorDepartments.find(
      (department) =>
        this.normalizeLabel(department.departmentName) === normalized,
    );
  }

  resolveMinorDepartment(
    catalog: Sem1ImportCurriculumCatalog,
    majorDepartment: string,
    minorInput: string,
  ): Sem1MajorDepartmentOption | undefined {
    const majorKey = this.normalizeLabel(majorDepartment);
    const allowed = catalog.minorByMajor[majorKey] ?? [];
    const normalized = this.normalizeLabel(minorInput);
    if (!allowed.some((minor) => this.normalizeLabel(minor) === normalized)) {
      return undefined;
    }
    return catalog.majorDepartments.find(
      (department) =>
        this.normalizeLabel(department.departmentName) === normalized,
    );
  }

  resolveCategoryPaper(
    options: Sem1PaperOption[],
    input: string,
    categoryLabel: string,
  ): Sem1PaperOption | undefined {
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

    if (!options.length) return undefined;
    return undefined;
  }

  private async buildMinorByMajor(
    tenantId: string,
    programVersionId: string,
    semesterSequence: number,
    majorDepartments: Sem1MajorDepartmentOption[],
    academicYearId?: string,
  ): Promise<Record<string, string[]>> {
    const minorByMajor: Record<string, string[]> = {};
    for (const major of majorDepartments) {
      const eligibleMinors =
        await this.majorMinorEligibility.listEligibleMinors(
          tenantId,
          programVersionId,
          major.subjectSlug,
          semesterSequence,
          academicYearId,
        );
      const names = eligibleMinors
        .map((subject) => subject.department?.name ?? subject.name)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
      minorByMajor[this.normalizeLabel(major.departmentName)] = names;
    }
    return minorByMajor;
  }

  private buildMajorDepartments(
    majorOfferings: CurriculumOffering[],
  ): Sem1MajorDepartmentOption[] {
    const grouped = new Map<string, CurriculumOffering>();
    for (const offering of majorOfferings) {
      const departmentName =
        offering.course.department?.name?.trim() ||
        this.departmentFromCourseCode(offering.course.code);
      if (!departmentName) continue;
      const key = this.normalizeLabel(departmentName);
      if (!grouped.has(key)) grouped.set(key, offering);
    }
    return [...grouped.entries()]
      .map(([key, offering]) => {
        const departmentName = offering.course.department?.name ?? key;
        return {
          departmentName,
          subjectSlug: slugifySubject(departmentName),
          paper: this.toPaperOption(offering),
        };
      })
      .sort((a, b) => a.departmentName.localeCompare(b.departmentName));
  }

  private buildCategoryPaperOptions(
    offerings: CurriculumOffering[],
  ): Sem1PaperOption[] {
    const seen = new Set<string>();
    const options: Sem1PaperOption[] = [];
    for (const offering of offerings.sort((a, b) =>
      a.course.title.localeCompare(b.course.title),
    )) {
      if (seen.has(offering.courseId)) continue;
      seen.add(offering.courseId);
      options.push(this.toPaperOption(offering));
    }
    return options;
  }

  private toPaperOption(offering: CurriculumOffering): Sem1PaperOption {
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
