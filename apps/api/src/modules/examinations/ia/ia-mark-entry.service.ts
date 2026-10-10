import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { toPublicUploadUrl } from '../../../common/uploads/public-upload-url';
import {
  buildIaMarkImportWorkbook,
  parseIaMarkImportWorkbook,
  safeWorkbookName,
} from './ia-mark-import-workbook';
import { IaAuditService } from './ia-audit.service';
import { IaSchemeService } from './ia-scheme.service';
import { IaSessionService } from './ia-session.service';
import { IaWorkflowService } from './ia-workflow.service';
import type { SaveIaMarksDto } from './dto/ia.dto';

const rosterStudentSelect = {
  id: true,
  rollNumber: true,
  enrollmentNumber: true,
  primaryShift: { select: { id: true, name: true } },
  masterProfile: { select: { fullName: true } },
  user: { select: { displayName: true } },
} as const;

function rosterStudentName(student: {
  masterProfile?: { fullName?: string | null } | null;
  user?: { displayName?: string | null } | null;
}) {
  const fromProfile = student.masterProfile?.fullName?.trim();
  const fromAccount = student.user?.displayName?.trim();
  return fromProfile || fromAccount || null;
}

@Injectable()
export class IaMarkEntryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: IaAuditService,
    private readonly schemes: IaSchemeService,
    private readonly sessions: IaSessionService,
    private readonly workflow: IaWorkflowService,
  ) {}

  async resolveStaffProfile(tenantId: string, userId: string) {
    return this.prisma.staffProfile.findFirst({
      where: { tenantId, portalUserId: userId, deletedAt: null },
    });
  }

  async facultyMySubjects(user: JwtUser) {
    const staff = await this.resolveStaffProfile(user.tid, user.sub);
    if (!staff) return [];

    const assignments = await this.prisma.subjectTeachingAssignment.findMany({
      where: {
        tenantId: user.tid,
        staffProfileId: staff.id,
        deletedAt: null,
        canEnterInternalMarks: true,
      },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            title: true,
            credits: true,
            courseType: true,
            departmentId: true,
            department: { select: { id: true, name: true } },
          },
        },
        offeringSection: { select: { id: true, sectionCode: true } },
        programVersion: {
          select: { id: true, program: { select: { name: true, code: true } } },
        },
      },
      orderBy: [{ semesterNo: 'asc' }],
    });

    const papers = await (this.prisma as any).examPaperSchedule.findMany({
      where: {
        tenantId: user.tid,
        deletedAt: null,
        courseId: { in: assignments.map((a) => a.courseId) },
      },
      orderBy: [{ examDate: 'asc' }],
    });
    const sessionIds = [
      ...new Set(papers.map((paper: { sessionId: string }) => paper.sessionId)),
    ];
    const sessions = sessionIds.length
      ? await (this.prisma as any).examSession.findMany({
          where: {
            tenantId: user.tid,
            id: { in: sessionIds },
            deletedAt: null,
          },
          select: {
            id: true,
            name: true,
            examType: true,
            academicYearId: true,
            status: true,
            metadata: true,
          },
        })
      : [];
    const yearIds: string[] = [
      ...new Set(
        (sessions as Array<{ academicYearId?: string | null }>)
          .map((session) => session.academicYearId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const years = yearIds.length
      ? await this.prisma.academicYear.findMany({
          where: { id: { in: yearIds } },
          select: { id: true, name: true },
        })
      : [];
    const sessionById = new Map(
      sessions.map((session: { id: string }) => [session.id, session]),
    );
    const yearById = new Map(years.map((year) => [year.id, year.name]));

    return assignments.map((a) => ({
      assignmentId: a.id,
      courseId: a.courseId,
      courseCode: a.course.code,
      courseName: a.course.title,
      credits: a.course.credits != null ? Number(a.course.credits) : null,
      courseType: a.course.courseType,
      departmentId: a.course.department?.id ?? a.course.departmentId,
      departmentName: a.course.department?.name ?? null,
      semesterNo: a.semesterNo,
      sectionCode: a.sectionCode ?? a.offeringSection?.sectionCode,
      programmeName: a.programVersion?.program?.name,
      papers: papers
        .filter((p: { courseId?: string }) => p.courseId === a.courseId)
        .map((paper: { sessionId: string }) => {
          const session = sessionById.get(paper.sessionId) as
            | {
                name?: string;
                examType?: string;
                academicYearId?: string | null;
                status?: string;
                metadata?: { shiftName?: string; academicYearName?: string };
              }
            | undefined;
          return {
            ...paper,
            sessionName: session?.name ?? null,
            examType: session?.examType ?? null,
            academicYearId: session?.academicYearId ?? null,
            academicYearName:
              session?.metadata?.academicYearName ??
              (session?.academicYearId
                ? yearById.get(session.academicYearId)
                : null) ??
              null,
            sessionStatus: session?.status ?? null,
            shiftName: session?.metadata?.shiftName ?? null,
          };
        }),
    }));
  }

  private async assertCanEditMarks(user: JwtUser, paperId: string) {
    const editable = await this.workflow.canEditMarks(user.tid, paperId);
    if (!editable) {
      throw new ForbiddenException(
        'Marks are locked pending approval workflow',
      );
    }
  }

  private async assertFacultyAccess(
    user: JwtUser,
    paper: { courseId?: string | null },
  ) {
    const isAdmin =
      user.permissions?.includes('ia:manage') ||
      user.permissions?.includes('exam:admin') ||
      user.permissions?.includes('ia:marks:enter');
    if (isAdmin && !user.roles?.includes('faculty')) return;

    const staff = await this.resolveStaffProfile(user.tid, user.sub);
    if (!staff) throw new ForbiddenException('Staff profile not found');

    const assignment = await this.prisma.subjectTeachingAssignment.findFirst({
      where: {
        tenantId: user.tid,
        staffProfileId: staff.id,
        courseId: paper.courseId ?? undefined,
        deletedAt: null,
        canEnterInternalMarks: true,
      },
    });
    if (!assignment) {
      throw new ForbiddenException(
        'You are not assigned to enter marks for this subject',
      );
    }
  }

  async getRoster(user: JwtUser, paperId: string, schemeId?: string) {
    const paper = await this.sessions.getPaper(user.tid, paperId);
    let scheme;
    if (schemeId) {
      scheme = await this.schemes.get(user.tid, schemeId);
    } else {
      const paperMeta = (paper.metadata ?? {}) as { schemeId?: string };
      if (paperMeta.schemeId) {
        scheme = await this.schemes.get(user.tid, paperMeta.schemeId);
      } else {
        const found = await this.schemes.findForOffering(
          user.tid,
          paper.offeringId,
          paper.courseId,
        );
        if (!found) {
          throw new BadRequestException(
            'No mark scheme linked to this subject. Create an IA Exam first or configure a scheme in Settings.',
          );
        }
        scheme = found;
      }
    }

    const lines = paper.offeringId
      ? await this.prisma.semesterRegistrationLine.findMany({
          where: {
            tenantId: user.tid,
            offeringId: paper.offeringId,
            status: { in: ['approved', 'confirmed', 'registered', 'pending'] },
          },
          include: {
            registration: {
              include: {
                shift: { select: { id: true, name: true } },
                student: { select: rosterStudentSelect },
              },
            },
          },
        })
      : [];

    const students =
      lines.length > 0
        ? Array.from(
            new Map(
              lines.map((line) => [
                line.registration.student.id,
                {
                  student: line.registration.student,
                  shift:
                    line.registration.shift ??
                    line.registration.student.primaryShift,
                },
              ]),
            ).values(),
          )
        : await this.studentsForPaper(user.tid, paper);

    const resolvedSchemeId = scheme.id;

    const marks = await (this.prisma as any).iaComponentMark.findMany({
      where: {
        tenantId: user.tid,
        paperId,
        schemeId: resolvedSchemeId,
        deletedAt: null,
      },
    });

    const context = await this.paperContext(user.tid, paper);
    const previousMarks = await this.previousMarksForCourse(
      user.tid,
      paper,
      students.map((row) => row.student.id),
    );

    return {
      paper,
      scheme,
      context,
      previousMarks,
      students: students.map((row) => ({
        id: row.student.id,
        rollNumber: row.student.rollNumber,
        enrollmentNumber: row.student.enrollmentNumber,
        fullName: rosterStudentName(row.student),
        shiftId: row.shift?.id ?? null,
        shiftName: row.shift?.name ?? null,
        marks: scheme.components.map(
          (c: {
            id: string;
            code: string;
            label: string;
            maxMarks: unknown;
          }) => {
            const saved = marks.find(
              (m: { studentId: string; componentId: string }) =>
                m.studentId === row.student.id && m.componentId === c.id,
            );
            return {
              componentId: c.id,
              code: c.code,
              label: c.label,
              maxMarks: Number(c.maxMarks),
              marks: saved?.marks != null ? Number(saved.marks) : null,
              isAbsent: saved?.isAbsent ?? false,
              status: saved?.status ?? 'DRAFT',
              remarks: saved?.remarks ?? '',
              updatedAt: saved?.updatedAt ?? null,
            };
          },
        ),
      })),
    };
  }

  private async paperContext(
    tenantId: string,
    paper: {
      sessionId?: string | null;
      courseId?: string | null;
      metadata?: unknown;
    },
  ) {
    const session = paper.sessionId
      ? await (this.prisma as any).examSession.findFirst({
          where: { id: paper.sessionId, tenantId },
          select: {
            id: true,
            name: true,
            examType: true,
            academicYearId: true,
            shiftId: true,
            metadata: true,
          },
        })
      : null;
    const meta = (session?.metadata ?? {}) as {
      shiftName?: string;
      academicYearName?: string;
    };
    const paperMeta = (paper.metadata ?? {}) as {
      category?: string;
      maxMarks?: number;
    };
    const [course, year, shift] = await Promise.all([
      paper.courseId
        ? this.prisma.course.findFirst({
            where: { id: paper.courseId, tenantId },
            select: {
              credits: true,
              courseType: true,
              department: { select: { id: true, name: true } },
            },
          })
        : null,
      !meta.academicYearName && session?.academicYearId
        ? this.prisma.academicYear.findFirst({
            where: { id: session.academicYearId },
            select: { name: true },
          })
        : null,
      !meta.shiftName && session?.shiftId
        ? this.prisma.shift.findFirst({
            where: { id: session.shiftId },
            select: { name: true },
          })
        : null,
    ]);
    return {
      sessionName: session?.name ?? null,
      examType: session?.examType ?? null,
      academicYearName: meta.academicYearName ?? year?.name ?? null,
      shiftName: meta.shiftName ?? shift?.name ?? null,
      departmentId: course?.department?.id ?? null,
      departmentName: course?.department?.name ?? null,
      courseType: paperMeta.category || course?.courseType || null,
      credits: course?.credits != null ? Number(course.credits) : null,
      maxMarks: paperMeta.maxMarks ?? null,
    };
  }

  private async previousMarksForCourse(
    tenantId: string,
    paper: { id: string; courseId?: string | null },
    studentIds: string[],
  ) {
    if (!paper.courseId || !studentIds.length) return [];
    const papers = await (this.prisma as any).examPaperSchedule.findMany({
      where: {
        tenantId,
        courseId: paper.courseId,
        deletedAt: null,
        id: { not: paper.id },
      },
      select: { id: true, sessionId: true, paperCode: true, paperName: true },
      take: 40,
    });
    if (!papers.length) return [];
    const sessions = await (this.prisma as any).examSession.findMany({
      where: {
        tenantId,
        id: { in: papers.map((row: { sessionId: string }) => row.sessionId) },
        deletedAt: null,
      },
      select: { id: true, name: true, examType: true },
    });
    const sessionById = new Map(
      sessions.map((session: { id: string }) => [session.id, session]),
    );
    const saved = await (this.prisma as any).iaComponentMark.findMany({
      where: {
        tenantId,
        deletedAt: null,
        paperId: { in: papers.map((row: { id: string }) => row.id) },
        studentId: { in: studentIds },
        marks: { not: null },
      },
      select: {
        studentId: true,
        paperId: true,
        componentId: true,
        marks: true,
        maxMarks: true,
      },
      take: 2000,
    });
    const componentIds = [
      ...new Set(saved.map((row: { componentId: string }) => row.componentId)),
    ];
    const components = componentIds.length
      ? await (this.prisma as any).iaAssessmentComponent.findMany({
          where: { id: { in: componentIds } },
          select: { id: true, label: true, code: true },
        })
      : [];
    const componentById = new Map(
      components.map((component: { id: string }) => [component.id, component]),
    );
    const paperById = new Map(
      papers.map((row: { id: string }) => [row.id, row]),
    );
    return saved.map(
      (row: {
        studentId: string;
        paperId: string;
        componentId: string;
        marks: unknown;
        maxMarks: unknown;
      }) => {
        const earlier = paperById.get(row.paperId) as
          | { sessionId: string; paperCode: string; paperName: string }
          | undefined;
        const session = earlier
          ? (sessionById.get(earlier.sessionId) as
              | { name?: string; examType?: string }
              | undefined)
          : undefined;
        const component = componentById.get(row.componentId) as
          | { label?: string; code?: string }
          | undefined;
        return {
          studentId: row.studentId,
          examName: session?.name ?? 'Earlier assessment',
          examType: session?.examType ?? null,
          paperCode: earlier?.paperCode ?? '',
          paperName: earlier?.paperName ?? '',
          componentLabel: component?.label ?? component?.code ?? 'Marks',
          marks: row.marks != null ? Number(row.marks) : null,
          maxMarks: row.maxMarks != null ? Number(row.maxMarks) : null,
        };
      },
    );
  }

  async saveMarks(user: JwtUser, paperId: string, dto: SaveIaMarksDto) {
    const paper = await this.sessions.getPaper(user.tid, paperId);
    await this.assertFacultyAccess(user, paper);
    await this.assertCanEditMarks(user, paperId);

    const scheme = await this.schemes.get(user.tid, dto.schemeId);
    const componentMap = new Map(
      scheme.components.map((c: { id: string; maxMarks: unknown }) => [
        c.id,
        c,
      ]),
    );

    let saved = 0;
    for (const row of dto.rows) {
      const comp = componentMap.get(row.componentId);
      if (!comp) continue;
      const maxMarks = Number((comp as { maxMarks: unknown }).maxMarks);
      if (row.marks != null && row.marks > maxMarks) {
        throw new BadRequestException(
          `Marks exceed max for component ${row.componentId}`,
        );
      }

      await (this.prisma as any).iaComponentMark.upsert({
        where: {
          componentId_studentId_paperId: {
            componentId: row.componentId,
            studentId: row.studentId,
            paperId,
          },
        },
        create: {
          tenantId: user.tid,
          sessionId: paper.sessionId,
          paperId,
          schemeId: dto.schemeId,
          componentId: row.componentId,
          studentId: row.studentId,
          marks: row.marks,
          maxMarks,
          isAbsent: row.isAbsent ?? false,
          remarks: row.remarks,
          enteredById: user.sub,
          status: 'DRAFT',
        },
        update: {
          marks: row.marks,
          isAbsent: row.isAbsent ?? false,
          remarks: row.remarks,
          enteredById: user.sub,
        },
      });
      saved++;
    }

    await this.schemes.lockScheme(user.tid, dto.schemeId);
    await this.audit.log(user, 'IA_MARKS', paperId, 'SAVE', null, {
      saved,
      schemeId: dto.schemeId,
    });
    return { saved };
  }

  private async studentsForPaper(
    tenantId: string,
    paper: { courseId?: string | null; offeringId?: string | null },
  ) {
    const include = {
      registration: {
        include: {
          shift: { select: { id: true, name: true } },
          student: { select: rosterStudentSelect },
        },
      },
    };
    const lines = paper.offeringId
      ? await this.prisma.semesterRegistrationLine.findMany({
          where: {
            tenantId,
            offeringId: paper.offeringId,
            status: { in: ['approved', 'confirmed', 'registered', 'pending'] },
          },
          include,
          take: 1000,
        })
      : paper.courseId
        ? await this.prisma.semesterRegistrationLine.findMany({
            where: {
              tenantId,
              offering: { courseId: paper.courseId },
              status: {
                in: ['approved', 'confirmed', 'registered', 'pending'],
              },
            },
            include,
            take: 1000,
          })
        : [];
    return Array.from(
      new Map(
        lines.map((line) => [
          line.registration.student.id,
          {
            student: line.registration.student,
            shift:
              line.registration.shift ?? line.registration.student.primaryShift,
          },
        ]),
      ).values(),
    );
  }

  async importMarksFromRows(
    user: JwtUser,
    paperId: string,
    schemeId: string,
    rows: Array<{
      rollNumber: string;
      componentCode: string;
      marks: number;
      remarks?: string;
    }>,
  ) {
    const roster = await this.getRoster(user, paperId, schemeId);
    const studentByRoll = new Map(
      roster.students.map((s: { rollNumber?: string | null; id: string }) => [
        String(s.rollNumber ?? '')
          .trim()
          .toUpperCase(),
        s.id,
      ]),
    );
    const compByCode = new Map(
      roster.scheme.components.map((c: { code: string; id: string }) => [
        c.code.toUpperCase(),
        c.id,
      ]),
    );

    const markRows: SaveIaMarksDto['rows'] = [];
    let skipped = 0;
    for (const row of rows) {
      const studentId = studentByRoll.get(row.rollNumber.trim().toUpperCase());
      const componentId = compByCode.get(
        row.componentCode.trim().toUpperCase(),
      );
      if (!studentId || !componentId) {
        skipped++;
        continue;
      }
      markRows.push({
        studentId: String(studentId),
        componentId: String(componentId),
        marks: row.marks,
        remarks: row.remarks,
      });
    }
    if (!markRows.length) {
      throw new BadRequestException(
        skipped
          ? 'None of the roll numbers in this file match the selected paper.'
          : 'Enter at least one mark before importing.',
      );
    }
    const saved = await this.saveMarks(user, paperId, {
      schemeId: roster.scheme.id,
      rows: markRows,
    });
    return { ...saved, skipped };
  }

  async buildImportTemplate(user: JwtUser, paperId: string) {
    const roster = await this.getRoster(user, paperId);
    const [branding, programme] = await Promise.all([
      this.importBranding(user.tid),
      this.programmeLabel(
        user.tid,
        roster.students.map((student: { id: string }) => student.id),
      ),
    ]);
    const context = roster.context ?? {};
    const paper = roster.paper ?? {};
    const shifts = [
      ...new Set(
        roster.students
          .map((student: { shiftName?: string | null }) => student.shiftName)
          .filter((name: string | null | undefined): name is string =>
            Boolean(name),
          ),
      ),
    ];
    const buffer = await buildIaMarkImportWorkbook({
      collegeName: branding.displayName,
      motto: branding.motto,
      logoUrl: branding.logoUrl,
      academicYear: context.academicYearName || '—',
      programme,
      examName: context.sessionName || 'Internal assessment',
      paperCode: paper.paperCode || null,
      shiftName:
        shifts.length === 1 ? shifts[0] : context.shiftName || 'All shifts',
      subject:
        [paper.paperCode, paper.paperName].filter(Boolean).join(' — ') || '—',
      components: (roster.scheme.components ?? []).map(
        (component: { code: string; label: string; maxMarks: unknown }) => ({
          code: component.code,
          label: component.label,
          maxMarks: Number(component.maxMarks),
        }),
      ),
      students: roster.students.map(
        (student: {
          rollNumber?: string | null;
          fullName?: string | null;
          shiftName?: string | null;
          marks: Array<{
            code: string;
            marks: number | null;
            remarks?: string | null;
          }>;
        }) => ({
          rollNumber: student.rollNumber,
          fullName: student.fullName,
          shiftName: student.shiftName,
          marks: student.marks,
        }),
      ),
    });
    const filename = `${safeWorkbookName(paper.paperCode || context.sessionName || 'ia-marks')}-marks.xlsx`;
    return { buffer, filename };
  }

  async importWorkbook(
    user: JwtUser,
    paperId: string,
    schemeId: string | undefined,
    buffer: Buffer,
  ) {
    let rows;
    try {
      rows = await parseIaMarkImportWorkbook(buffer);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'The Excel file could not be read.',
      );
    }
    return this.importMarksFromRows(user, paperId, schemeId || '', rows);
  }

  private async importBranding(tenantId: string) {
    const [tenant, branding] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      }),
      this.prisma.tenantBranding.findUnique({
        where: { tenantId },
        select: { displayName: true, portalSubtitle: true, logoUrl: true },
      }),
    ]);
    return {
      displayName: branding?.displayName || tenant?.name || 'College',
      motto: branding?.portalSubtitle?.trim() || null,
      logoUrl:
        toPublicUploadUrl(branding?.logoUrl) ?? branding?.logoUrl ?? null,
    };
  }

  private async programmeLabel(tenantId: string, studentIds: string[]) {
    if (!studentIds.length) return '—';
    const students = await this.prisma.student.findMany({
      where: { tenantId, id: { in: studentIds.slice(0, 800) } },
      select: {
        programVersion: {
          select: { program: { select: { name: true, code: true } } },
        },
      },
    });
    const names = [
      ...new Set(
        students
          .map(
            (student) =>
              student.programVersion?.program?.code ||
              student.programVersion?.program?.name,
          )
          .filter((name): name is string => Boolean(name)),
      ),
    ];
    if (!names.length) return '—';
    return names.length === 1 ? names[0] : names.slice(0, 3).join(', ');
  }
}
