import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import {
  AttendanceCorrectionDto,
  AttendanceEligibilityQueryDto,
  AttendanceSessionQueryDto,
  CreateExtraAttendanceSessionDto,
  GenerateAttendanceSessionsDto,
  MarkAttendanceDto,
} from './dto/student-attendance.dto';
import { LicenseEnforcementService } from '../licensing/services/license-enforcement.service';
import { TeachingSubjectGroupService } from '../timetable-engine/teaching-subject-group.service';

const PRESENT_STATUSES = new Set(['P', 'L', 'OD', 'SPORTS', 'NSS', 'NCC']);
const ABSENT_STATUSES = new Set(['A']);
const MEDICAL_STATUSES = new Set(['ML']);
const NEUTRAL_STATUSES = new Set(['EXEMPTED']);

@Injectable()
export class StudentAttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly licenseEnforcement: LicenseEnforcementService,
    private readonly subjectGroups: TeachingSubjectGroupService,
  ) {}

  async dashboard(tenantId: string) {
    const today = this.startOfDay(new Date());
    const [sessions, marked, unmarked, entries, shortage] = await Promise.all([
      (this.prisma as any).studentAttendanceSession.count({
        where: { tenantId, sessionDate: today, deletedAt: null },
      }),
      (this.prisma as any).studentAttendanceSession.count({
        where: {
          tenantId,
          sessionDate: today,
          deletedAt: null,
          status: { in: ['MARKED', 'LOCKED', 'FROZEN'] },
        },
      }),
      (this.prisma as any).studentAttendanceSession.count({
        where: {
          tenantId,
          sessionDate: today,
          deletedAt: null,
          status: 'OPEN',
        },
      }),
      (this.prisma as any).studentAttendanceEntry.groupBy({
        by: ['status'],
        where: { tenantId, session: { sessionDate: today } },
        _count: { _all: true },
      }),
      (this.prisma as any).studentAttendanceEligibilitySnapshot.count({
        where: {
          tenantId,
          eligibilityStatus: { in: ['CONDONATION', 'DETAINED'] },
        },
      }),
    ]);
    return {
      today: { sessions, marked, unmarked },
      statusCounts: entries.reduce((acc: Record<string, number>, row: any) => {
        acc[row.status] = row._count._all;
        return acc;
      }, {}),
      shortageStudents: shortage,
    };
  }

  async generateFromTimetable(
    user: JwtUser,
    dto: GenerateAttendanceSessionsDto,
  ) {
    const sessionDate = this.startOfDay(dto.date);
    const dayOfWeek = sessionDate.getDay();
    const entries = await this.prisma.timetablePlanEntry.findMany({
      where: {
        tenantId: user.tid,
        deletedAt: null,
        status: { not: 'CANCELLED' },
        dayOfWeek,
        ...(dto.timetablePlanId ? { planId: dto.timetablePlanId } : {}),
        ...(dto.offeringSectionId
          ? { offeringSectionId: dto.offeringSectionId }
          : {}),
        ...(dto.staffProfileId ? { staffProfileId: dto.staffProfileId } : {}),
      },
      include: {
        plan: true,
      },
      orderBy: [{ startTime: 'asc' }],
    });

    let created = 0;
    for (const entry of entries) {
      const metadata = (entry.metadata ?? {}) as Record<string, unknown>;
      const facultyTeam = Array.isArray(metadata.facultyTeam)
        ? metadata.facultyTeam
        : [];
      const linkedPapers = entry.teachingSubjectGroupId
        ? await this.subjectGroups.linkedPaperIds(
            user.tid,
            entry.teachingSubjectGroupId,
          )
        : [];
      await (this.prisma as any).studentAttendanceSession.upsert({
        where: {
          tenantId_timetablePlanEntryId_sessionDate: {
            tenantId: user.tid,
            timetablePlanEntryId: entry.id,
            sessionDate,
          },
        },
        create: {
          tenantId: user.tid,
          academicYearId: entry.plan?.academicYearId,
          semesterId: entry.plan?.semesterId,
          semesterNo: entry.semesterSequence,
          programVersionId: entry.plan?.programVersionId,
          offeringSectionId: entry.offeringSectionId,
          courseId: entry.courseId,
          teachingSubjectGroupId: entry.teachingSubjectGroupId,
          shiftId: entry.shiftId,
          classroomId: entry.classroomId,
          timetablePlanEntryId: entry.id,
          sessionDate,
          dayOfWeek: entry.dayOfWeek,
          periodNo: entry.periodNo,
          startTime: entry.startTime,
          endTime: entry.endTime,
          sessionType: entry.slotType ?? 'THEORY',
          facultyMode: facultyTeam.length > 1 ? 'TEAM_TEACHING' : 'PRIMARY',
          primaryFacultyId: entry.staffProfileId,
          status: 'OPEN',
          lockAt: this.addHours(new Date(), 24),
          metadata: {
            facultyTeam,
            fyugpCategory: entry.fyugpCategory,
            generatedFrom: 'TIMETABLE',
            teachingSubjectGroupId: entry.teachingSubjectGroupId,
            linkedPaperIds: linkedPapers.map((p: any) => p.courseId),
          },
        },
        update: {
          teachingSubjectGroupId: entry.teachingSubjectGroupId,
          metadata: {
            facultyTeam,
            fyugpCategory: entry.fyugpCategory,
            generatedFrom: 'TIMETABLE',
            teachingSubjectGroupId: entry.teachingSubjectGroupId,
            linkedPaperIds: linkedPapers.map((p: any) => p.courseId),
          },
        },
      });
      created += 1;
    }
    await this.audit(user, 'GENERATE_SESSIONS', null, null, {
      date: dto.date,
      created,
      considered: entries.length,
    });
    return { considered: entries.length, created };
  }

  async createExtraSession(
    user: JwtUser,
    dto: CreateExtraAttendanceSessionDto,
  ) {
    await this.licenseEnforcement.assertWriteAllowed(
      user.tid,
      'attendance.write',
    );
    const section = await this.prisma.offeringSection.findFirst({
      where: { tenantId: user.tid, id: dto.offeringSectionId, deletedAt: null },
      include: { courseOffering: true },
    });
    if (!section?.courseOffering)
      throw new NotFoundException('Offering section not found');
    const session = await (this.prisma as any).studentAttendanceSession.create({
      data: {
        tenantId: user.tid,
        sessionDate: this.startOfDay(dto.sessionDate),
        offeringSectionId: section.id,
        courseId: dto.courseId ?? section.courseOffering.courseId,
        programVersionId: section.courseOffering.programVersionId,
        semesterId: section.courseOffering.semesterId,
        semesterNo: section.courseOffering.semesterSequence,
        shiftId: section.shiftId,
        classroomId: section.classroomId,
        primaryFacultyId: section.staffProfileId,
        sessionType: dto.sessionType ?? 'EXTRA_CLASS',
        labBatch: dto.labBatch,
        startTime: dto.startTime ? this.timeOnly(dto.startTime) : undefined,
        endTime: dto.endTime ? this.timeOnly(dto.endTime) : undefined,
        facultyMode: 'PRIMARY',
        status: 'OPEN',
        lockAt: this.addHours(new Date(), 24),
        metadata: { generatedFrom: 'EXTRA_CLASS' },
      },
    });
    await this.audit(user, 'CREATE_EXTRA_SESSION', session.id, null, { dto });
    return session;
  }

  async listSessions(tenantId: string, query: AttendanceSessionQueryDto) {
    const where: Record<string, unknown> = { tenantId, deletedAt: null };
    if (query.date) where.sessionDate = this.startOfDay(query.date);
    if (query.from || query.to) {
      where.sessionDate = {
        ...(query.from ? { gte: this.startOfDay(query.from) } : {}),
        ...(query.to ? { lte: this.startOfDay(query.to) } : {}),
      };
    }
    if (query.offeringSectionId)
      where.offeringSectionId = query.offeringSectionId;
    if (query.courseId) where.courseId = query.courseId;
    if (query.staffProfileId) where.primaryFacultyId = query.staffProfileId;
    if (query.semesterNo) where.semesterNo = query.semesterNo;
    if (query.status) where.status = query.status;

    const sessions = await (
      this.prisma as any
    ).studentAttendanceSession.findMany({
      where,
      include: { entries: true },
      orderBy: [{ sessionDate: 'desc' }, { startTime: 'asc' }],
      take: 200,
    });
    return Promise.all(
      sessions.map((session: any) => this.enrichSession(session)),
    );
  }

  async facultyToday(user: JwtUser) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { tenantId: user.tid, portalUserId: user.sub, deletedAt: null },
      select: { id: true },
    });
    if (!staff) return [];
    const today = this.startOfDay(new Date());
    const authorizedSections = await (
      this.prisma as any
    ).subjectTeachingAssignment.findMany({
      where: {
        tenantId: user.tid,
        staffProfileId: staff.id,
        deletedAt: null,
        canMarkAttendance: true,
      },
      select: { offeringSectionId: true },
    });
    const sectionIds = authorizedSections.map(
      (row: any) => row.offeringSectionId,
    );
    const groupIds = await (this.prisma as any).teachingSubjectGroup.findMany({
      where: {
        tenantId: user.tid,
        deletedAt: null,
        primaryStaffProfileId: staff.id,
      },
      select: { id: true },
    });
    const groupIdList = groupIds.map((g: any) => g.id);

    const sessions = await this.listSessions(user.tid, {
      date: today.toISOString(),
    });

    return sessions.filter((row: any) => {
      if (row.primaryFacultyId === staff.id) return true;
      if (
        row.teachingSubjectGroupId &&
        groupIdList.includes(row.teachingSubjectGroupId)
      ) {
        return true;
      }
      if (row.offeringSectionId && sectionIds.includes(row.offeringSectionId)) {
        return true;
      }
      return false;
    });
  }

  async roster(tenantId: string, sessionId: string) {
    const session = await (
      this.prisma as any
    ).studentAttendanceSession.findFirst({
      where: { tenantId, id: sessionId, deletedAt: null },
      include: { entries: true },
    });
    if (!session) throw new NotFoundException('Attendance session not found');
    const students = session.teachingSubjectGroupId
      ? await this.subjectGroups.studentsForGroup(
          tenantId,
          session.teachingSubjectGroupId,
          session.semesterNo,
        )
      : await this.studentsForSection(
          tenantId,
          session.offeringSectionId,
          session.semesterNo,
        );
    const entryByStudent = new Map<string, any>(
      session.entries.map((entry: any) => [entry.studentId, entry]),
    );
    return {
      session: await this.enrichSession(session),
      students: students.map((student: any) => ({
        id: student.id,
        rollNumber: student.rollNumber,
        enrollmentNumber: student.enrollmentNumber,
        admissionNumber: student.admissionNumber,
        fullName:
          student.masterProfile?.fullName ??
          student.user?.displayName ??
          student.enrollmentNumber,
        status: entryByStudent.get(student.id)?.status ?? 'P',
        remarks: entryByStudent.get(student.id)?.remarks ?? '',
      })),
    };
  }

  async markSession(user: JwtUser, sessionId: string, dto: MarkAttendanceDto) {
    await this.licenseEnforcement.assertWriteAllowed(
      user.tid,
      'attendance.write',
    );
    const session = await this.assertOpenSession(user.tid, sessionId);
    await this.assertCanMark(user, session);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      for (const entry of dto.entries) {
        await (tx as any).studentAttendanceEntry.upsert({
          where: {
            sessionId_studentId: { sessionId, studentId: entry.studentId },
          },
          create: {
            tenantId: user.tid,
            sessionId,
            studentId: entry.studentId,
            status: entry.status,
            minutesPresent: entry.minutesPresent,
            remarks: entry.remarks,
            markedById: user.sub,
            markedAt: now,
          },
          update: {
            status: entry.status,
            minutesPresent: entry.minutesPresent,
            remarks: entry.remarks,
            markedById: user.sub,
            markedAt: now,
          },
        });
      }
      await (tx as any).studentAttendanceSession.update({
        where: { id: sessionId },
        data: {
          status: dto.lockAfterSave ? 'LOCKED' : 'MARKED',
          markedById: user.sub,
          lockedAt: dto.lockAfterSave ? now : undefined,
        },
      });
    });
    await this.recalculateForSession(user.tid, sessionId);
    await this.audit(user, 'MARK_SESSION', sessionId, null, {
      mode: dto.mode,
      count: dto.entries.length,
    });
    return this.roster(user.tid, sessionId);
  }

  async correctSession(
    user: JwtUser,
    sessionId: string,
    dto: AttendanceCorrectionDto,
  ) {
    const session = await (
      this.prisma as any
    ).studentAttendanceSession.findFirst({
      where: { tenantId: user.tid, id: sessionId, deletedAt: null },
    });
    if (!session) throw new NotFoundException('Attendance session not found');
    if (session.status === 'FROZEN')
      throw new BadRequestException('Frozen attendance cannot be corrected');
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      for (const entry of dto.entries) {
        await (tx as any).studentAttendanceEntry.upsert({
          where: {
            sessionId_studentId: { sessionId, studentId: entry.studentId },
          },
          create: {
            tenantId: user.tid,
            sessionId,
            studentId: entry.studentId,
            status: entry.status,
            remarks: entry.remarks,
            correctedById: user.sub,
            correctedAt: now,
            correctionReason: dto.reason,
          },
          update: {
            status: entry.status,
            remarks: entry.remarks,
            correctedById: user.sub,
            correctedAt: now,
            correctionReason: dto.reason,
          },
        });
      }
    });
    await this.recalculateForSession(user.tid, sessionId);
    await this.audit(user, 'CORRECT_SESSION', sessionId, null, {
      reason: dto.reason,
      count: dto.entries.length,
    });
    return this.roster(user.tid, sessionId);
  }

  async lockSession(
    user: JwtUser,
    sessionId: string,
    status: 'LOCKED' | 'FROZEN' | 'OPEN',
  ) {
    const data =
      status === 'LOCKED'
        ? { status, lockedAt: new Date() }
        : status === 'FROZEN'
          ? { status, frozenAt: new Date() }
          : { status, lockedAt: null, frozenAt: null };
    const session = await (this.prisma as any).studentAttendanceSession.update({
      where: { id: sessionId },
      data,
    });
    await this.audit(user, `${status}_SESSION`, sessionId, null, {});
    return session;
  }

  async summaries(tenantId: string, query: AttendanceEligibilityQueryDto) {
    return (this.prisma as any).studentAttendanceSummary.findMany({
      where: {
        tenantId,
        ...(query.studentId ? { studentId: query.studentId } : {}),
        ...(query.courseId ? { courseId: query.courseId } : {}),
        ...(query.semesterNo ? { semesterNo: query.semesterNo } : {}),
      },
      orderBy: [{ percentage: 'asc' }],
      take: 500,
    });
  }

  async eligibility(user: JwtUser, query: AttendanceEligibilityQueryDto) {
    const summaries = await this.summaries(user.tid, query);
    const snapshots = summaries.map((summary: any) => {
      const total = Number(summary.totalSessions ?? 0);
      const present =
        Number(summary.presentCount ?? 0) + Number(summary.dutyLeaveCount ?? 0);
      const percentage = Number(summary.percentage ?? 0);
      const requiredFor75 = Math.max(0, Math.ceil(0.75 * total - present));
      const status =
        percentage >= 75
          ? 'ELIGIBLE'
          : percentage >= 65
            ? 'CONDONATION'
            : 'DETAINED';
      return {
        tenantId: user.tid,
        studentId: summary.studentId,
        courseId: summary.courseId,
        offeringSectionId: summary.offeringSectionId,
        semesterNo: summary.semesterNo,
        subjectPercentage: percentage,
        semesterPercentage: percentage,
        eligibilityStatus: status,
        shortageSessions: requiredFor75,
        requiredSessions: requiredFor75,
        ruleApplied: 'FYUGP_75_65_RULE',
        metadata: { periodKey: summary.periodKey },
      };
    });
    await this.prisma.$transaction(
      snapshots.map((snapshot: any) =>
        (this.prisma as any).studentAttendanceEligibilitySnapshot.create({
          data: snapshot,
        }),
      ),
    );
    return snapshots;
  }

  async reports(
    tenantId: string,
    type: string,
    query: AttendanceSessionQueryDto,
  ) {
    if (type === 'unmarked') {
      return this.listSessions(tenantId, { ...query, status: 'OPEN' });
    }
    if (type === 'shortage' || type === 'defaulters') {
      return (this.prisma as any).studentAttendanceEligibilitySnapshot.findMany(
        {
          where: {
            tenantId,
            eligibilityStatus: { in: ['CONDONATION', 'DETAINED'] },
          },
          orderBy: [{ subjectPercentage: 'asc' }],
          take: 500,
        },
      );
    }
    if (type === 'daily') {
      return this.listSessions(tenantId, query);
    }
    return this.summaries(tenantId, query as AttendanceEligibilityQueryDto);
  }

  async studentPortalSummary(user: JwtUser) {
    const student = await this.prisma.student.findFirst({
      where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
      select: { id: true },
    });
    if (!student) return { subjects: [], overall: null, alerts: [] };
    const subjects = await this.summaries(user.tid, { studentId: student.id });
    const percentages = subjects.map((row: any) => Number(row.percentage ?? 0));
    const overall = percentages.length
      ? Math.round(
          (percentages.reduce((sum: number, value: number) => sum + value, 0) /
            percentages.length) *
            100,
        ) / 100
      : null;
    return {
      subjects,
      overall,
      alerts: subjects
        .filter((row: any) => Number(row.percentage ?? 0) < 75)
        .map((row: any) => ({
          courseId: row.courseId,
          percentage: Number(row.percentage ?? 0),
          message:
            Number(row.percentage ?? 0) < 65
              ? 'Detention risk'
              : 'Condonation zone',
        })),
    };
  }

  private async assertOpenSession(tenantId: string, sessionId: string) {
    const session = await (
      this.prisma as any
    ).studentAttendanceSession.findFirst({
      where: { tenantId, id: sessionId, deletedAt: null },
    });
    if (!session) throw new NotFoundException('Attendance session not found');
    if (['LOCKED', 'FROZEN', 'CANCELLED'].includes(session.status)) {
      throw new BadRequestException(
        `Attendance session is ${session.status.toLowerCase()}`,
      );
    }
    return session;
  }

  private async assertCanMark(user: JwtUser, session: any) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { tenantId: user.tid, portalUserId: user.sub, deletedAt: null },
      select: { id: true },
    });
    if (!staff) return;
    if (session.primaryFacultyId === staff.id) return;
    if (session.teachingSubjectGroupId) {
      const group = await this.subjectGroups.get(
        user.tid,
        session.teachingSubjectGroupId,
      );
      if (group.primaryStaffProfileId === staff.id) return;

      const papers = await this.subjectGroups.linkedPaperIds(
        user.tid,
        session.teachingSubjectGroupId,
      );
      const sectionIds = [
        ...new Set(
          papers
            .map(
              (paper: { offeringSectionId?: string | null }) =>
                paper.offeringSectionId,
            )
            .filter(Boolean),
        ),
      ] as string[];
      if (sectionIds.length) {
        const sectionAssignment = await (
          this.prisma as any
        ).subjectTeachingAssignment.findFirst({
          where: {
            tenantId: user.tid,
            staffProfileId: staff.id,
            offeringSectionId: { in: sectionIds },
            deletedAt: null,
            canMarkAttendance: true,
          },
        });
        if (sectionAssignment) return;
      }
      const courseIds = [
        ...new Set(
          papers
            .map((paper: { courseId?: string | null }) => paper.courseId)
            .filter(Boolean),
        ),
      ] as string[];
      if (courseIds.length) {
        const courseAssignment = await (
          this.prisma as any
        ).subjectTeachingAssignment.findFirst({
          where: {
            tenantId: user.tid,
            staffProfileId: staff.id,
            courseId: { in: courseIds },
            deletedAt: null,
            canMarkAttendance: true,
          },
        });
        if (courseAssignment) return;
      }
    }
    const sessionMetadata = (session.metadata ?? {}) as any;
    const facultyTeam = Array.isArray(sessionMetadata.facultyTeam)
      ? sessionMetadata.facultyTeam
      : [];
    if (
      facultyTeam.some(
        (member: { staffProfileId?: string }) =>
          member.staffProfileId === staff.id,
      )
    ) {
      return;
    }
    if (!session.offeringSectionId) {
      throw new BadRequestException(
        'You are not authorized to mark this attendance session',
      );
    }
    const assignment = await (
      this.prisma as any
    ).subjectTeachingAssignment.findFirst({
      where: {
        tenantId: user.tid,
        staffProfileId: staff.id,
        offeringSectionId: session.offeringSectionId,
        deletedAt: null,
        canMarkAttendance: true,
      },
    });
    if (!assignment)
      throw new BadRequestException(
        'You are not authorized to mark this attendance session',
      );
  }

  private async studentsForSection(
    tenantId: string,
    offeringSectionId?: string | null,
    semesterNo?: number | null,
  ) {
    if (!offeringSectionId) return [];
    const lines = await this.prisma.semesterRegistrationLine.findMany({
      where: {
        tenantId,
        offeringSectionId,
        status: { in: ['approved', 'confirmed', 'registered', 'pending'] },
        registration: {
          ...(semesterNo ? { semesterSequence: semesterNo } : {}),
        },
      },
      include: {
        registration: {
          include: {
            student: {
              include: {
                masterProfile: true,
                user: { select: { displayName: true } },
              },
            },
          },
        },
      },
      take: 500,
    });
    return lines.map((line) => line.registration.student);
  }

  private async recalculateForSession(tenantId: string, sessionId: string) {
    const session = await (
      this.prisma as any
    ).studentAttendanceSession.findFirst({
      where: { tenantId, id: sessionId },
      include: { entries: true },
    });
    if (!session) return;
    const paperTargets = session.teachingSubjectGroupId
      ? await this.subjectGroups.linkedPaperIds(
          tenantId,
          session.teachingSubjectGroupId,
        )
      : session.courseId
        ? [
            {
              courseId: session.courseId,
              offeringSectionId: session.offeringSectionId,
            },
          ]
        : [];

    if (!paperTargets.length) return;

    for (const entry of session.entries) {
      for (const paper of paperTargets) {
        const sessionFilter: Record<string, unknown> = {
          deletedAt: null,
          status: { not: 'CANCELLED' },
          semesterNo: session.semesterNo,
        };
        if (session.teachingSubjectGroupId) {
          sessionFilter.teachingSubjectGroupId = session.teachingSubjectGroupId;
        } else {
          sessionFilter.courseId = paper.courseId;
          sessionFilter.offeringSectionId =
            paper.offeringSectionId ?? session.offeringSectionId;
        }

        const allEntries = await (
          this.prisma as any
        ).studentAttendanceEntry.findMany({
          where: {
            tenantId,
            studentId: entry.studentId,
            session: sessionFilter,
          },
        });
        const counted = allEntries.filter(
          (row: any) => !NEUTRAL_STATUSES.has(row.status),
        );
        const present = counted.filter((row: any) =>
          PRESENT_STATUSES.has(row.status),
        ).length;
        const absent = counted.filter((row: any) =>
          ABSENT_STATUSES.has(row.status),
        ).length;
        const medical = counted.filter((row: any) =>
          MEDICAL_STATUSES.has(row.status),
        ).length;
        const percentage = counted.length
          ? Math.round((present / counted.length) * 10000) / 100
          : 0;
        await (this.prisma as any).studentAttendanceSummary.upsert({
          where: {
            studentId_courseId_offeringSectionId_semesterNo_periodKey: {
              studentId: entry.studentId,
              courseId: paper.courseId,
              offeringSectionId:
                paper.offeringSectionId ?? session.offeringSectionId,
              semesterNo: session.semesterNo,
              periodKey: 'SEMESTER',
            },
          },
          create: {
            tenantId,
            studentId: entry.studentId,
            courseId: paper.courseId,
            offeringSectionId:
              paper.offeringSectionId ?? session.offeringSectionId,
            semesterNo: session.semesterNo,
            periodKey: 'SEMESTER',
            totalSessions: counted.length,
            presentCount: present,
            absentCount: absent,
            medicalLeaveCount: medical,
            percentage,
            metadata: session.teachingSubjectGroupId
              ? { teachingSubjectGroupId: session.teachingSubjectGroupId }
              : {},
          },
          update: {
            totalSessions: counted.length,
            presentCount: present,
            absentCount: absent,
            medicalLeaveCount: medical,
            percentage,
            calculatedAt: new Date(),
            metadata: session.teachingSubjectGroupId
              ? { teachingSubjectGroupId: session.teachingSubjectGroupId }
              : {},
          },
        });
      }
    }
  }

  private async enrichSession(session: any) {
    const [course, section, faculty, classroom, subjectGroup, linkedPapers] =
      await Promise.all([
        session.courseId
          ? this.prisma.course.findFirst({
              where: { id: session.courseId },
              select: { code: true, title: true, courseType: true },
            })
          : null,
        session.offeringSectionId
          ? this.prisma.offeringSection.findFirst({
              where: { id: session.offeringSectionId },
              select: { sectionCode: true },
            })
          : null,
        session.primaryFacultyId
          ? this.prisma.staffProfile.findFirst({
              where: { id: session.primaryFacultyId },
              select: { fullName: true, shortCode: true, employeeCode: true },
            })
          : null,
        session.classroomId
          ? this.prisma.classroom.findFirst({
              where: { id: session.classroomId },
              include: { campus: true, roomType: true },
            })
          : null,
        session.teachingSubjectGroupId
          ? (this.prisma as any).teachingSubjectGroup.findFirst({
              where: { id: session.teachingSubjectGroupId },
              select: {
                id: true,
                code: true,
                title: true,
                fyugpCategory: true,
              },
            })
          : null,
        session.teachingSubjectGroupId
          ? this.subjectGroups.linkedPaperIds(
              session.tenantId,
              session.teachingSubjectGroupId,
            )
          : Promise.resolve([]),
      ]);
    const entries = session.entries ?? [];
    const paperCourses = linkedPapers.length
      ? await this.prisma.course.findMany({
          where: { id: { in: linkedPapers.map((p: any) => p.courseId) } },
          select: { id: true, code: true, title: true },
        })
      : [];
    const displayCourse = subjectGroup
      ? {
          code: subjectGroup.code,
          title: subjectGroup.title,
          courseType: subjectGroup.fyugpCategory,
        }
      : course;
    return {
      ...session,
      course: displayCourse,
      subjectGroup,
      linkedPapers: paperCourses,
      section,
      faculty,
      classroom,
      location: classroom
        ? {
            roomCode: classroom.code,
            roomName: classroom.name,
            campus: classroom.campus?.name ?? null,
            roomType: classroom.roomType?.name ?? null,
            buildingId: (classroom as any).buildingId ?? null,
            floorId: (classroom as any).floorId ?? null,
          }
        : null,
      counts: {
        total: entries.length,
        present: entries.filter((entry: any) =>
          PRESENT_STATUSES.has(entry.status),
        ).length,
        absent: entries.filter((entry: any) => entry.status === 'A').length,
        other: entries.filter(
          (entry: any) => !['P', 'A'].includes(entry.status),
        ).length,
      },
    };
  }

  private async audit(
    user: JwtUser,
    action: string,
    sessionId: string | null,
    studentId: string | null,
    metadata: Record<string, unknown>,
  ) {
    await (this.prisma as any).studentAttendanceAuditLog.create({
      data: {
        tenantId: user.tid,
        actorId: user.sub,
        sessionId,
        studentId,
        action,
        metadata,
      },
    });
  }

  private uniqueById(rows: any[]) {
    return Array.from(new Map(rows.map((row) => [row.id, row])).values());
  }

  private startOfDay(value: string | Date) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private addHours(value: Date, hours: number) {
    return new Date(value.getTime() + hours * 60 * 60 * 1000);
  }

  private timeOnly(value: string) {
    const [hours, minutes = '0'] = value.split(':');
    const date = new Date(0);
    date.setUTCHours(Number(hours), Number(minutes), 0, 0);
    return date;
  }
}
