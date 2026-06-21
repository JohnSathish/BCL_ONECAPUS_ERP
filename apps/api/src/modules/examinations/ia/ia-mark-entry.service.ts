import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { IaAuditService } from './ia-audit.service';
import { IaSchemeService } from './ia-scheme.service';
import { IaSessionService } from './ia-session.service';
import { IaWorkflowService } from './ia-workflow.service';
import type { SaveIaMarksDto } from './dto/ia.dto';

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
        course: { select: { id: true, code: true, title: true } },
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

    return assignments.map((a) => ({
      assignmentId: a.id,
      courseId: a.courseId,
      courseCode: a.course.code,
      courseName: a.course.title,
      semesterNo: a.semesterNo,
      sectionCode: a.sectionCode ?? a.offeringSection?.sectionCode,
      programmeName: a.programVersion?.program?.name,
      papers: papers.filter(
        (p: { courseId?: string }) => p.courseId === a.courseId,
      ),
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

  async getRoster(user: JwtUser, paperId: string, schemeId: string) {
    const paper = await this.sessions.getPaper(user.tid, paperId);
    const scheme = await this.schemes.get(user.tid, schemeId);

    const registrations = paper.offeringId
      ? await this.prisma.registration.findMany({
          where: {
            tenantId: user.tid,
            offeringId: paper.offeringId,
            deletedAt: null,
            status: { in: ['registered', 'approved', 'confirmed'] },
          },
          include: {
            student: {
              select: {
                id: true,
                rollNumber: true,
                enrollmentNumber: true,
                user: { select: { displayName: true } },
              },
            },
          },
        })
      : [];

    const students =
      registrations.length > 0
        ? registrations.map((r) => r.student)
        : await this.studentsForPaper(user.tid, paper);

    const marks = await (this.prisma as any).iaComponentMark.findMany({
      where: {
        tenantId: user.tid,
        paperId,
        schemeId,
        deletedAt: null,
      },
    });

    return {
      paper,
      scheme,
      students: students.map((s) => ({
        id: s.id,
        rollNumber: s.rollNumber,
        enrollmentNumber: s.enrollmentNumber,
        fullName: s.user?.displayName ?? s.user?.displayName,
        marks: scheme.components.map(
          (c: {
            id: string;
            code: string;
            label: string;
            maxMarks: unknown;
          }) => {
            const row = marks.find(
              (m: { studentId: string; componentId: string }) =>
                m.studentId === s.id && m.componentId === c.id,
            );
            return {
              componentId: c.id,
              code: c.code,
              label: c.label,
              maxMarks: Number(c.maxMarks),
              marks: row?.marks != null ? Number(row.marks) : null,
              isAbsent: row?.isAbsent ?? false,
              status: row?.status ?? 'DRAFT',
            };
          },
        ),
      })),
    };
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
    paper: { courseId?: string | null },
  ) {
    if (!paper.courseId) return [];
    const lines = await this.prisma.semesterRegistrationLine.findMany({
      where: {
        tenantId,
        offering: { courseId: paper.courseId },
        status: { in: ['approved', 'confirmed', 'registered', 'pending'] },
      },
      include: {
        registration: {
          include: {
            student: {
              select: {
                id: true,
                rollNumber: true,
                enrollmentNumber: true,
                user: { select: { displayName: true } },
              },
            },
          },
        },
      },
      take: 1000,
    } as any);
    return Array.from(
      new Map(
        (lines as any[]).map((line) => [
          line.registration.student.id,
          line.registration.student,
        ]),
      ).values(),
    );
  }

  async importMarksFromRows(
    user: JwtUser,
    paperId: string,
    schemeId: string,
    rows: Array<{ rollNumber: string; componentCode: string; marks: number }>,
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
    for (const row of rows) {
      const studentId = studentByRoll.get(row.rollNumber.trim().toUpperCase());
      const componentId = compByCode.get(
        row.componentCode.trim().toUpperCase(),
      );
      if (!studentId || !componentId) continue;
      markRows.push({
        studentId: String(studentId),
        componentId: String(componentId),
        marks: row.marks,
      });
    }
    return this.saveMarks(user, paperId, { schemeId, rows: markRows });
  }
}
