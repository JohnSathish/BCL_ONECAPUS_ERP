import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { LicenseEnforcementService } from '../../licensing/services/license-enforcement.service';
import { ExamCalendarSyncService } from '../exam-calendar-sync.service';
import { isIaExamType, IA_EXAM_TYPES } from './ia.constants';
import { IaAuditService } from './ia-audit.service';
import type {
  CreateIaExamDto,
  GenerateIaTimetableDto,
  PreviewIaExamDto,
} from './dto/create-ia-exam.dto';
import {
  assignFyugpFirstIaTimetable,
  inferFyugpRoutinePattern,
  type FyugpRoutinePattern,
} from './fyugp-first-ia-routine';
import {
  categoryPolicyFromMetadata,
  categoryPolicyToMetadata,
  filterOfferingsByCategoryPolicy,
  resolveCategoryPolicy,
  type SemesterCategoryMap,
} from './ia-category-policy';

const ACTIVE_VERSION_STATUSES = [
  'ACTIVE',
  'DRAFT',
  'PUBLISHED',
  'active',
  'published',
] as const;

const REGISTRATION_STATUSES = [
  'approved',
  'confirmed',
  'registered',
  'pending',
] as const;

type NormalizedExamInput = {
  name: string;
  semesterNos: number[];
  streamId?: string;
  departmentIds?: string[];
  programVersionId?: string;
  academicYearId?: string;
  shiftId?: string;
  examType: string;
  maxMarks: number;
  startDate?: string;
  endDate?: string;
  remarks?: string;
  /** null = legacy include-all; otherwise semester → enabled categories */
  categoryPolicy: SemesterCategoryMap | null;
};

@Injectable()
export class IaExamProvisioningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: IaAuditService,
    private readonly licenseEnforcement: LicenseEnforcementService,
    private readonly examCalendar: ExamCalendarSyncService,
  ) {}

  private timeDate(value: string) {
    return new Date(`1970-01-01T${value}`);
  }

  private addMinutes(time: string, minutes: number) {
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m + minutes;
    const nh = Math.floor(total / 60) % 24;
    const nm = total % 60;
    return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
  }

  private normalizeInput(dto: CreateIaExamDto): NormalizedExamInput {
    const departmentIds = [
      ...(dto.departmentIds ?? []),
      ...(dto.departmentId ? [dto.departmentId] : []),
    ].filter(Boolean);
    const uniqueDeptIds = [...new Set(departmentIds)];

    const semesterNos = [
      ...(dto.semesterNos ?? []),
      ...(dto.semesterNo ? [dto.semesterNo] : []),
    ];
    const uniqueSemesters = [...new Set(semesterNos)].sort((a, b) => a - b);

    if (!uniqueSemesters.length) {
      throw new BadRequestException('Select at least one semester');
    }

    const rawPolicy = dto.enabledCategoriesBySemester as
      | SemesterCategoryMap
      | undefined;
    const categoryPolicy = resolveCategoryPolicy(uniqueSemesters, rawPolicy);

    if (categoryPolicy) {
      for (const sem of uniqueSemesters) {
        if (!categoryPolicy[sem]?.length) {
          throw new BadRequestException(
            `Select at least one subject category for Semester ${sem}`,
          );
        }
      }
    }

    return {
      name: dto.name.trim(),
      semesterNos: uniqueSemesters,
      streamId: dto.streamId || undefined,
      departmentIds: uniqueDeptIds.length ? uniqueDeptIds : undefined,
      programVersionId: dto.programVersionId,
      academicYearId: dto.academicYearId,
      shiftId: dto.shiftId || undefined,
      examType: dto.examType,
      maxMarks: dto.maxMarks,
      startDate: dto.startDate,
      endDate: dto.endDate,
      remarks: dto.remarks,
      categoryPolicy,
    };
  }

  private async resolveAcademicYear(tenantId: string, academicYearId?: string) {
    if (academicYearId) {
      const year = await this.prisma.academicYear.findFirst({
        where: { id: academicYearId, tenantId, deletedAt: null },
      });
      if (!year) throw new NotFoundException('Academic year not found');
      return year;
    }
    const activeYear = await this.prisma.academicYear.findFirst({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      orderBy: { startDate: 'desc' },
    });
    if (!activeYear) {
      throw new BadRequestException('No active academic year configured');
    }
    return activeYear;
  }

  private async resolveProgramVersionIds(
    tenantId: string,
    input: Pick<NormalizedExamInput, 'programVersionId' | 'streamId'>,
  ) {
    if (input.programVersionId) return [input.programVersionId];

    const versions = await this.prisma.programVersion.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: [...ACTIVE_VERSION_STATUSES] },
        ...(input.streamId
          ? { structureTemplate: { streamId: input.streamId } }
          : {}),
      },
      select: { id: true },
    });

    return versions.map((v) => v.id);
  }

  private studentLineFilter(
    semesterNo: number,
    departmentIds?: string[],
    streamId?: string,
    shiftId?: string,
  ) {
    const studentBase = {
      deletedAt: null as null,
      ...(departmentIds?.length ? { departmentId: { in: departmentIds } } : {}),
      ...(streamId ? { academicProfile: { streamId } } : {}),
    };

    if (!shiftId) {
      return {
        status: { in: [...REGISTRATION_STATUSES] },
        registration: {
          semesterSequence: semesterNo,
          student: studentBase,
        },
      };
    }

    // Match shift on semester registration and/or student's primary shift.
    return {
      status: { in: [...REGISTRATION_STATUSES] },
      registration: {
        semesterSequence: semesterNo,
        OR: [
          { shiftId, student: studentBase },
          { student: { ...studentBase, primaryShiftId: shiftId } },
        ],
      },
    };
  }

  private async loadOfferings(
    tenantId: string,
    semesterNos: number[],
    programVersionIds: string[],
    scope?: { departmentIds?: string[]; streamId?: string },
  ) {
    const offeringInclude = {
      course: { select: { id: true, code: true, title: true } },
      programVersion: {
        select: {
          id: true,
          program: {
            select: { id: true, name: true, code: true, departmentId: true },
          },
        },
      },
    } as const;

    const programOfferings = programVersionIds.length
      ? await this.prisma.courseOffering.findMany({
          where: {
            tenantId,
            deletedAt: null,
            programVersionId: { in: programVersionIds },
            semesterSequence: { in: semesterNos },
          },
          include: offeringInclude,
          orderBy: [
            { semesterSequence: 'asc' },
            { category: 'asc' },
            { createdAt: 'asc' },
          ],
        })
      : [];

    const registeredLines = await this.prisma.semesterRegistrationLine.findMany(
      {
        where: {
          tenantId,
          status: { in: [...REGISTRATION_STATUSES] },
          registration: {
            semesterSequence: { in: semesterNos },
            student: {
              deletedAt: null,
              ...(scope?.departmentIds?.length
                ? { departmentId: { in: scope.departmentIds } }
                : {}),
              ...(scope?.streamId
                ? { academicProfile: { streamId: scope.streamId } }
                : {}),
            },
          },
        },
        select: { offeringId: true },
        distinct: ['offeringId'],
      },
    );

    const knownIds = new Set(programOfferings.map((o) => o.id));
    const extraIds = registeredLines
      .map((l) => l.offeringId)
      .filter((id) => !knownIds.has(id));

    if (!extraIds.length) return programOfferings;

    const extraOfferings = await this.prisma.courseOffering.findMany({
      where: {
        tenantId,
        deletedAt: null,
        id: { in: extraIds },
        semesterSequence: { in: semesterNos },
      },
      include: offeringInclude,
      orderBy: [
        { semesterSequence: 'asc' },
        { category: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    return [...programOfferings, ...extraOfferings];
  }

  private applyCategoryPolicy<
    T extends { semesterSequence?: number | null; category?: string | null },
  >(offerings: T[], policy: SemesterCategoryMap | null): T[] {
    return filterOfferingsByCategoryPolicy(offerings, policy);
  }

  private async countStudentsForOffering(
    tenantId: string,
    offeringId: string,
    semesterNo: number,
    departmentIds?: string[],
    streamId?: string,
    shiftId?: string,
  ) {
    return this.prisma.semesterRegistrationLine.count({
      where: {
        tenantId,
        offeringId,
        ...this.studentLineFilter(semesterNo, departmentIds, streamId, shiftId),
      },
    });
  }

  private async collectStudentIdsForOffering(
    tenantId: string,
    offeringId: string,
    semesterNo: number,
    departmentIds?: string[],
    streamId?: string,
    shiftId?: string,
  ) {
    const lines = await this.prisma.semesterRegistrationLine.findMany({
      where: {
        tenantId,
        offeringId,
        ...this.studentLineFilter(semesterNo, departmentIds, streamId, shiftId),
      },
      select: { registration: { select: { studentId: true } } },
    });
    return lines.map((l) => l.registration.studentId);
  }

  async listDepartmentsForStream(tenantId: string, streamId?: string) {
    const departments = await this.prisma.department.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: 'ACTIVE',
        departmentType: 'ACADEMIC',
      },
      orderBy: [{ name: 'asc' }],
      select: { id: true, name: true, code: true },
    });

    if (!streamId) return departments;

    const streamDeptIds = new Set<string>();

    const templates = await this.prisma.programStructureTemplate.findMany({
      where: {
        tenantId,
        streamId,
        programVersion: {
          deletedAt: null,
          status: { in: [...ACTIVE_VERSION_STATUSES] },
        },
      },
      select: {
        programVersion: {
          select: { program: { select: { departmentId: true } } },
        },
      },
    });
    for (const row of templates) {
      const deptId = row.programVersion?.program?.departmentId;
      if (deptId) streamDeptIds.add(deptId);
    }

    const studentDepts = await this.prisma.student.findMany({
      where: {
        tenantId,
        deletedAt: null,
        departmentId: { not: null },
        academicProfile: { streamId },
      },
      select: { departmentId: true },
      distinct: ['departmentId'],
    });
    for (const row of studentDepts) {
      if (row.departmentId) streamDeptIds.add(row.departmentId);
    }

    const filtered = departments.filter((d) => streamDeptIds.has(d.id));
    return filtered.length ? filtered : departments;
  }

  async previewExam(user: JwtUser, dto: PreviewIaExamDto) {
    const input = this.normalizeInput(dto);
    if (!isIaExamType(input.examType)) {
      throw new BadRequestException('Invalid IA exam type');
    }

    const academicYear = await this.resolveAcademicYear(
      user.tid,
      input.academicYearId,
    );
    const programVersionIds = await this.resolveProgramVersionIds(
      user.tid,
      input,
    );
    const offerings = this.applyCategoryPolicy(
      await this.loadOfferings(user.tid, input.semesterNos, programVersionIds, {
        departmentIds: input.departmentIds,
        streamId: input.streamId,
      }),
      input.categoryPolicy,
    );

    let streamName = 'All Streams';
    if (input.streamId) {
      const stream = await this.prisma.academicStream.findFirst({
        where: { id: input.streamId, tenantId: user.tid, deletedAt: null },
        select: { name: true },
      });
      streamName = stream?.name ?? 'Selected stream';
    }

    let shiftName: string | null = null;
    if (input.shiftId) {
      const shift = await this.prisma.shift.findFirst({
        where: { id: input.shiftId, tenantId: user.tid, deletedAt: null },
        select: { name: true },
      });
      if (!shift) throw new NotFoundException('Shift not found');
      shiftName = shift.name;
    }

    const departmentRows = await this.listDepartmentsForStream(
      user.tid,
      input.streamId,
    );
    const departmentCount =
      input.departmentIds?.length ?? departmentRows.length;

    const registeredStudentIds = new Set<string>();
    let subjectsWithStudents = 0;

    for (const offering of offerings) {
      const semesterNo = offering.semesterSequence ?? 0;
      if (!semesterNo) continue;

      const studentIds = await this.collectStudentIdsForOffering(
        user.tid,
        offering.id,
        semesterNo,
        input.departmentIds,
        input.streamId,
        input.shiftId,
      );
      if (studentIds.length) subjectsWithStudents += 1;
      for (const id of studentIds) registeredStudentIds.add(id);
    }

    return {
      examName: input.name,
      academicYear: academicYear.name,
      academicYearId: academicYear.id,
      semesters: input.semesterNos,
      streamId: input.streamId ?? null,
      streamName,
      shiftId: input.shiftId ?? null,
      shiftName,
      departmentCount,
      departmentIds: input.departmentIds ?? [],
      students: registeredStudentIds.size,
      subjects: offerings.length,
      subjectsWithStudents,
      maxMarks: input.maxMarks,
      examType: input.examType,
      programVersions: programVersionIds.length,
      ready: offerings.length > 0 && registeredStudentIds.size > 0,
      enabledCategoriesBySemester: categoryPolicyToMetadata(
        input.categoryPolicy,
      ),
      warnings:
        offerings.length === 0
          ? [
              input.categoryPolicy
                ? 'No subjects match the selected semesters, stream, and subject categories.'
                : 'No curriculum subjects found for the selected semesters and stream.',
            ]
          : registeredStudentIds.size === 0
            ? [
                input.shiftId
                  ? 'No registered students match the selected shift and filters.'
                  : 'No registered students match the selected filters.',
              ]
            : [],
    };
  }

  async createExam(user: JwtUser, dto: CreateIaExamDto) {
    await this.licenseEnforcement.assertWriteAllowed(
      user.tid,
      'examination.write',
    );
    const input = this.normalizeInput(dto);
    if (!isIaExamType(input.examType)) {
      throw new BadRequestException('Invalid IA exam type');
    }

    const preview = await this.previewExam(user, dto);
    if (!preview.ready) {
      throw new BadRequestException(preview.warnings.join(' '));
    }

    const academicYear = await this.resolveAcademicYear(
      user.tid,
      input.academicYearId,
    );
    const programVersionIds = await this.resolveProgramVersionIds(
      user.tid,
      input,
    );
    const offerings = this.applyCategoryPolicy(
      await this.loadOfferings(user.tid, input.semesterNos, programVersionIds, {
        departmentIds: input.departmentIds,
        streamId: input.streamId,
      }),
      input.categoryPolicy,
    );

    const examDate = input.startDate ? new Date(input.startDate) : new Date();
    const passMark = Math.ceil(input.maxMarks * 0.4);

    let shiftName: string | null = null;
    if (input.shiftId) {
      const shift = await this.prisma.shift.findFirst({
        where: { id: input.shiftId, tenantId: user.tid, deletedAt: null },
        select: { name: true },
      });
      if (!shift) throw new NotFoundException('Shift not found');
      shiftName = shift.name;
    }

    const session = await (this.prisma as any).examSession.create({
      data: {
        tenantId: user.tid,
        name: input.name,
        examType: input.examType,
        academicYearId: academicYear.id,
        shiftId: input.shiftId ?? null,
        semesterNo: input.semesterNos[0] ?? null,
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
        instructions: input.remarks,
        status: 'DRAFT',
        createdById: user.sub,
        metadata: {
          module: 'ia',
          simplified: true,
          wizard: true,
          semesterNos: input.semesterNos,
          streamId: input.streamId ?? null,
          streamName: preview.streamName,
          shiftId: input.shiftId ?? null,
          shiftName,
          departmentIds: input.departmentIds ?? [],
          departmentCount: preview.departmentCount,
          academicYearName: academicYear.name,
          maxMarks: input.maxMarks,
          studentsRegistered: preview.students,
          subjectsLoaded: preview.subjects,
          enabledCategoriesBySemester: categoryPolicyToMetadata(
            input.categoryPolicy,
          ),
        },
      },
    });

    const registeredStudentIds = new Set<string>();
    let papersCreated = 0;
    let schemesCreated = 0;

    for (const offering of offerings) {
      const semesterNo = offering.semesterSequence ?? 0;
      if (!semesterNo) continue;

      const studentCount = await this.countStudentsForOffering(
        user.tid,
        offering.id,
        semesterNo,
        input.departmentIds,
        input.streamId,
        input.shiftId,
      );
      if (studentCount === 0) continue;

      const departmentId =
        input.departmentIds?.length === 1
          ? input.departmentIds[0]
          : (offering.programVersion?.program?.departmentId ?? null);

      const scheme = await (this.prisma as any).iaAssessmentScheme.create({
        data: {
          tenantId: user.tid,
          name: `${input.name} — ${offering.course?.title ?? offering.course?.code}`,
          academicYearId: academicYear.id,
          departmentId,
          programmeId: offering.programVersion?.program?.id,
          courseId: offering.courseId,
          offeringId: offering.id,
          semesterNo,
          totalMaxMarks: input.maxMarks,
          passMark,
          status: 'ACTIVE',
          createdById: user.sub,
          components: {
            create: [
              {
                tenantId: user.tid,
                code: input.examType,
                label: input.name,
                maxMarks: input.maxMarks,
                isMandatory: true,
                sortOrder: 1,
              },
            ],
          },
        },
      });
      schemesCreated += 1;

      await (this.prisma as any).examPaperSchedule.create({
        data: {
          tenantId: user.tid,
          sessionId: session.id,
          paperCode: (offering.course?.code ?? 'SUB').trim().toUpperCase(),
          paperName:
            offering.course?.title ?? offering.course?.code ?? 'Subject',
          examDate,
          startTime: this.timeDate('10:00'),
          endTime: this.timeDate('12:00'),
          courseId: offering.courseId,
          offeringId: offering.id,
          semesterNo,
          expectedCount: studentCount,
          metadata: {
            module: 'ia',
            schemeId: scheme.id,
            category: offering.category,
            maxMarks: input.maxMarks,
            programmeCode: offering.programVersion?.program?.code,
          },
        },
      });
      papersCreated += 1;

      const studentIds = await this.collectStudentIdsForOffering(
        user.tid,
        offering.id,
        semesterNo,
        input.departmentIds,
        input.streamId,
        input.shiftId,
      );
      for (const id of studentIds) registeredStudentIds.add(id);
    }

    if (!papersCreated) {
      await (this.prisma as any).examSession.update({
        where: { id: session.id },
        data: { deletedAt: new Date() },
      });
      throw new BadRequestException(
        'No subjects with registered students matched your selection.',
      );
    }

    await (this.prisma as any).examSession.update({
      where: { id: session.id },
      data: {
        metadata: {
          ...(session.metadata as object),
          studentsRegistered: registeredStudentIds.size,
          subjectsLoaded: papersCreated,
        },
      },
    });

    await this.audit.log(user, 'IA_EXAM', session.id, 'CREATE', null, {
      session,
      papersCreated,
      schemesCreated,
      studentsRegistered: registeredStudentIds.size,
      subjectsLoaded: papersCreated,
      semesterNos: input.semesterNos,
      streamId: input.streamId,
      shiftId: input.shiftId,
    });

    void this.examCalendar.syncSession(user, session.id);

    return {
      session,
      summary: {
        subjectsLoaded: papersCreated,
        papersCreated,
        schemesCreated,
        studentsRegistered: registeredStudentIds.size,
        semesters: input.semesterNos,
        streamName: preview.streamName,
        departmentCount: preview.departmentCount,
        maxMarks: input.maxMarks,
      },
    };
  }

  async listExamsWithSummary(tenantId: string) {
    const sessions = await (this.prisma as any).examSession.findMany({
      where: {
        tenantId,
        deletedAt: null,
        examType: { in: [...IA_EXAM_TYPES] },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    });

    const enriched = [];
    for (const session of sessions) {
      const meta = (session.metadata ?? {}) as {
        semesterNos?: number[];
        streamName?: string;
        shiftName?: string;
        departmentCount?: number;
        studentsRegistered?: number;
        subjectsLoaded?: number;
        maxMarks?: number;
        programmeName?: string;
      };

      const papers = await (this.prisma as any).examPaperSchedule.findMany({
        where: { tenantId, sessionId: session.id, deletedAt: null },
        select: {
          id: true,
          expectedCount: true,
          metadata: true,
        },
      });

      const schemeIds = papers
        .map((p: { metadata?: { schemeId?: string } }) => p.metadata?.schemeId)
        .filter(Boolean) as string[];

      const marksEntered = schemeIds.length
        ? await (this.prisma as any).iaComponentMark.count({
            where: {
              tenantId,
              component: { schemeId: { in: schemeIds } },
              OR: [{ marks: { not: null } }, { isAbsent: true }],
            },
          })
        : 0;

      const totalExpected = papers.reduce(
        (sum: number, p: { expectedCount: number }) =>
          sum + (p.expectedCount ?? 0),
        0,
      );
      const registeredStudents =
        meta.studentsRegistered ??
        papers.reduce(
          (max: number, p: { expectedCount: number }) =>
            Math.max(max, p.expectedCount ?? 0),
          0,
        );

      enriched.push({
        ...session,
        stats: {
          subjectsScheduled: papers.length,
          expectedRegistrations: totalExpected,
          registeredStudents,
          marksEntered,
          marksPending: Math.max(0, totalExpected - marksEntered),
          completionPercent:
            totalExpected > 0
              ? Math.round((marksEntered / totalExpected) * 100)
              : 0,
          semesterNos:
            meta.semesterNos ??
            (session.semesterNo ? [session.semesterNo] : []),
          streamName: meta.streamName ?? 'All Streams',
          shiftName: meta.shiftName ?? null,
          departmentCount: meta.departmentCount ?? 0,
          maxMarks: meta.maxMarks,
        },
      });
    }
    return enriched;
  }

  async generateTimetable(user: JwtUser, dto: GenerateIaTimetableDto) {
    await this.licenseEnforcement.assertWriteAllowed(
      user.tid,
      'examination.write',
    );
    const session = await (this.prisma as any).examSession.findFirst({
      where: { id: dto.sessionId, tenantId: user.tid, deletedAt: null },
    });
    if (!session) throw new NotFoundException('IA exam not found');

    const papers = await (this.prisma as any).examPaperSchedule.findMany({
      where: { tenantId: user.tid, sessionId: dto.sessionId, deletedAt: null },
      orderBy: [{ paperCode: 'asc' }],
    });
    if (!papers.length) {
      throw new BadRequestException('No subjects scheduled for this exam');
    }

    const mode = dto.mode ?? 'SIMPLE';
    let updated = 0;
    let warnings: string[] = [];
    let endDate = new Date(dto.startDate);

    if (mode === 'FYUGP_FIRST_IA') {
      const meta = (session.metadata ?? {}) as Record<string, unknown>;
      let shiftName =
        typeof meta.shiftName === 'string' ? meta.shiftName : null;
      if (!shiftName && session.shiftId) {
        const shift = await this.prisma.shift.findFirst({
          where: {
            id: session.shiftId,
            tenantId: user.tid,
            deletedAt: null,
          },
          select: { name: true },
        });
        shiftName = shift?.name ?? null;
      }
      const pattern: FyugpRoutinePattern =
        dto.routinePattern ?? inferFyugpRoutinePattern(shiftName);

      const {
        assignments,
        warnings: assignWarnings,
        maxDayOffset,
      } = assignFyugpFirstIaTimetable(
        papers.map(
          (p: {
            id: string;
            paperCode: string;
            semesterNo: number | null;
            metadata?: { category?: string; programmeCode?: string };
          }) => {
            const meta =
              p.metadata && typeof p.metadata === 'object'
                ? (p.metadata as Record<string, unknown>)
                : {};
            return {
              id: p.id,
              paperCode: p.paperCode,
              semesterNo: p.semesterNo,
              category: meta.category != null ? String(meta.category) : null,
              programmeCode:
                meta.programmeCode != null ? String(meta.programmeCode) : null,
            };
          },
        ),
        pattern,
      );
      warnings = assignWarnings;

      for (const a of assignments) {
        const [y, m, d] = dto.startDate.split('-').map(Number);
        const examDate = new Date(y, m - 1, d + a.dayOffset);
        await (this.prisma as any).examPaperSchedule.update({
          where: { id: a.paperId },
          data: {
            examDate,
            startTime: this.timeDate(a.startTime),
            endTime: this.timeDate(a.endTime),
          },
        });
        updated += 1;
      }

      const [ey, em, ed] = dto.startDate.split('-').map(Number);
      endDate = new Date(ey, em - 1, ed + maxDayOffset);

      await (this.prisma as any).examSession.update({
        where: { id: dto.sessionId },
        data: {
          startDate: new Date(ey, em - 1, ed),
          endDate,
          metadata: {
            ...(session.metadata as object),
            timetableMode: mode,
            routinePattern: pattern,
          },
        },
      });
    } else {
      const duration = dto.durationMinutes ?? 120;
      const startTime = dto.defaultStartTime ?? '10:00';
      let dayOffset = 0;
      let slotIndex = 0;
      const maxPerDay = 3;

      for (const paper of papers) {
        const examDate = new Date(dto.startDate);
        examDate.setDate(examDate.getDate() + dayOffset);
        const slotStart = this.addMinutes(
          startTime,
          slotIndex * (duration + 30),
        );

        await (this.prisma as any).examPaperSchedule.update({
          where: { id: paper.id },
          data: {
            examDate,
            startTime: this.timeDate(slotStart),
            endTime: this.timeDate(this.addMinutes(slotStart, duration)),
          },
        });

        slotIndex += 1;
        if (slotIndex >= maxPerDay) {
          slotIndex = 0;
          dayOffset += 1;
        }
        updated += 1;
      }
      endDate = new Date(dto.startDate);
      endDate.setDate(endDate.getDate() + dayOffset);
    }

    await this.audit.log(
      user,
      'IA_TIMETABLE',
      dto.sessionId,
      'GENERATE',
      null,
      {
        papers: papers.length,
        updated,
        startDate: dto.startDate,
        mode,
        warnings,
      },
    );

    void this.examCalendar.syncSession(user, dto.sessionId);

    return { updated, warnings, mode };
  }

  /**
   * Ensure every offering with registered students in the exam semester has a
   * scheduled paper. Fills gaps when registrations were added after exam creation.
   */
  async syncSessionPapersFromRegistrations(
    tenantId: string,
    sessionId: string,
  ) {
    const session = await (this.prisma as any).examSession.findFirst({
      where: { id: sessionId, tenantId, deletedAt: null },
    });
    if (!session) return { added: 0 };

    const meta = (session.metadata ?? {}) as Record<string, unknown>;
    const departmentIds = meta.departmentIds as string[] | undefined;
    const streamId = meta.streamId as string | undefined;
    const shiftId =
      (meta.shiftId as string | undefined) ??
      (session.shiftId as string | undefined);
    const maxMarks = (meta.maxMarks as number | undefined) ?? 20;
    const passMark = Math.ceil(maxMarks * 0.4);
    const semesterNosFromMeta = Array.isArray(meta.semesterNos)
      ? (meta.semesterNos as number[]).map(Number).filter(Boolean)
      : [];
    const semesterNos = semesterNosFromMeta.length
      ? semesterNosFromMeta
      : session.semesterNo
        ? [session.semesterNo as number]
        : [];
    if (!semesterNos.length) return { added: 0 };

    const categoryPolicy = categoryPolicyFromMetadata(meta, semesterNos);
    const examDate = session.startDate
      ? new Date(session.startDate)
      : new Date();

    const existingPapers = await (
      this.prisma as any
    ).examPaperSchedule.findMany({
      where: { tenantId, sessionId, deletedAt: null },
      select: { offeringId: true },
    });
    const existingOfferingIds = new Set(
      existingPapers
        .map((p: { offeringId: string | null }) => p.offeringId)
        .filter(Boolean),
    );

    const registeredLines = await this.prisma.semesterRegistrationLine.findMany(
      {
        where: {
          tenantId,
          OR: semesterNos.map((semesterNo) =>
            this.studentLineFilter(
              semesterNo,
              departmentIds,
              streamId,
              shiftId,
            ),
          ),
        },
        select: { offeringId: true },
        distinct: ['offeringId'],
      },
    );

    const missingIds = registeredLines
      .map((l) => l.offeringId)
      .filter((id) => !existingOfferingIds.has(id));
    if (!missingIds.length) return { added: 0 };

    const offeringsRaw = await this.prisma.courseOffering.findMany({
      where: { tenantId, deletedAt: null, id: { in: missingIds } },
      include: {
        course: { select: { id: true, code: true, title: true } },
        programVersion: {
          select: {
            program: { select: { id: true, code: true, departmentId: true } },
          },
        },
      },
    });
    const offerings = this.applyCategoryPolicy(offeringsRaw, categoryPolicy);

    let added = 0;
    for (const offering of offerings) {
      const semesterNo = offering.semesterSequence ?? semesterNos[0];
      if (!semesterNo) continue;

      const studentCount = await this.countStudentsForOffering(
        tenantId,
        offering.id,
        semesterNo,
        departmentIds,
        streamId,
        shiftId,
      );
      if (studentCount === 0) continue;

      const departmentId =
        departmentIds?.length === 1
          ? departmentIds[0]
          : (offering.programVersion?.program?.departmentId ?? null);

      const scheme = await (this.prisma as any).iaAssessmentScheme.create({
        data: {
          tenantId,
          name: `${session.name} — ${offering.course?.title ?? offering.course?.code}`,
          academicYearId: session.academicYearId,
          departmentId,
          programmeId: offering.programVersion?.program?.id,
          courseId: offering.courseId,
          offeringId: offering.id,
          semesterNo,
          totalMaxMarks: maxMarks,
          passMark,
          status: 'ACTIVE',
          createdById: session.createdById,
          components: {
            create: [
              {
                tenantId,
                code: session.examType,
                label: session.name,
                maxMarks,
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
          paperCode: (offering.course?.code ?? 'SUB').trim().toUpperCase(),
          paperName:
            offering.course?.title ?? offering.course?.code ?? 'Subject',
          examDate,
          startTime: this.timeDate('10:00'),
          endTime: this.timeDate('12:00'),
          courseId: offering.courseId,
          offeringId: offering.id,
          semesterNo,
          expectedCount: studentCount,
          metadata: {
            module: 'ia',
            schemeId: scheme.id,
            category: offering.category,
            maxMarks,
            programmeCode: offering.programVersion?.program?.code,
            syncedFromRegistrations: true,
          },
        },
      });
      added += 1;
    }

    if (added > 0) {
      const paperCount = await (this.prisma as any).examPaperSchedule.count({
        where: { tenantId, sessionId, deletedAt: null },
      });
      await (this.prisma as any).examSession.update({
        where: { id: sessionId },
        data: {
          metadata: {
            ...meta,
            subjectsLoaded: paperCount,
          },
        },
      });
    }

    return { added };
  }
}
