import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { assignMajorPaperSlots } from '../../academic-engine/domain/major-paper-assignment';
import { slugifySubject } from '../../academic-engine/domain/nep-categories';
import { CurriculumResolutionService } from '../../academic-engine/services/curriculum-resolution.service';
import { MajorMinorEligibilityService } from '../../academic-engine/services/major-minor-eligibility.service';
import { PrismaService } from '../../../database/prisma.service';
import { SEM5_INTERNSHIP_AREAS } from '../migration/sem5-admission-template';

export type Sem5PaperOption = {
  title: string;
  code: string;
  courseId: string;
  offeringId: string;
};

export type Sem5MajorDepartmentOption = {
  departmentName: string;
  subjectSlug: string;
  paper1: Sem5PaperOption;
  paper2: Sem5PaperOption;
  paper3: Sem5PaperOption;
  internship: Sem5PaperOption;
};

export type Sem5MinorDepartmentOption = {
  departmentName: string;
  subjectSlug: string;
  paper: Sem5PaperOption;
};

export type Sem5ImportCurriculumCatalog = {
  programVersionId: string;
  programCode: string;
  programName: string;
  curriculumLabel: string;
  semesterSequence: 5;
  shiftId?: string;
  majorDepartments: Sem5MajorDepartmentOption[];
  minorDepartments: Sem5MinorDepartmentOption[];
  internshipAreas: string[];
  minorByMajor: Record<string, string[]>;
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
    subjectSlug?: string | null;
    department?: { id: string; name: string; code: string } | null;
  };
  categoryPoolId: string | null;
};

@Injectable()
export class Sem5ImportCurriculumService {
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
        'Programme is required to generate the Semester 5 import template',
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
      shiftId?: string;
    },
  ): Promise<Sem5ImportCurriculumCatalog> {
    const semesterSequence = input.semesterSequence ?? 5;
    const version = await this.resolveProgramVersion(tenantId, input);
    const resolved = await this.curriculum.resolveProgrammeCurriculum(
      tenantId,
      version.id,
      semesterSequence,
      { shiftId: input.shiftId },
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

    const majorDepartments = await this.buildMajorDepartments(
      tenantId,
      version.id,
      semesterSequence,
      byCategory('MAJOR'),
      byCategory('INTERNSHIP'),
    );
    const minorDepartments = this.buildMinorDepartments(byCategory('MINOR'));
    const minorByMajor = await this.buildMinorByMajor(
      tenantId,
      version.id,
      semesterSequence,
      majorDepartments,
      input.academicYearId,
      input.shiftId,
    );

    return {
      programVersionId: version.id,
      programCode: version.program.code,
      programName: version.program.name,
      curriculumLabel: this.curriculumLabelFromVersion(version),
      semesterSequence: 5,
      shiftId: input.shiftId,
      majorDepartments,
      minorDepartments,
      internshipAreas: this.listInternshipCourseLabels(majorDepartments),
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
      shiftId?: string;
    },
  ) {
    const catalog = await this.buildCatalog(tenantId, {
      programVersionId: input.programVersionId,
      semesterSequence: input.semesterSequence ?? 5,
      academicYearId: input.academicYearId,
      shiftId: input.shiftId,
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
      majorPapers: [major.paper1, major.paper2, major.paper3],
      internship: major.internship,
      eligibleMinors: minors,
    };
  }

  /** NEHU major → allowed minor department names for Excel dropdowns (tenant-wide). */
  async buildTenantMinorByMajor(
    tenantId: string,
    shiftId?: string,
    academicYearId?: string,
  ): Promise<Record<string, string[]>> {
    const majors = await this.buildTenantMajorDepartments(tenantId, 5, shiftId);
    const referenceVersion = await this.prisma.programVersion.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        status: 'PUBLISHED',
        program: { deletedAt: null, code: { startsWith: 'BA-' } },
      },
      orderBy: [{ program: { code: 'asc' } }, { effectiveFrom: 'desc' }],
      select: { id: true },
    });
    const minorByMajor: Record<string, string[]> = {};
    if (!referenceVersion) return minorByMajor;

    for (const major of majors) {
      const eligibleMinors =
        await this.majorMinorEligibility.listEligibleMinors(
          tenantId,
          referenceVersion.id,
          major.subjectSlug,
          5,
          academicYearId,
          shiftId,
        );
      minorByMajor[this.normalizeLabel(major.departmentName)] = eligibleMinors
        .map((subject) => subject.department?.name ?? subject.name)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
    }
    return minorByMajor;
  }

  async buildTenantMajorDepartments(
    tenantId: string,
    semesterSequence = 5,
    shiftId?: string,
  ): Promise<Sem5MajorDepartmentOption[]> {
    const versions = await this.prisma.programVersion.findMany({
      where: { tenantId, deletedAt: null, status: 'PUBLISHED' },
      select: { id: true },
    });
    const merged = new Map<string, Sem5MajorDepartmentOption>();
    for (const version of versions) {
      try {
        const catalog = await this.buildCatalog(tenantId, {
          programVersionId: version.id,
          semesterSequence,
          shiftId,
        });
        for (const department of catalog.majorDepartments) {
          const key = this.normalizeLabel(department.departmentName);
          if (!merged.has(key)) merged.set(key, department);
        }
      } catch {
        // Skip programmes without a complete Sem 5 curriculum for this shift.
      }
    }
    return [...merged.values()].sort((a, b) =>
      a.departmentName.localeCompare(b.departmentName),
    );
  }

  resolveMajorDepartment(
    catalog: Sem5ImportCurriculumCatalog,
    input: string,
  ): Sem5MajorDepartmentOption | undefined {
    const normalized = this.normalizeLabel(input);
    return catalog.majorDepartments.find(
      (department) =>
        this.normalizeLabel(department.departmentName) === normalized,
    );
  }

  resolveMinorDepartmentOption(
    catalog: Sem5ImportCurriculumCatalog,
    input: string,
  ): Sem5MinorDepartmentOption | undefined {
    const normalized = this.normalizeLabel(input);
    return catalog.minorDepartments.find(
      (department) =>
        this.normalizeLabel(department.departmentName) === normalized,
    );
  }

  resolveMinorDepartment(
    catalog: Sem5ImportCurriculumCatalog,
    majorDepartment: string,
    minorInput: string,
  ): string | undefined {
    const majorKey = this.normalizeLabel(majorDepartment);
    const allowed = catalog.minorByMajor[majorKey] ?? [];
    const normalized = this.normalizeLabel(minorInput);
    return allowed.find((minor) => this.normalizeLabel(minor) === normalized);
  }

  /** Legacy placement-type labels (NGO / Bank / …) kept for older Excel files. */
  resolveInternshipArea(input: string): string | undefined {
    const normalized = this.normalizeLabel(input);
    return SEM5_INTERNSHIP_AREAS.find(
      (area) => this.normalizeLabel(area) === normalized,
    );
  }

  formatInternshipCourseLabel(paper: Sem5PaperOption): string {
    const code = paper.code.replace(/[\u2010-\u2015]/g, '-').trim();
    return `${code} — ${paper.title.trim()}`;
  }

  matchesInternshipPaper(paper: Sem5PaperOption, input: string): boolean {
    const normalized = this.normalizeLabel(input);
    if (!normalized || !paper?.code) return false;
    return (
      normalized ===
        this.normalizeLabel(this.formatInternshipCourseLabel(paper)) ||
      normalized === this.normalizeLabel(paper.code) ||
      normalized === this.normalizeLabel(paper.title) ||
      normalized === this.normalizeLabel(`${paper.code} ${paper.title}`)
    );
  }

  /** Resolve registered internship course from "CODE — Title", code, or title. */
  resolveInternshipPaper(
    catalog: Sem5ImportCurriculumCatalog,
    input: string,
    preferred?: Sem5PaperOption,
  ): Sem5PaperOption | undefined {
    if (preferred && this.matchesInternshipPaper(preferred, input)) {
      return preferred;
    }

    for (const department of catalog.majorDepartments) {
      if (this.matchesInternshipPaper(department.internship, input)) {
        return department.internship;
      }
    }
    return undefined;
  }

  /** Unique internship course labels across departments (for Excel dropdowns). */
  listInternshipCourseLabels(
    majorDepartments: Sem5MajorDepartmentOption[],
  ): string[] {
    const seen = new Set<string>();
    const labels: string[] = [];
    for (const department of majorDepartments) {
      if (!department.internship?.code) continue;
      const label = this.formatInternshipCourseLabel(department.internship);
      const key = this.normalizeLabel(label);
      if (seen.has(key)) continue;
      seen.add(key);
      labels.push(label);
    }
    return labels.sort((a, b) => a.localeCompare(b));
  }

  private isInternshipSlotCourseCode(code: string) {
    return /-303$/i.test(code.replace(/[\u2010-\u2015]/g, '-').trim());
  }

  private buildMinorDepartments(
    minorOfferings: CurriculumOffering[],
  ): Sem5MinorDepartmentOption[] {
    const grouped = new Map<string, CurriculumOffering>();
    for (const offering of minorOfferings) {
      if (this.isInternshipSlotCourseCode(offering.course.code)) continue;
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

  formatInvalidMinorMessage(
    majorDepartment: string,
    minorDepartment: string,
    catalog: Sem5ImportCurriculumCatalog,
  ) {
    const allowed =
      catalog.minorByMajor[this.normalizeLabel(majorDepartment)] ?? [];
    const allowedLines = allowed.map((minor) => `• ${minor}`).join('\n');
    return [
      'Invalid Minor Subject.',
      '',
      `For ${majorDepartment} Major, allowed Minor subjects are:`,
      '',
      allowedLines || '• (none configured)',
    ].join('\n');
  }

  private async buildMinorByMajor(
    tenantId: string,
    programVersionId: string,
    semesterSequence: number,
    majorDepartments: Sem5MajorDepartmentOption[],
    academicYearId?: string,
    shiftId?: string,
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
          shiftId,
        );
      const names = eligibleMinors
        .map((subject) => subject.department?.name ?? subject.name)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
      minorByMajor[this.normalizeLabel(major.departmentName)] = names;
    }
    return minorByMajor;
  }

  private async buildMajorDepartments(
    tenantId: string,
    programVersionId: string,
    semesterSequence: number,
    majorOfferings: CurriculumOffering[],
    internshipOfferings: CurriculumOffering[],
  ): Promise<Sem5MajorDepartmentOption[]> {
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

    const departments: Sem5MajorDepartmentOption[] = [];
    for (const [key, bucket] of grouped.entries()) {
      const assigned = assignMajorPaperSlots(
        bucket.map((offering) => ({
          majorPaperIndex: offering.majorPaperIndex,
          displayOrder: null,
          courseId: offering.courseId,
          course: { code: offering.course.code },
        })),
        3,
      );
      if (assigned.length < 3) continue;

      const paper1Offering = bucket.find(
        (offering) => offering.courseId === assigned[0].courseId,
      );
      const paper2Offering = bucket.find(
        (offering) => offering.courseId === assigned[1].courseId,
      );
      const paper3Offering = bucket.find(
        (offering) => offering.courseId === assigned[2].courseId,
      );
      if (!paper1Offering || !paper2Offering || !paper3Offering) continue;

      const departmentName = bucket[0].course.department?.name ?? key;
      const deptCode =
        bucket[0].course.department?.code?.trim().toUpperCase() ??
        bucket[0].course.code.split('-')[0]?.trim().toUpperCase();
      const internshipOffering = internshipOfferings.find((offering) => {
        const offeringDept =
          offering.course.department?.code?.trim().toUpperCase() ??
          offering.course.code.split('-')[0]?.trim().toUpperCase();
        return offeringDept === deptCode;
      });
      if (!internshipOffering) continue;

      const subjectSlug = slugifySubject(departmentName);

      departments.push({
        departmentName,
        subjectSlug,
        paper1: this.toPaperOption(paper1Offering),
        paper2: this.toPaperOption(paper2Offering),
        paper3: this.toPaperOption(paper3Offering),
        internship: this.toPaperOption(internshipOffering),
      });
    }

    return departments.sort((a, b) =>
      a.departmentName.localeCompare(b.departmentName),
    );
  }

  private toPaperOption(offering: CurriculumOffering): Sem5PaperOption {
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
      EDN: 'Education',
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
      MTH: 'Mathematics',
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
