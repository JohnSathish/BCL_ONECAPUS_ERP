import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { assignMajorPaperSlots } from '../../academic-engine/domain/major-paper-assignment';
import { slugifySubject } from '../../academic-engine/domain/nep-categories';
import { offeringPaperTitle } from '../../academic-engine/domain/offering-paper-title';
import { CurriculumResolutionService } from '../../academic-engine/services/curriculum-resolution.service';
import { MajorMinorEligibilityService } from '../../academic-engine/services/major-minor-eligibility.service';
import { PrismaService } from '../../../database/prisma.service';

export type Sem7PaperOption = {
  title: string;
  code: string;
  courseId: string;
  offeringId: string;
};

export type Sem7MajorDepartmentOption = {
  departmentName: string;
  departmentCode?: string;
  subjectSlug: string;
  paper1: Sem7PaperOption;
  paper2?: Sem7PaperOption;
  paper3?: Sem7PaperOption;
};

export type Sem7MinorDepartmentOption = {
  departmentName: string;
  departmentCode?: string;
  subjectSlug: string;
  papers: Sem7PaperOption[];
};

export type Sem7ImportCurriculumCatalog = {
  programVersionId: string;
  programCode: string;
  programName: string;
  semesterSequence: 7;
  shiftId?: string;
  majorDepartments: Sem7MajorDepartmentOption[];
  minorDepartments: Sem7MinorDepartmentOption[];
  minorByMajor: Record<string, string[]>;
};

type CurriculumOffering = {
  id: string;
  category: string | null;
  semesterSequence: number | null;
  majorPaperIndex: number | null;
  courseId: string;
  titleOverride?: string | null;
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
export class Sem7ImportCurriculumService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly curriculum: CurriculumResolutionService,
    private readonly majorMinorEligibility: MajorMinorEligibilityService,
  ) {}

  normalizeLabel(value: string) {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  async listPublishedProgrammes(tenantId: string) {
    const versions = await this.prisma.programVersion.findMany({
      where: { tenantId, deletedAt: null, status: 'PUBLISHED' },
      include: { program: { select: { code: true, name: true } } },
      orderBy: { program: { code: 'asc' } },
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
        'Programme is required to generate the Semester 7 import template',
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
      orderBy: { createdAt: 'desc' },
    });
    if (!version) {
      throw new NotFoundException(`Programme "${programme}" not found`);
    }
    return version;
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
  ): Promise<Sem7ImportCurriculumCatalog> {
    const semesterSequence = input.semesterSequence ?? 7;
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
        titleOverride: offering.titleOverride,
        course: offering.course,
        categoryPoolId: offering.categoryPoolId,
      })),
      ...resolved.inheritedPoolOfferings.map(({ offering }) => ({
        id: offering.id,
        category: offering.category,
        semesterSequence: offering.semesterSequence,
        majorPaperIndex: offering.majorPaperIndex,
        courseId: offering.courseId,
        titleOverride: offering.titleOverride,
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
      semesterSequence: 7,
      shiftId: input.shiftId,
      majorDepartments,
      minorDepartments,
      minorByMajor,
    };
  }

  async buildTenantMajorDepartments(
    tenantId: string,
    semesterSequence = 7,
    shiftId?: string,
  ): Promise<Sem7MajorDepartmentOption[]> {
    const versions = await this.prisma.programVersion.findMany({
      where: { tenantId, deletedAt: null, status: 'PUBLISHED' },
      select: { id: true },
    });
    const merged = new Map<string, Sem7MajorDepartmentOption>();
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
        // Skip programmes without Sem 7 major papers.
      }
    }
    return [...merged.values()].sort((a, b) =>
      a.departmentName.localeCompare(b.departmentName),
    );
  }

  async buildTenantMinorByMajor(
    tenantId: string,
    shiftId?: string,
    academicYearId?: string,
  ): Promise<Record<string, string[]>> {
    const versions = await this.prisma.programVersion.findMany({
      where: { tenantId, deletedAt: null, status: 'PUBLISHED' },
      select: { id: true },
    });
    const minorByMajor: Record<string, string[]> = {};
    for (const version of versions) {
      try {
        const catalog = await this.buildCatalog(tenantId, {
          programVersionId: version.id,
          semesterSequence: 7,
          academicYearId,
          shiftId,
        });
        for (const [majorKey, minors] of Object.entries(catalog.minorByMajor)) {
          if (!minorByMajor[majorKey]) {
            minorByMajor[majorKey] = minors;
          }
        }
      } catch {
        // Skip incomplete programmes.
      }
    }
    return minorByMajor;
  }

  resolveMajorDepartment(
    catalog: Sem7ImportCurriculumCatalog,
    input: string,
  ): Sem7MajorDepartmentOption | undefined {
    return catalog.majorDepartments.find((department) =>
      this.sameDepartmentLabel(department, input),
    );
  }

  resolveMinorDepartment(
    catalog: Sem7ImportCurriculumCatalog,
    majorDepartment: string,
    minorInput: string,
  ): string | undefined {
    const major = this.resolveMajorDepartment(catalog, majorDepartment);
    const majorKey = this.normalizeLabel(
      major?.departmentName ?? majorDepartment,
    );
    const allowed = catalog.minorByMajor[majorKey] ?? [];
    return allowed.find((minor) => this.sameDepartmentLabel(minor, minorInput));
  }

  resolveMinorDepartmentOption(
    catalog: Sem7ImportCurriculumCatalog,
    input: string,
  ): Sem7MinorDepartmentOption | undefined {
    return catalog.minorDepartments.find((department) =>
      this.sameDepartmentLabel(department, input),
    );
  }

  /** Name, code, subject slug, or "Department of X" all refer to the same department. */
  sameDepartmentLabel(
    candidate:
      | string
      | {
          departmentName: string;
          departmentCode?: string;
          subjectSlug?: string;
        },
    input: string,
  ) {
    const name =
      typeof candidate === 'string' ? candidate : candidate.departmentName;
    const code =
      typeof candidate === 'string' ? undefined : candidate.departmentCode;
    const subjectSlug =
      typeof candidate === 'string' ? undefined : candidate.subjectSlug;
    const left = this.bareDepartmentLabel(this.normalizeLabel(name));
    const right = this.bareDepartmentLabel(this.normalizeLabel(input));
    if (left === right) return true;
    if (slugifySubject(name) === slugifySubject(input)) return true;
    if (subjectSlug && subjectSlug === slugifySubject(input)) return true;
    if (code && this.normalizeLabel(code) === this.normalizeLabel(input)) {
      return true;
    }
    return false;
  }

  private bareDepartmentLabel(normalized: string) {
    return normalized.replace(/^(department|dept)\.?\s+of\s+/, '');
  }

  private async buildMinorByMajor(
    tenantId: string,
    programVersionId: string,
    semesterSequence: number,
    majorDepartments: Sem7MajorDepartmentOption[],
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

  private buildMajorDepartments(
    majorOfferings: CurriculumOffering[],
  ): Sem7MajorDepartmentOption[] {
    const grouped = new Map<string, CurriculumOffering[]>();
    for (const offering of majorOfferings) {
      const departmentName =
        offering.course.department?.name?.trim() ||
        offering.course.code.split('-')[0]?.trim() ||
        '';
      if (!departmentName) continue;
      const key = this.normalizeLabel(departmentName);
      const bucket = grouped.get(key) ?? [];
      bucket.push(offering);
      grouped.set(key, bucket);
    }

    const departments: Sem7MajorDepartmentOption[] = [];
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
      if (assigned.length < 1) continue;

      const paperOffering = (index: number) =>
        bucket.find(
          (offering) => offering.courseId === assigned[index]?.courseId,
        );
      const paper1Offering = paperOffering(0);
      const paper2Offering = paperOffering(1);
      const paper3Offering = paperOffering(2);
      if (!paper1Offering) continue;

      const departmentName =
        paper1Offering.course.department?.name?.trim() ||
        bucket[0]!.course.department?.name?.trim() ||
        key;
      const subjectSlug =
        paper1Offering.course.subjectSlug?.trim() ||
        slugifySubject(departmentName);
      const departmentCode =
        paper1Offering.course.department?.code?.trim() ||
        paper1Offering.course.code.split('-')[0]?.trim() ||
        undefined;

      departments.push({
        departmentName,
        departmentCode,
        subjectSlug,
        paper1: this.toPaperOption(paper1Offering),
        ...(paper2Offering
          ? { paper2: this.toPaperOption(paper2Offering) }
          : {}),
        ...(paper3Offering
          ? { paper3: this.toPaperOption(paper3Offering) }
          : {}),
      });
    }

    return departments.sort((a, b) =>
      a.departmentName.localeCompare(b.departmentName),
    );
  }

  private buildMinorDepartments(
    minorOfferings: CurriculumOffering[],
  ): Sem7MinorDepartmentOption[] {
    const grouped = new Map<string, CurriculumOffering[]>();
    for (const offering of minorOfferings) {
      const departmentName =
        offering.course.department?.name?.trim() ||
        offering.course.code.split('-')[0]?.trim() ||
        '';
      if (!departmentName) continue;
      const key = this.normalizeLabel(departmentName);
      const bucket = grouped.get(key) ?? [];
      bucket.push(offering);
      grouped.set(key, bucket);
    }

    return [...grouped.entries()]
      .map(([key, bucket]) => {
        const departmentName = bucket[0]!.course.department?.name ?? key;
        const subjectSlug =
          bucket[0]!.course.subjectSlug?.trim() ||
          slugifySubject(departmentName);
        const departmentCode =
          bucket[0]!.course.department?.code?.trim() ||
          bucket[0]!.course.code.split('-')[0]?.trim() ||
          undefined;
        return {
          departmentName,
          departmentCode,
          subjectSlug,
          papers: bucket.map((offering) => this.toPaperOption(offering)),
        };
      })
      .sort((a, b) => a.departmentName.localeCompare(b.departmentName));
  }

  private toPaperOption(offering: CurriculumOffering): Sem7PaperOption {
    return {
      title: offeringPaperTitle(offering.course, offering),
      code: offering.course.code,
      courseId: offering.courseId,
      offeringId: offering.id,
    };
  }
}
