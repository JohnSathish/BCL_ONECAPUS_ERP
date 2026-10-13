import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { LicenseEnforcementService } from '../../licensing/services/license-enforcement.service';
import { ExamCalendarSyncService } from '../exam-calendar-sync.service';
import { registrationPaperTitle } from '../../academic-engine/domain/offering-paper-title';
import { normalizeIaSubjectCategory } from './ia-category-policy';
import { refreshExamPaperNames } from './ia-paper-names';
import { IA_EXAM_TYPES, isIaExamType } from './ia.constants';
import { IaAuditService } from './ia-audit.service';
import type {
  IaPaperDto,
  IaQueryDto,
  IaSessionDto,
  RescheduleIaPapersDto,
  UpdateIaPaperScheduleDto,
} from './dto/ia.dto';

@Injectable()
export class IaSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: IaAuditService,
    private readonly licenseEnforcement: LicenseEnforcementService,
    private readonly examCalendar: ExamCalendarSyncService,
  ) {}

  private timeDate(value: string) {
    const d = new Date(`1970-01-01T${value}`);
    return d;
  }

  /** Store a wall clock as UTC so the office sees the same hours it typed. */
  private wallClock(value: string) {
    const match = value.match(/^(\d{2}):(\d{2})$/);
    const hours = Number(match?.[1] ?? 0);
    const minutes = Number(match?.[2] ?? 0);
    return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));
  }

  private assertClockOrder(startTime: string, endTime: string) {
    if (startTime >= endTime) {
      throw new BadRequestException(
        'The end time must be later than the start time.',
      );
    }
  }

  listSessions(tenantId: string, query: IaQueryDto) {
    return (this.prisma as any).examSession.findMany({
      where: {
        tenantId,
        deletedAt: null,
        examType: { in: [...IA_EXAM_TYPES] },
        ...(query.status ? { status: query.status } : {}),
        ...(query.semesterNo ? { semesterNo: query.semesterNo } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 200,
    });
  }

  async createSession(user: JwtUser, dto: IaSessionDto) {
    await this.licenseEnforcement.assertWriteAllowed(
      user.tid,
      'examination.write',
    );
    if (!isIaExamType(dto.examType)) {
      throw new BadRequestException('Invalid IA exam type');
    }
    const row = await (this.prisma as any).examSession.create({
      data: {
        tenantId: user.tid,
        name: dto.name.trim(),
        examType: dto.examType,
        academicYearId: dto.academicYearId,
        shiftId: dto.shiftId,
        semesterNo: dto.semesterNo,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        instructions: dto.instructions,
        status: 'DRAFT',
        createdById: user.sub,
        metadata: { module: 'ia' },
      },
    });
    await this.audit.log(user, 'IA_SESSION', row.id, 'CREATE', null, row);
    void this.examCalendar.syncSession(user, row.id);
    return row;
  }

  async offeringLabels(
    tenantId: string,
    offeringIds: Array<string | null | undefined>,
  ) {
    const ids = [
      ...new Set(offeringIds.filter((id): id is string => Boolean(id))),
    ];
    const rows = ids.length
      ? await this.prisma.courseOffering.findMany({
          where: { tenantId, id: { in: ids } },
          select: {
            id: true,
            category: true,
            programVersion: {
              select: {
                program: {
                  select: { code: true, name: true, departmentId: true },
                },
              },
            },
          },
        })
      : [];
    return new Map(
      rows.map((row) => [
        row.id,
        {
          category: row.category,
          programmeCode: row.programVersion?.program?.code ?? null,
          programmeName: row.programVersion?.program?.name ?? null,
          programmeDepartmentId:
            row.programVersion?.program?.departmentId ?? null,
        },
      ]),
    );
  }

  /** Component-code signature so two different assessments of one subject stay apart. */
  async assessmentSignatures(
    tenantId: string,
    papers: Array<{ id: string; metadata?: unknown }>,
  ) {
    const schemeIds = [
      ...new Set(
        papers
          .map((paper) => {
            const meta = (paper.metadata ?? {}) as { schemeId?: string };
            return meta.schemeId;
          })
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const components = schemeIds.length
      ? await this.prisma.iaAssessmentComponent.findMany({
          where: { tenantId, schemeId: { in: schemeIds } },
          select: { schemeId: true, code: true },
        })
      : [];
    const codesByScheme = new Map<string, string[]>();
    for (const row of components) {
      const list = codesByScheme.get(row.schemeId) ?? [];
      list.push(row.code.trim().toUpperCase());
      codesByScheme.set(row.schemeId, list);
    }
    const byPaper = new Map<string, string>();
    for (const paper of papers) {
      const schemeId = ((paper.metadata ?? {}) as { schemeId?: string })
        .schemeId;
      const codes = schemeId ? (codesByScheme.get(schemeId) ?? []) : [];
      byPaper.set(paper.id, [...codes].sort().join('+'));
    }
    return byPaper;
  }

  /**
   * Major and Minor are different question papers. Semester 1 often registers
   * minor students on the major offering, so the exam has only a Major paper.
   * Add the missing category paper without moving marks or registrations.
   */
  async ensureMajorMinorPapers(tenantId: string, sessionId: string) {
    const papers = await (this.prisma as any).examPaperSchedule.findMany({
      where: { tenantId, sessionId, deletedAt: null },
    });
    if (!papers.length) return 0;
    const courseIds = [
      ...new Set(
        papers
          .map((paper: { courseId?: string | null }) => paper.courseId)
          .filter((id: string | null | undefined): id is string => Boolean(id)),
      ),
    ] as string[];
    const semesters = [
      ...new Set(
        papers
          .map((paper: { semesterNo?: number | null }) => paper.semesterNo)
          .filter(
            (semester: number | null | undefined): semester is number =>
              semester != null,
          ),
      ),
    ] as number[];
    if (!courseIds.length || !semesters.length) return 0;

    const offeringIds = [
      ...new Set(
        papers
          .map((paper: { offeringId?: string | null }) => paper.offeringId)
          .filter((id: string | null | undefined): id is string => Boolean(id)),
      ),
    ] as string[];
    const [paperOfferings, courseOfferings, lineGroups] = await Promise.all([
      offeringIds.length
        ? this.prisma.courseOffering.findMany({
            where: { tenantId, id: { in: offeringIds } },
            select: { id: true, category: true },
          })
        : [],
      this.prisma.courseOffering.findMany({
        where: {
          tenantId,
          deletedAt: null,
          courseId: { in: courseIds },
          semesterSequence: { in: semesters },
        },
        select: {
          id: true,
          courseId: true,
          semesterSequence: true,
          titleOverride: true,
          course: { select: { code: true, title: true, departmentId: true } },
        },
      }),
      this.prisma.semesterRegistrationLine.groupBy({
        by: ['offeringId', 'category'],
        where: {
          tenantId,
          status: { in: ['approved', 'confirmed', 'registered', 'pending'] },
          registration: { semesterSequence: { in: semesters } },
          offering: {
            deletedAt: null,
            courseId: { in: courseIds },
            semesterSequence: { in: semesters },
          },
        },
        _count: { _all: true },
      }),
    ]);
    const offeringCategory = new Map(
      paperOfferings.map((row) => [
        row.id,
        normalizeIaSubjectCategory(row.category),
      ]),
    );
    const offeringInfo = new Map(courseOfferings.map((row) => [row.id, row]));
    const paperKey = (
      semesterNo: number | null | undefined,
      code: string,
      category: string | null,
    ) => `${semesterNo ?? ''}|${code.trim().toUpperCase()}|${category ?? ''}`;
    const present = new Set<string>();
    for (const paper of papers as Array<{
      offeringId?: string | null;
      semesterNo?: number | null;
      paperCode?: string | null;
      metadata?: { category?: string } | null;
    }>) {
      const category =
        (paper.offeringId
          ? offeringCategory.get(paper.offeringId)
          : undefined) ?? normalizeIaSubjectCategory(paper.metadata?.category);
      present.add(paperKey(paper.semesterNo, paper.paperCode ?? '', category));
    }

    let created = 0;
    const seen = new Set<string>();
    for (const group of lineGroups) {
      const category = normalizeIaSubjectCategory(group.category);
      if (category !== 'MAJOR' && category !== 'MINOR') continue;
      const offering = offeringInfo.get(group.offeringId);
      if (!offering?.course) continue;
      const key = paperKey(
        offering.semesterSequence,
        offering.course.code,
        category,
      );
      if (present.has(key) || seen.has(key)) continue;
      seen.add(key);
      const sibling = (
        papers as Array<{
          courseId?: string | null;
          semesterNo?: number | null;
          paperCode?: string | null;
          paperName?: string | null;
          examDate: Date;
          startTime: Date;
          endTime: Date;
          metadata?: { schemeId?: string; maxMarks?: number } | null;
        }>
      ).find(
        (paper) =>
          paper.courseId === offering.courseId &&
          paper.semesterNo === offering.semesterSequence,
      );
      if (!sibling) continue;
      const already = await (this.prisma as any).examPaperSchedule.findFirst({
        where: {
          tenantId,
          sessionId,
          deletedAt: null,
          courseId: offering.courseId,
          semesterNo: offering.semesterSequence,
          offeringId: null,
          metadata: { path: ['category'], equals: category },
        },
      });
      if (already) {
        present.add(key);
        continue;
      }
      const schemeMeta = sibling.metadata ?? {};
      const siblingScheme = schemeMeta.schemeId
        ? await this.prisma.iaAssessmentScheme.findFirst({
            where: { id: schemeMeta.schemeId, tenantId },
            include: { components: { orderBy: { sortOrder: 'asc' }, take: 1 } },
          })
        : null;
      const component = siblingScheme?.components[0];
      const maxMarks = Number(
        schemeMeta.maxMarks ??
          siblingScheme?.totalMaxMarks ??
          component?.maxMarks ??
          0,
      );
      const scheme = await this.prisma.iaAssessmentScheme.create({
        data: {
          tenantId,
          name: `${sibling.paperCode} ${category}`,
          academicYearId: siblingScheme?.academicYearId,
          departmentId: offering.course.departmentId,
          courseId: offering.courseId,
          semesterNo: offering.semesterSequence,
          totalMaxMarks: maxMarks || 15,
          passMark: siblingScheme?.passMark,
          status: 'ACTIVE',
          components: {
            create: [
              {
                tenantId,
                code: component?.code ?? 'IA',
                label: component?.label ?? sibling.paperName ?? category,
                maxMarks: component?.maxMarks ?? (maxMarks || 15),
                isMandatory: true,
                sortOrder: 1,
              },
            ],
          },
        },
      });
      await (this.prisma as any).examPaperSchedule.create({
        data: {
          tenantId,
          sessionId,
          courseId: offering.courseId,
          paperCode: (offering.course.code || sibling.paperCode || '')
            .trim()
            .toUpperCase(),
          paperName:
            registrationPaperTitle(
              offering.course,
              { titleOverride: offering.titleOverride },
              category,
            ) ||
            sibling.paperName ||
            offering.course.title,
          examDate: sibling.examDate,
          startTime: sibling.startTime,
          endTime: sibling.endTime,
          semesterNo: offering.semesterSequence,
          expectedCount: group._count._all,
          metadata: {
            module: 'ia',
            schemeId: scheme.id,
            category,
            maxMarks: Number(component?.maxMarks ?? maxMarks ?? 15),
            separateQuestionPaper: true,
          },
        },
      });
      present.add(key);
      created += 1;
    }
    return created;
  }

  async listPapers(tenantId: string, query: IaQueryDto) {
    if (query.sessionId) {
      await this.ensureMajorMinorPapers(tenantId, query.sessionId);
      await refreshExamPaperNames(this.prisma, tenantId, query.sessionId);
    }
    const papers = await (this.prisma as any).examPaperSchedule.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(query.sessionId ? { sessionId: query.sessionId } : {}),
        ...(query.semesterNo ? { semesterNo: query.semesterNo } : {}),
      },
      orderBy: [
        { examDate: 'asc' },
        { startTime: 'asc' },
        { paperCode: 'asc' },
      ],
      take: query.sessionId ? 1000 : 500,
    });
    const offeringLabels = await this.offeringLabels(
      tenantId,
      papers.map((paper: { offeringId?: string | null }) => paper.offeringId),
    );
    const courseIds: string[] = [
      ...new Set(
        (papers as Array<{ courseId?: string | null }>)
          .map((paper) => paper.courseId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const courses = courseIds.length
      ? await this.prisma.course.findMany({
          where: { tenantId, id: { in: courseIds } },
          select: {
            id: true,
            code: true,
            title: true,
            credits: true,
            courseType: true,
            departmentId: true,
            department: { select: { id: true, name: true } },
          },
        })
      : [];
    const courseById = new Map(courses.map((course) => [course.id, course]));
    const assessmentKeys = await this.assessmentSignatures(tenantId, papers);
    return papers
      .map(
        (paper: {
          id: string;
          courseId?: string | null;
          offeringId?: string | null;
          metadata?: { category?: string; programmeCode?: string } | null;
        }) => {
          const course = paper.courseId ? courseById.get(paper.courseId) : null;
          const offering = paper.offeringId
            ? offeringLabels.get(paper.offeringId)
            : undefined;
          const meta = paper.metadata ?? {};
          return {
            ...paper,
            category: offering?.category ?? meta.category ?? null,
            programmeCode:
              offering?.programmeCode ?? meta.programmeCode ?? null,
            programmeName: offering?.programmeName ?? null,
            assessmentKey: assessmentKeys.get(paper.id) ?? '',
            course: course
              ? {
                  id: course.id,
                  code: course.code,
                  title: course.title,
                  credits:
                    course.credits != null ? Number(course.credits) : null,
                  courseType: course.courseType,
                  departmentId: course.department?.id ?? course.departmentId,
                  departmentName: course.department?.name ?? null,
                }
              : null,
          };
        },
      )
      .filter(
        (paper: { category?: string | null }) =>
          normalizeIaSubjectCategory(paper.category) !== 'INTERNSHIP',
      );
  }

  async createPaper(user: JwtUser, dto: IaPaperDto) {
    await this.licenseEnforcement.assertWriteAllowed(
      user.tid,
      'examination.write',
    );
    const session = await (this.prisma as any).examSession.findFirst({
      where: { id: dto.sessionId, tenantId: user.tid, deletedAt: null },
    });
    if (!session || !isIaExamType(session.examType)) {
      throw new NotFoundException('IA session not found');
    }
    const row = await (this.prisma as any).examPaperSchedule.create({
      data: {
        tenantId: user.tid,
        sessionId: dto.sessionId,
        paperCode: dto.paperCode.trim().toUpperCase(),
        paperName: dto.paperName.trim(),
        examDate: new Date(dto.examDate),
        startTime: this.timeDate(dto.startTime),
        endTime: this.timeDate(dto.endTime),
        courseId: dto.courseId,
        offeringId: dto.offeringId,
        semesterNo: dto.semesterNo ?? session.semesterNo,
        expectedCount: dto.expectedCount ?? 0,
        metadata: { module: 'ia', maxMarks: dto.maxMarks ?? null },
      },
    });
    await this.audit.log(user, 'IA_PAPER', row.id, 'CREATE', null, row);
    void this.examCalendar.syncSession(user, dto.sessionId);
    return row;
  }

  async updatePaperSchedule(
    user: JwtUser,
    paperId: string,
    dto: UpdateIaPaperScheduleDto,
  ) {
    await this.licenseEnforcement.assertWriteAllowed(
      user.tid,
      'examination.write',
    );
    this.assertClockOrder(dto.startTime, dto.endTime);
    const paper = await this.getPaper(user.tid, paperId);
    const row = await (this.prisma as any).examPaperSchedule.update({
      where: { id: paper.id },
      data: {
        examDate: new Date(dto.examDate),
        startTime: this.wallClock(dto.startTime),
        endTime: this.wallClock(dto.endTime),
      },
    });
    await this.audit.log(user, 'IA_PAPER', paper.id, 'RESCHEDULE', paper, row);
    void this.examCalendar.syncSession(user, paper.sessionId);
    return row;
  }

  async reschedulePapers(user: JwtUser, dto: RescheduleIaPapersDto) {
    await this.licenseEnforcement.assertWriteAllowed(
      user.tid,
      'examination.write',
    );
    const session = await (this.prisma as any).examSession.findFirst({
      where: { id: dto.sessionId, tenantId: user.tid, deletedAt: null },
    });
    if (!session || !isIaExamType(session.examType)) {
      throw new NotFoundException('IA session not found');
    }
    if (!dto.papers.length) {
      throw new BadRequestException('Choose at least one paper to reschedule.');
    }
    for (const paper of dto.papers)
      this.assertClockOrder(paper.startTime, paper.endTime);
    const existing = await (this.prisma as any).examPaperSchedule.findMany({
      where: {
        tenantId: user.tid,
        sessionId: dto.sessionId,
        deletedAt: null,
        id: { in: dto.papers.map((paper) => paper.id) },
      },
      select: { id: true },
    });
    const allowed = new Set(existing.map((paper: { id: string }) => paper.id));
    const rows = dto.papers.filter((paper) => allowed.has(paper.id));
    if (!rows.length) throw new NotFoundException('IA paper not found');
    await this.prisma.$transaction(
      rows.map((paper) =>
        (this.prisma as any).examPaperSchedule.update({
          where: { id: paper.id },
          data: {
            examDate: new Date(paper.examDate),
            startTime: this.wallClock(paper.startTime),
            endTime: this.wallClock(paper.endTime),
          },
        }),
      ),
    );
    await this.audit.log(
      user,
      'IA_SESSION',
      dto.sessionId,
      'RESCHEDULE',
      null,
      {
        updated: rows.length,
      },
    );
    void this.examCalendar.syncSession(user, dto.sessionId);
    return { updated: rows.length };
  }

  async getPaper(tenantId: string, paperId: string) {
    const paper = await (this.prisma as any).examPaperSchedule.findFirst({
      where: { id: paperId, tenantId, deletedAt: null },
    });
    if (!paper) throw new NotFoundException('IA paper not found');
    return paper;
  }
}
