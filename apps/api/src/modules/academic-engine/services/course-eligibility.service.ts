import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  buildEligibilityContext,
  type DraftEligibilityContextInput,
} from '../domain/course-eligibility.context';
import {
  evaluateCourseEligibility,
  isRulesEmpty,
  normalizeCourseEligibilityRules,
} from '../domain/course-eligibility.engine';
import type {
  Class12SubjectRecord,
  CompletedStudyRecord,
  CourseEligibilityRules,
  StudentEligibilityContext,
} from '../domain/course-eligibility.types';
import { resolveCourseSubjectSlug } from '../domain/course-subject-slug';

type SectionWithCourse = {
  id: string;
  courseOffering: {
    course: {
      id: string;
      eligibilityRules?: unknown;
    };
  };
};

export type EligibilityPreviewInput = DraftEligibilityContextInput & {
  studentId?: string;
};

export type EligibilityStatsInput = {
  institutionId?: string;
  programVersionIds?: string[];
};

@Injectable()
export class CourseEligibilityService {
  constructor(private readonly prisma: PrismaService) {}

  async getCourseRules(
    tenantId: string,
    courseId: string,
  ): Promise<CourseEligibilityRules> {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, tenantId, deletedAt: null },
      select: { eligibilityRules: true },
    });
    if (!course) throw new NotFoundException('Course not found');
    return normalizeCourseEligibilityRules(course.eligibilityRules);
  }

  async updateCourseRules(tenantId: string, courseId: string, rules: unknown) {
    const normalized = normalizeCourseEligibilityRules(rules);
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, tenantId, deletedAt: null },
    });
    if (!course) throw new NotFoundException('Course not found');
    return this.prisma.course.update({
      where: { id: courseId },
      data: { eligibilityRules: normalized },
      select: {
        id: true,
        code: true,
        title: true,
        eligibilityRules: true,
      },
    });
  }

  async buildContextFromStudent(
    tenantId: string,
    studentId: string,
  ): Promise<StudentEligibilityContext> {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
      include: {
        programVersion: { select: { id: true, programId: true } },
        academicProfile: {
          include: {
            stream: { select: { code: true } },
          },
        },
        programChoices: {
          where: { status: 'active', deletedAt: null },
          select: { choiceType: true, subjectSlug: true },
        },
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    const major = student.programChoices.find((c) => c.choiceType === 'MAJOR');
    const minor = student.programChoices.find((c) => c.choiceType === 'MINOR');
    const class12Subjects = this.parseClass12Subjects(
      student.academicProfile?.class12Subjects,
    );
    const completedStudy = await this.loadCompletedStudy(tenantId, studentId);

    return buildEligibilityContext({
      programId: student.programVersion?.programId ?? undefined,
      programVersionId: student.programVersionId ?? undefined,
      streamCode: student.academicProfile?.stream?.code ?? null,
      majorSubjectSlug: major?.subjectSlug ?? null,
      minorSubjectSlug: minor?.subjectSlug ?? null,
      class12Subjects,
      completedStudy,
    });
  }

  buildContextFromDraft(
    input: DraftEligibilityContextInput,
  ): StudentEligibilityContext {
    return buildEligibilityContext(input);
  }

  async resolveContext(
    tenantId: string,
    input: EligibilityPreviewInput,
  ): Promise<StudentEligibilityContext> {
    if (input.studentId) {
      return this.buildContextFromStudent(tenantId, input.studentId);
    }

    let programId = input.programId;
    if (input.programVersionId && !programId) {
      const version = await this.prisma.programVersion.findFirst({
        where: { id: input.programVersionId, tenantId, deletedAt: null },
        select: { programId: true },
      });
      programId = version?.programId;
    }

    let streamCode = input.streamCode ?? null;
    if (input.streamId && !streamCode) {
      const stream = await this.prisma.academicStream.findFirst({
        where: { id: input.streamId, tenantId, deletedAt: null },
        select: { code: true },
      });
      streamCode = stream?.code ?? null;
    }

    return buildEligibilityContext({
      ...input,
      programId,
      streamCode,
    });
  }

  async preview(
    tenantId: string,
    courseId: string,
    input: EligibilityPreviewInput,
  ) {
    const [rules, ctx] = await Promise.all([
      this.getCourseRules(tenantId, courseId),
      this.resolveContext(tenantId, input),
    ]);
    const result = evaluateCourseEligibility(rules, ctx);
    return {
      ...result,
      rules,
      context: ctx,
    };
  }

  async countPopulation(
    tenantId: string,
    courseId: string,
    scope?: EligibilityStatsInput,
  ) {
    const rules = await this.getCourseRules(tenantId, courseId);
    if (isRulesEmpty(rules)) {
      const total = await this.countStudentsInScope(tenantId, scope);
      return { eligible: total, blocked: 0, total };
    }

    const students = await this.listStudentsForStats(tenantId, scope);
    let eligible = 0;
    let blocked = 0;

    for (const student of students) {
      const ctx = await this.buildContextFromStudent(tenantId, student.id);
      if (evaluateCourseEligibility(rules, ctx).eligible) {
        eligible += 1;
      } else {
        blocked += 1;
      }
    }

    return { eligible, blocked, total: eligible + blocked };
  }

  filterSections<T extends SectionWithCourse>(
    sections: T[],
    ctx: StudentEligibilityContext,
  ): T[] {
    return this.partitionSections(sections, ctx).eligible;
  }

  partitionSections<T extends SectionWithCourse>(
    sections: T[],
    ctx: StudentEligibilityContext,
  ): {
    eligible: T[];
    ineligible: Array<{
      section: T;
      reasons: string[];
      codes: string[];
    }>;
  } {
    const eligible: T[] = [];
    const ineligible: Array<{
      section: T;
      reasons: string[];
      codes: string[];
    }> = [];

    for (const section of sections) {
      const rules = section.courseOffering.course.eligibilityRules;
      if (isRulesEmpty(normalizeCourseEligibilityRules(rules))) {
        eligible.push(section);
        continue;
      }
      const result = evaluateCourseEligibility(rules, ctx);
      if (result.eligible) {
        eligible.push(section);
      } else {
        ineligible.push({
          section,
          reasons: result.reasons,
          codes: result.codes,
        });
      }
    }

    return { eligible, ineligible };
  }

  private parseClass12Subjects(raw: unknown): Class12SubjectRecord[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((row): row is Class12SubjectRecord => {
        return (
          typeof row === 'object' &&
          row != null &&
          typeof (row as Class12SubjectRecord).name === 'string'
        );
      })
      .map((row) => ({
        name: row.name,
        code: row.code,
        marks: row.marks,
      }));
  }

  private async loadCompletedStudy(
    tenantId: string,
    studentId: string,
  ): Promise<CompletedStudyRecord[]> {
    const registrations = await this.prisma.semesterRegistration.findMany({
      where: {
        tenantId,
        studentId,
        status: 'completed',
      },
      include: {
        lines: {
          where: { status: 'confirmed' },
          include: {
            offering: {
              include: {
                course: {
                  include: { department: true },
                },
              },
            },
          },
        },
      },
    });

    const records: CompletedStudyRecord[] = [];
    for (const reg of registrations) {
      for (const line of reg.lines) {
        const course = line.offering?.course;
        if (!course) continue;
        records.push({
          subjectSlug: resolveCourseSubjectSlug(course),
          category: line.category ?? line.offering?.category ?? '',
          semesterSequence: reg.semesterSequence,
          courseId: course.id,
        });
      }
    }
    return records;
  }

  private async countStudentsInScope(
    tenantId: string,
    scope?: EligibilityStatsInput,
  ) {
    return this.prisma.student.count({
      where: this.studentScopeWhere(tenantId, scope),
    });
  }

  private async listStudentsForStats(
    tenantId: string,
    scope?: EligibilityStatsInput,
  ) {
    return this.prisma.student.findMany({
      where: this.studentScopeWhere(tenantId, scope),
      select: { id: true },
    });
  }

  private studentScopeWhere(tenantId: string, scope?: EligibilityStatsInput) {
    return {
      tenantId,
      deletedAt: null,
      ...(scope?.programVersionIds?.length
        ? { programVersionId: { in: scope.programVersionIds } }
        : {}),
      ...(scope?.institutionId
        ? {
            department: {
              institutionId: scope.institutionId,
              deletedAt: null,
            },
          }
        : {}),
    };
  }

  listAcademicSubjects(tenantId: string, institutionId?: string) {
    return this.prisma.academicSubject.findMany({
      where: {
        tenantId,
        deletedAt: null,
        isActive: true,
        ...(institutionId ? { institutionId } : {}),
      },
      select: {
        id: true,
        slug: true,
        name: true,
        programmeGroup: true,
        departmentId: true,
      },
      orderBy: { name: 'asc' },
    });
  }
}
