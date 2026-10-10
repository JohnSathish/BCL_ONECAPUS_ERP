import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { IA_EXAM_TYPES } from './ia.constants';
import { IaSettingsService } from './ia-settings.service';

type Filters = {
  sessionId?: string;
  programmeCode?: string;
  departmentId?: string;
  semesterNo?: number;
  shiftId?: string;
};

type RosterStudent = {
  id: string;
  rollNumber: string | null;
  fullName: string | null;
  programme: string | null;
  programmeCode: string | null;
  department: string | null;
  departmentId: string | null;
  semesterNo: number | null;
  shiftId: string | null;
};

@Injectable()
export class IaAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: IaSettingsService,
  ) {}

  async report(tenantId: string, filters?: Filters) {
    const cfg = await this.settings.getOrCreate(tenantId);
    const passMark = Number(cfg.iaPassMarkPercent ?? 40);
    const attendanceTarget = Number(cfg.attendanceMinPercent ?? 75);

    const sessions = await this.prisma.examSession.findMany({
      where: {
        tenantId,
        deletedAt: null,
        examType: { in: [...IA_EXAM_TYPES] },
        ...(filters?.sessionId ? { id: filters.sessionId } : {}),
      },
      select: { id: true },
    });
    const sessionIds = sessions.map((session) => session.id);
    const papers = sessionIds.length
      ? await this.prisma.examPaperSchedule.findMany({
          where: {
            tenantId,
            deletedAt: null,
            sessionId: { in: sessionIds },
            ...(filters?.semesterNo != null
              ? { semesterNo: filters.semesterNo }
              : {}),
          },
          select: {
            id: true,
            paperCode: true,
            paperName: true,
            semesterNo: true,
            offeringId: true,
            courseId: true,
          },
        })
      : [];

    const roster = await this.rosterForPapers(tenantId, papers);
    const programmes = uniquePairs(
      roster.map(
        (student) => [student.programmeCode, student.programme] as const,
      ),
    );
    const departments = uniquePairs(
      roster.map(
        (student) => [student.departmentId, student.department] as const,
      ),
    );
    const semesters = [
      ...new Set(
        papers
          .map((paper) => paper.semesterNo)
          .filter((semester): semester is number => semester != null),
      ),
    ].sort((a, b) => a - b);
    const shifts = await this.prisma.shift.findMany({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 20,
    });

    const cohort = roster.filter((student) => {
      if (
        filters?.programmeCode &&
        student.programmeCode !== filters.programmeCode
      )
        return false;
      if (
        filters?.departmentId &&
        student.departmentId !== filters.departmentId
      )
        return false;
      if (
        filters?.semesterNo != null &&
        student.semesterNo !== filters.semesterNo
      )
        return false;
      if (filters?.shiftId && student.shiftId !== filters.shiftId) return false;
      return true;
    });

    const paperIds = papers.map((paper) => paper.id);
    const studentIds = cohort.map((student) => student.id);
    const marks =
      paperIds.length && studentIds.length
        ? await this.prisma.iaComponentMark.findMany({
            where: {
              tenantId,
              deletedAt: null,
              paperId: { in: paperIds },
              studentId: { in: studentIds },
            },
            select: {
              studentId: true,
              paperId: true,
              marks: true,
              maxMarks: true,
              isAbsent: true,
            },
          })
        : [];

    const paperById = new Map(papers.map((paper) => [paper.id, paper]));
    const byStudentPaper = new Map<
      string,
      {
        marks: number;
        max: number;
        rows: number;
        absentRows: number;
        scoredRows: number;
      }
    >();
    for (const mark of marks) {
      if (!mark.paperId) continue;
      const key = `${mark.studentId}:${mark.paperId}`;
      const current = byStudentPaper.get(key) ?? {
        marks: 0,
        max: 0,
        rows: 0,
        absentRows: 0,
        scoredRows: 0,
      };
      current.rows += 1;
      current.max += Number(mark.maxMarks ?? 0);
      if (mark.isAbsent) current.absentRows += 1;
      else if (mark.marks != null) {
        current.marks += Number(mark.marks);
        current.scoredRows += 1;
      }
      byStudentPaper.set(key, current);
    }

    const studentScores = new Map<string, number[]>();
    const studentAbsentPapers = new Map<string, number>();
    const paperScores = new Map<string, number[]>();

    for (const [key, value] of byStudentPaper) {
      const [studentId, paperId] = key.split(':');
      if (!studentId || !paperId) continue;
      if (value.scoredRows > 0 && value.max > 0) {
        const percent = (value.marks / value.max) * 100;
        const scores = studentScores.get(studentId) ?? [];
        scores.push(percent);
        studentScores.set(studentId, scores);
        const paper = paperScores.get(paperId) ?? [];
        paper.push(percent);
        paperScores.set(paperId, paper);
      } else if (value.rows > 0 && value.absentRows === value.rows) {
        studentAbsentPapers.set(
          studentId,
          (studentAbsentPapers.get(studentId) ?? 0) + 1,
        );
      }
    }

    const performers = cohort
      .map((student) => {
        const scores = studentScores.get(student.id);
        if (!scores?.length) return null;
        const percentage = round1(
          scores.reduce((sum, score) => sum + score, 0) / scores.length,
        );
        return {
          studentId: student.id,
          rollNumber: student.rollNumber,
          fullName: student.fullName,
          programme: student.programme,
          department: student.department,
          percentage,
          passed: percentage >= passMark,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null)
      .sort((a, b) => b.percentage - a.percentage);

    const appeared = performers.length;
    const absent = cohort.filter(
      (student) =>
        !studentScores.has(student.id) &&
        (studentAbsentPapers.get(student.id) ?? 0) > 0,
    ).length;
    const passed = performers.filter((student) => student.passed).length;
    const averageScore = appeared
      ? round1(
          performers.reduce((sum, student) => sum + student.percentage, 0) /
            appeared,
        )
      : null;
    const passPercent = appeared ? round1((passed / appeared) * 100) : null;

    const subjects = [...paperScores.entries()]
      .map(([paperId, scores]) => {
        const paper = paperById.get(paperId);
        const average = round1(
          scores.reduce((sum, score) => sum + score, 0) / scores.length,
        );
        return {
          paperId,
          paperCode: paper?.paperCode ?? paperId,
          paperName: paper?.paperName ?? '',
          average,
          students: scores.length,
        };
      })
      .sort((a, b) => b.average - a.average);

    const programmeMap = new Map<string, number[]>();
    const departmentMap = new Map<
      string,
      { students: number; scores: number[]; passed: number }
    >();
    for (const student of cohort) {
      const departmentName = student.department || 'Unassigned';
      const bucket = departmentMap.get(departmentName) ?? {
        students: 0,
        scores: [],
        passed: 0,
      };
      bucket.students += 1;
      departmentMap.set(departmentName, bucket);
    }
    for (const performer of performers) {
      const programmeName = performer.programme || 'Unassigned';
      const scores = programmeMap.get(programmeName) ?? [];
      scores.push(performer.percentage);
      programmeMap.set(programmeName, scores);
      const departmentName = performer.department || 'Unassigned';
      const bucket = departmentMap.get(departmentName) ?? {
        students: 0,
        scores: [],
        passed: 0,
      };
      bucket.scores.push(performer.percentage);
      if (performer.passed) bucket.passed += 1;
      departmentMap.set(departmentName, bucket);
    }

    const programmeAverages = [...programmeMap.entries()]
      .map(([name, scores]) => ({
        name,
        average: round1(
          scores.reduce((sum, score) => sum + score, 0) / scores.length,
        ),
        students: scores.length,
      }))
      .sort((a, b) => b.average - a.average);

    const departmentRows = [...departmentMap.entries()]
      .map(([name, bucket]) => ({
        name,
        students: bucket.students,
        average: bucket.scores.length
          ? round1(
              bucket.scores.reduce((sum, score) => sum + score, 0) /
                bucket.scores.length,
            )
          : null,
        passPercent: bucket.scores.length
          ? round1((bucket.passed / bucket.scores.length) * 100)
          : null,
      }))
      .sort((a, b) => (b.average ?? -1) - (a.average ?? -1));

    const lowest = [...performers].sort((a, b) => a.percentage - b.percentage);
    const appearancePercent = cohort.length
      ? round1((appeared / cohort.length) * 100)
      : null;
    const below60 = subjects.filter((subject) => subject.average < 60);

    return {
      passMark,
      attendanceTarget,
      totalStudents: cohort.length,
      appeared,
      absent,
      notEntered: Math.max(cohort.length - appeared - absent, 0),
      subjects: papers.length,
      averageScore,
      passPercent,
      passed,
      appearancePercent,
      programmes,
      departments,
      semesters,
      shifts,
      subjectPerformance: subjects.slice(0, 10),
      programmeAverages: programmeAverages.slice(0, 8),
      topPerformers: performers.slice(0, 20),
      lowestPerformers: lowest.slice(0, 20),
      departmentPerformance: departmentRows,
      insights: {
        appearancePercent,
        attendanceTarget,
        highestSubject: subjects[0] ?? null,
        subjectsBelow60: below60.length,
        absent,
      },
    };
  }

  private async rosterForPapers(
    tenantId: string,
    papers: Array<{
      offeringId: string | null;
      courseId: string | null;
      semesterNo: number | null;
    }>,
  ) {
    const offeringIds = papers
      .map((paper) => paper.offeringId)
      .filter((id): id is string => Boolean(id));
    const courseIds = papers
      .map((paper) => paper.courseId)
      .filter((id): id is string => Boolean(id));
    if (!offeringIds.length && !courseIds.length) return [];

    const lines = await this.prisma.semesterRegistrationLine.findMany({
      where: {
        tenantId,
        status: { in: ['approved', 'confirmed', 'registered', 'pending'] },
        OR: [
          ...(offeringIds.length ? [{ offeringId: { in: offeringIds } }] : []),
          ...(courseIds.length
            ? [{ offering: { courseId: { in: courseIds } } }]
            : []),
        ],
      },
      select: {
        registration: {
          select: {
            studentId: true,
            shiftId: true,
            semesterSequence: true,
            student: {
              select: {
                id: true,
                rollNumber: true,
                primaryShiftId: true,
                departmentId: true,
                user: { select: { displayName: true } },
                department: { select: { name: true } },
                programVersion: {
                  select: { program: { select: { name: true, code: true } } },
                },
                academicStanding: { select: { currentSemesterSequence: true } },
              },
            },
          },
        },
      },
    });

    const byId = new Map<string, RosterStudent>();
    for (const line of lines) {
      const student = line.registration.student;
      if (!student || byId.has(student.id)) continue;
      byId.set(student.id, {
        id: student.id,
        rollNumber: student.rollNumber,
        fullName: student.user?.displayName ?? null,
        programme: student.programVersion?.program?.name ?? null,
        programmeCode: student.programVersion?.program?.code ?? null,
        department: student.department?.name ?? null,
        departmentId: student.departmentId,
        semesterNo:
          line.registration.semesterSequence ??
          student.academicStanding?.currentSemesterSequence ??
          null,
        shiftId: line.registration.shiftId ?? student.primaryShiftId ?? null,
      });
    }
    return [...byId.values()];
  }
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function uniquePairs(pairs: Array<readonly [string | null, string | null]>) {
  const map = new Map<string, string>();
  for (const [id, name] of pairs) {
    if (id && name) map.set(id, name);
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
