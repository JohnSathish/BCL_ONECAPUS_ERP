import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import {
  AllocateRoomsDto,
  ExamPaperDto,
  ExamQueryDto,
  ExamSessionDto,
  GenerateSeatingDto,
  InvigilatorDto,
  SaveExamMarksDto,
} from './dto/examinations.dto';
import { CommunicationTriggerService } from '../communication/services/communication-trigger.service';
import { FeeEnforcementService } from '../fees/services/fee-enforcement.service';
import { LicenseEnforcementService } from '../licensing/services/license-enforcement.service';
import { IaSettingsService } from './ia/ia-settings.service';

@Injectable()
export class ExaminationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly communication: CommunicationTriggerService,
    private readonly licenseEnforcement: LicenseEnforcementService,
    private readonly feeEnforcement: FeeEnforcementService,
    private readonly iaSettings: IaSettingsService,
  ) {}

  private async assertLegacyUniversityMode(tenantId: string) {
    await this.iaSettings.assertLegacyEnabled(tenantId);
  }

  async dashboard(tenantId: string) {
    const [sessions, papers, rooms, seats, invigilators, marks, results] =
      await Promise.all([
        (this.prisma as any).examSession.count({
          where: { tenantId, deletedAt: null },
        }),
        (this.prisma as any).examPaperSchedule.count({
          where: { tenantId, deletedAt: null },
        }),
        (this.prisma as any).examRoomAllocation.count({
          where: { tenantId, deletedAt: null },
        }),
        (this.prisma as any).examSeatAllocation.count({
          where: { tenantId, deletedAt: null },
        }),
        (this.prisma as any).examInvigilatorAssignment.count({
          where: { tenantId, deletedAt: null },
        }),
        (this.prisma as any).examMarkEntry.count({
          where: { tenantId, deletedAt: null },
        }),
        (this.prisma as any).examResultSummary.count({
          where: { tenantId, deletedAt: null },
        }),
      ]);
    return {
      sessions,
      papers,
      roomAllocations: rooms,
      seats,
      invigilators,
      marks,
      results,
    };
  }

  listSessions(tenantId: string, query: ExamQueryDto) {
    return (this.prisma as any).examSession.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 200,
    });
  }

  async createSession(user: JwtUser, dto: ExamSessionDto) {
    await this.licenseEnforcement.assertWriteAllowed(
      user.tid,
      'examination.write',
    );
    this.assertText(dto.name, 'Exam session name is required.');
    const row = await (this.prisma as any).examSession.create({
      data: {
        tenantId: user.tid,
        name: dto.name.trim(),
        academicYearId: dto.academicYearId,
        shiftId: dto.shiftId,
        examType: dto.examType ?? 'SEMESTER_END',
        semesterNo: dto.semesterNo,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        status: dto.status ?? 'DRAFT',
        instructions: dto.instructions,
        createdById: user.sub,
      },
    });
    await this.audit(user, 'SESSION', row.id, 'CREATE', null, row);
    return row;
  }

  async updateSession(user: JwtUser, id: string, dto: Partial<ExamSessionDto>) {
    await this.licenseEnforcement.assertWriteAllowed(
      user.tid,
      'examination.write',
    );
    const before = await this.sessionOrThrow(user.tid, id);
    if (dto.name != null)
      this.assertText(dto.name, 'Exam session name is required.');
    const row = await (this.prisma as any).examSession.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.startDate ? { startDate: new Date(dto.startDate) } : {}),
        ...(dto.endDate ? { endDate: new Date(dto.endDate) } : {}),
      },
    });
    await this.audit(user, 'SESSION', id, 'UPDATE', before, row);
    return row;
  }

  async archiveSession(user: JwtUser, id: string) {
    const before = await this.sessionOrThrow(user.tid, id);
    const row = await (this.prisma as any).examSession.update({
      where: { id },
      data: { status: 'ARCHIVED', deletedAt: new Date() },
    });
    await this.audit(user, 'SESSION', id, 'ARCHIVE', before, row);
    return row;
  }

  listPapers(tenantId: string, query: ExamQueryDto) {
    return (this.prisma as any).examPaperSchedule.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(query.sessionId ? { sessionId: query.sessionId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.from && query.to
          ? { examDate: { gte: new Date(query.from), lte: new Date(query.to) } }
          : {}),
      },
      orderBy: [{ examDate: 'asc' }, { startTime: 'asc' }],
      take: 300,
    });
  }

  async createPaper(user: JwtUser, dto: ExamPaperDto) {
    await this.licenseEnforcement.assertWriteAllowed(
      user.tid,
      'examination.write',
    );
    await this.sessionOrThrow(user.tid, dto.sessionId);
    this.assertText(dto.paperCode, 'Paper code is required.');
    this.assertText(dto.paperName, 'Paper name is required.');
    if (this.timeDate(dto.endTime) <= this.timeDate(dto.startTime)) {
      throw new BadRequestException('Exam end time must be after start time.');
    }
    const clash = await (this.prisma as any).examPaperSchedule.findFirst({
      where: {
        tenantId: user.tid,
        deletedAt: null,
        examDate: new Date(dto.examDate),
        paperCode: dto.paperCode.trim().toUpperCase(),
      },
    });
    if (clash)
      throw new BadRequestException(
        'This paper is already scheduled on the selected date.',
      );
    const row = await (this.prisma as any).examPaperSchedule.create({
      data: {
        tenantId: user.tid,
        sessionId: dto.sessionId,
        courseId: dto.courseId,
        offeringId: dto.offeringId,
        paperCode: dto.paperCode.trim().toUpperCase(),
        paperName: dto.paperName.trim(),
        examDate: new Date(dto.examDate),
        startTime: this.timeDate(dto.startTime),
        endTime: this.timeDate(dto.endTime),
        semesterNo: dto.semesterNo,
        expectedCount: dto.expectedCount ?? 0,
        status: dto.status ?? 'SCHEDULED',
      },
    });
    await this.audit(user, 'PAPER', row.id, 'CREATE', null, row);
    return row;
  }

  async updatePaper(user: JwtUser, id: string, dto: Partial<ExamPaperDto>) {
    const before = await this.paperOrThrow(user.tid, id);
    const row = await (this.prisma as any).examPaperSchedule.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.paperCode
          ? { paperCode: dto.paperCode.trim().toUpperCase() }
          : {}),
        ...(dto.paperName ? { paperName: dto.paperName.trim() } : {}),
        ...(dto.examDate ? { examDate: new Date(dto.examDate) } : {}),
        ...(dto.startTime ? { startTime: this.timeDate(dto.startTime) } : {}),
        ...(dto.endTime ? { endTime: this.timeDate(dto.endTime) } : {}),
      },
    });
    await this.audit(user, 'PAPER', id, 'UPDATE', before, row);
    return row;
  }

  async allocateRooms(user: JwtUser, paperId: string, dto: AllocateRoomsDto) {
    await this.assertLegacyUniversityMode(user.tid);
    const paper = await this.paperOrThrow(user.tid, paperId);
    const requested = dto.roomIds?.length
      ? await this.prisma.classroom.findMany({
          where: {
            tenantId: user.tid,
            id: { in: dto.roomIds },
            deletedAt: null,
          },
          include: { roomType: true },
        })
      : await this.prisma.classroom.findMany({
          where: {
            tenantId: user.tid,
            deletedAt: null,
            status: 'ACTIVE',
            availableForExams: true,
          } as any,
          include: { roomType: true },
          orderBy: [{ capacity: 'desc' }],
        });
    const rooms = [];
    for (const room of requested as any[]) {
      if (await this.roomAvailable(user.tid, room.id, paper)) rooms.push(room);
    }
    if (!rooms.length)
      throw new BadRequestException(
        'No available exam rooms found for this paper.',
      );
    await (this.prisma as any).examRoomAllocation.deleteMany({
      where: { tenantId: user.tid, paperId, deletedAt: null },
    });
    let remaining = Number(paper.expectedCount ?? 0);
    const created = [];
    for (const room of rooms) {
      if (remaining <= 0 && paper.expectedCount > 0) break;
      const examCapacity = Number(room.examCapacity ?? room.capacity ?? 0);
      if (examCapacity <= 0) continue;
      const capacityUsed =
        paper.expectedCount > 0
          ? Math.min(remaining, examCapacity)
          : examCapacity;
      const row = await (this.prisma as any).examRoomAllocation.create({
        data: {
          tenantId: user.tid,
          sessionId: paper.sessionId,
          paperId,
          classroomId: room.id,
          capacityUsed,
          metadata: {
            roomCode: room.code,
            roomName: room.name,
            examCapacity,
          },
        },
      });
      created.push(row);
      remaining -= capacityUsed;
    }
    if (paper.expectedCount > 0 && remaining > 0) {
      throw new BadRequestException(
        `Insufficient exam room capacity. ${remaining} seats still required.`,
      );
    }
    await this.audit(user, 'ROOM_ALLOCATION', paperId, 'ALLOCATE', null, {
      count: created.length,
    });
    return {
      allocatedRooms: created,
      totalCapacity: created.reduce(
        (sum, row) => sum + Number(row.capacityUsed ?? 0),
        0,
      ),
    };
  }

  async generateSeating(
    user: JwtUser,
    paperId: string,
    dto: GenerateSeatingDto,
  ) {
    await this.assertLegacyUniversityMode(user.tid);
    const paper = await this.paperOrThrow(user.tid, paperId);
    const allocations = await (this.prisma as any).examRoomAllocation.findMany({
      where: { tenantId: user.tid, paperId, deletedAt: null },
      orderBy: [{ createdAt: 'asc' }],
    });
    if (!allocations.length)
      throw new BadRequestException(
        'Allocate rooms before generating seating.',
      );
    await (this.prisma as any).examSeatAllocation.deleteMany({
      where: { tenantId: user.tid, paperId, deletedAt: null },
    });
    const students = await this.studentsForPaper(user.tid, paper);
    const count = Math.min(
      dto.count ?? Number(paper.expectedCount ?? students.length),
      students.length || Number(paper.expectedCount ?? 0),
    );
    const seats = [];
    let index = 0;
    for (const allocation of allocations) {
      for (
        let seat = 1;
        seat <= Number(allocation.capacityUsed ?? 0) && index < count;
        seat += 1
      ) {
        const student = students[index];
        const rowLabel = String.fromCharCode(65 + Math.floor((seat - 1) / 10));
        const columnNo = ((seat - 1) % 10) + 1;
        seats.push({
          tenantId: user.tid,
          sessionId: paper.sessionId,
          paperId,
          roomAllocationId: allocation.id,
          classroomId: allocation.classroomId,
          studentId: student?.id ?? null,
          rollNumber:
            student?.rollNumber ??
            student?.admissionNumber ??
            `TEMP-${index + 1}`,
          seatNumber: `${(allocation.metadata as any)?.roomCode ?? 'ROOM'}-${rowLabel}${columnNo}`,
          rowLabel,
          columnNo,
          metadata: {
            studentName:
              student?.masterProfile?.fullName ??
              student?.user?.displayName ??
              null,
          },
        });
        index += 1;
      }
    }
    if (seats.length)
      await (this.prisma as any).examSeatAllocation.createMany({ data: seats });
    await this.audit(user, 'SEATING', paperId, 'GENERATE', null, {
      count: seats.length,
    });
    return { generatedSeats: seats.length };
  }

  async assignInvigilator(user: JwtUser, paperId: string, dto: InvigilatorDto) {
    await this.assertLegacyUniversityMode(user.tid);
    const paper = await this.paperOrThrow(user.tid, paperId);
    const room = await (this.prisma as any).examRoomAllocation.findFirst({
      where: {
        tenantId: user.tid,
        paperId,
        classroomId: dto.classroomId,
        deletedAt: null,
      },
    });
    if (!room)
      throw new BadRequestException(
        'Room is not allocated to this exam paper.',
      );
    const clash = await (
      this.prisma as any
    ).examInvigilatorAssignment.findFirst({
      where: {
        tenantId: user.tid,
        staffProfileId: dto.staffProfileId,
        deletedAt: null,
        paperId: { not: paperId },
      },
    });
    if (clash)
      throw new BadRequestException(
        'Selected staff already has an invigilation assignment.',
      );
    const row = await (this.prisma as any).examInvigilatorAssignment.upsert({
      where: {
        paperId_classroomId_staffProfileId: {
          paperId,
          classroomId: dto.classroomId,
          staffProfileId: dto.staffProfileId,
        },
      },
      create: {
        tenantId: user.tid,
        sessionId: paper.sessionId,
        paperId,
        classroomId: dto.classroomId,
        staffProfileId: dto.staffProfileId,
        role: dto.role ?? 'INVIGILATOR',
        remarks: dto.remarks,
      },
      update: {
        role: dto.role ?? 'INVIGILATOR',
        remarks: dto.remarks,
        status: 'ASSIGNED',
      },
    });
    await this.audit(user, 'INVIGILATOR', row.id, 'ASSIGN', null, row);
    return row;
  }

  async markRoster(tenantId: string, paperId: string) {
    const paper = await this.paperOrThrow(tenantId, paperId);
    const [seats, existing] = await Promise.all([
      (this.prisma as any).examSeatAllocation.findMany({
        where: { tenantId, paperId, deletedAt: null },
        orderBy: [{ seatNumber: 'asc' }],
      }),
      (this.prisma as any).examMarkEntry.findMany({
        where: { tenantId, paperId, deletedAt: null },
      }),
    ]);
    const seatedStudentIds = seats
      .map((seat: any) => seat.studentId)
      .filter(Boolean);
    const students = seatedStudentIds.length
      ? await this.prisma.student.findMany({
          where: { tenantId, id: { in: seatedStudentIds } },
          include: {
            masterProfile: true,
            user: { select: { displayName: true } },
          },
        })
      : await this.studentsForPaper(tenantId, paper);
    const markByStudent = new Map(
      existing.map((entry: any) => [entry.studentId, entry]),
    );
    const seatByStudent = new Map(
      seats.map((seat: any) => [seat.studentId, seat]),
    );
    return {
      paper,
      rows: students.map((student: any) => ({
        student,
        seat: seatByStudent.get(student.id) ?? null,
        mark: markByStudent.get(student.id) ?? null,
      })),
    };
  }

  async saveMarks(user: JwtUser, paperId: string, dto: SaveExamMarksDto) {
    await this.licenseEnforcement.assertWriteAllowed(
      user.tid,
      'examination.write',
    );
    const paper = await this.paperOrThrow(user.tid, paperId);
    const saved = [];
    for (const entry of dto.entries ?? []) {
      const total =
        Number(entry.internalMarks ?? 0) +
        Number(entry.externalMarks ?? 0) +
        Number(entry.practicalMarks ?? 0) +
        Number(entry.graceMarks ?? 0);
      const maxMarks = Number(entry.maxMarks ?? 100);
      const status = entry.resultStatus ?? this.resultStatus(total, maxMarks);
      const grade = this.gradeFor(total, maxMarks);
      const row = await (this.prisma as any).examMarkEntry.upsert({
        where: { paperId_studentId: { paperId, studentId: entry.studentId } },
        create: {
          tenantId: user.tid,
          sessionId: paper.sessionId,
          paperId,
          studentId: entry.studentId,
          internalMarks: entry.internalMarks,
          externalMarks: entry.externalMarks,
          practicalMarks: entry.practicalMarks,
          graceMarks: entry.graceMarks,
          totalMarks: total,
          maxMarks,
          grade,
          gradePoint: this.gradePoint(grade),
          resultStatus: status,
          entryStatus: entry.entryStatus ?? 'DRAFT',
          remarks: entry.remarks,
          enteredById: user.sub,
        },
        update: {
          internalMarks: entry.internalMarks,
          externalMarks: entry.externalMarks,
          practicalMarks: entry.practicalMarks,
          graceMarks: entry.graceMarks,
          totalMarks: total,
          maxMarks,
          grade,
          gradePoint: this.gradePoint(grade),
          resultStatus: status,
          entryStatus: entry.entryStatus ?? 'DRAFT',
          remarks: entry.remarks,
          enteredById: user.sub,
        },
      });
      saved.push(row);
    }
    await this.audit(user, 'MARK_ENTRY', paperId, 'SAVE', null, {
      count: saved.length,
    });
    return { saved: saved.length, entries: saved };
  }

  async calculateResults(user: JwtUser, sessionId: string) {
    await this.assertLegacyUniversityMode(user.tid);
    await this.sessionOrThrow(user.tid, sessionId);
    const entries = await (this.prisma as any).examMarkEntry.findMany({
      where: { tenantId: user.tid, sessionId, deletedAt: null },
    });
    const byStudent = new Map<string, any[]>();
    for (const entry of entries) {
      byStudent.set(entry.studentId, [
        ...(byStudent.get(entry.studentId) ?? []),
        entry,
      ]);
    }
    const summaries = [];
    for (const [studentId, rows] of byStudent.entries()) {
      const totalMarks = rows.reduce(
        (sum, row) => sum + Number(row.totalMarks ?? 0),
        0,
      );
      const maxMarks = rows.reduce(
        (sum, row) => sum + Number(row.maxMarks ?? 0),
        0,
      );
      const percentage =
        maxMarks > 0 ? Number(((totalMarks / maxMarks) * 100).toFixed(2)) : 0;
      const hasFail = rows.some((row) =>
        ['FAIL', 'ABSENT', 'MALPRACTICE'].includes(row.resultStatus),
      );
      const resultStatus = hasFail ? 'FAIL' : 'PASS';
      const summary = await (this.prisma as any).examResultSummary.upsert({
        where: { sessionId_studentId: { sessionId, studentId } },
        create: {
          tenantId: user.tid,
          sessionId,
          studentId,
          totalMarks,
          maxMarks,
          percentage,
          sgpa: this.sgpaFromPercentage(percentage),
          resultStatus,
          publishStatus: 'DRAFT',
          calculatedAt: new Date(),
          metadata: { papers: rows.length },
        },
        update: {
          totalMarks,
          maxMarks,
          percentage,
          sgpa: this.sgpaFromPercentage(percentage),
          resultStatus,
          calculatedAt: new Date(),
          metadata: { papers: rows.length },
        },
      });
      summaries.push(summary);
    }
    await this.audit(user, 'RESULT_SUMMARY', sessionId, 'CALCULATE', null, {
      count: summaries.length,
    });
    return { calculated: summaries.length, summaries };
  }

  async publishResults(user: JwtUser, sessionId: string) {
    await this.assertLegacyUniversityMode(user.tid);
    await this.licenseEnforcement.assertWriteAllowed(
      user.tid,
      'examination.write',
    );
    await this.sessionOrThrow(user.tid, sessionId);
    const now = new Date();
    const [summaries, marks] = await Promise.all([
      (this.prisma as any).examResultSummary.updateMany({
        where: { tenantId: user.tid, sessionId, deletedAt: null },
        data: { publishStatus: 'PUBLISHED', publishedAt: now },
      }),
      (this.prisma as any).examMarkEntry.updateMany({
        where: { tenantId: user.tid, sessionId, deletedAt: null },
        data: { entryStatus: 'PUBLISHED', publishedAt: now },
      }),
    ]);
    await this.audit(user, 'RESULT_SUMMARY', sessionId, 'PUBLISH', null, {
      summaries: summaries.count,
      marks: marks.count,
    });
    void this.notifyResultsPublished(user.tid, sessionId);
    return { publishedResults: summaries.count, publishedMarks: marks.count };
  }

  private async notifyResultsPublished(tenantId: string, sessionId: string) {
    const session = await (this.prisma as any).examSession.findFirst({
      where: { id: sessionId, tenantId, deletedAt: null },
    });
    if (!session) return;

    const summaries = await (this.prisma as any).examResultSummary.findMany({
      where: { tenantId, sessionId, deletedAt: null },
      select: { studentId: true },
      take: 5000,
    });
    const studentIds = [
      ...new Set(summaries.map((s: { studentId: string }) => s.studentId)),
    ] as string[];
    if (!studentIds.length) return;

    const students = await this.prisma.student.findMany({
      where: { tenantId, id: { in: studentIds }, deletedAt: null },
      include: {
        user: {
          select: { id: true, email: true, displayName: true, isActive: true },
        },
        masterProfile: { select: { fullName: true, email: true } },
      },
    });

    const institutionName =
      await this.communication.getInstitutionName(tenantId);
    const publishDate = new Date().toISOString().slice(0, 10);

    await this.communication.triggerBulk({
      tenantId,
      templateCode: 'EXAM_RESULTS_PUBLISHED',
      triggerKey: `exam.results_published.${sessionId}`,
      entityType: 'exam_session_student',
      channels: ['EMAIL', 'IN_APP'],
      recipients: students
        .filter((s) => s.user.isActive)
        .map((s) => {
          const displayName =
            s.masterProfile?.fullName ?? s.user.displayName ?? s.user.email;
          return {
            entityId: s.id,
            recipient: {
              recipientType: 'STUDENT' as const,
              userId: s.userId,
              studentId: s.id,
              displayName,
              email: s.masterProfile?.email ?? s.user.email,
            },
            variables: {
              student_name: displayName,
              exam_name: session.name,
              session_name: session.name,
              publish_date: publishDate,
              institution_name: institutionName,
            },
          };
        }),
    });
  }

  async resultReports(tenantId: string, query: ExamQueryDto) {
    const summaries = await (this.prisma as any).examResultSummary.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(query.sessionId ? { sessionId: query.sessionId } : {}),
      },
      orderBy: [{ percentage: 'desc' }],
      take: 1000,
    });
    const studentIds = summaries.map((summary: any) => summary.studentId);
    const students = studentIds.length
      ? await this.prisma.student.findMany({
          where: { tenantId, id: { in: studentIds } },
          include: {
            masterProfile: true,
            user: { select: { displayName: true } },
          },
        })
      : [];
    return {
      summaries,
      students,
      rows: summaries.map((summary: any) => ({
        ...summary,
        student:
          students.find((student) => student.id === summary.studentId) ?? null,
      })),
    };
  }

  async studentResults(user: JwtUser, sessionId?: string) {
    const student = await this.prisma.student.findFirst({
      where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
      include: {
        masterProfile: true,
        user: { select: { displayName: true } },
        programVersion: { include: { program: true } },
      },
    });
    if (!student)
      return { student: null, summaries: [], marks: [], papers: [] };
    const summaries = await (this.prisma as any).examResultSummary.findMany({
      where: {
        tenantId: user.tid,
        studentId: student.id,
        publishStatus: 'PUBLISHED',
        deletedAt: null,
        ...(sessionId ? { sessionId } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 20,
    });
    const sessionIds = Array.from(
      new Set(
        summaries.map((summary: any) => summary.sessionId).filter(Boolean),
      ),
    ) as string[];
    const marks = sessionIds.length
      ? await (this.prisma as any).examMarkEntry.findMany({
          where: {
            tenantId: user.tid,
            studentId: student.id,
            sessionId: { in: sessionIds },
            entryStatus: 'PUBLISHED',
            deletedAt: null,
          },
          orderBy: [{ createdAt: 'asc' }],
        })
      : [];
    const paperIds = Array.from(
      new Set(marks.map((mark: any) => mark.paperId).filter(Boolean)),
    ) as string[];
    const papers = paperIds.length
      ? await (this.prisma as any).examPaperSchedule.findMany({
          where: { tenantId: user.tid, id: { in: paperIds }, deletedAt: null },
        })
      : [];
    return {
      student: { ...student, program: student.programVersion?.program ?? null },
      summaries,
      marks,
      papers,
    };
  }

  async details(tenantId: string, paperId: string) {
    const paper = await this.paperOrThrow(tenantId, paperId);
    const [rooms, seats, invigilators] = await Promise.all([
      (this.prisma as any).examRoomAllocation.findMany({
        where: { tenantId, paperId, deletedAt: null },
      }),
      (this.prisma as any).examSeatAllocation.findMany({
        where: { tenantId, paperId, deletedAt: null },
        take: 1000,
      }),
      (this.prisma as any).examInvigilatorAssignment.findMany({
        where: { tenantId, paperId, deletedAt: null },
      }),
    ]);
    return { paper, rooms, seats, invigilators };
  }

  async printData(tenantId: string, type: string, query: ExamQueryDto) {
    const session = query.sessionId
      ? await (this.prisma as any).examSession.findFirst({
          where: { tenantId, id: query.sessionId, deletedAt: null },
        })
      : null;
    const papers = await this.listPapers(tenantId, query);
    if (type === 'timetable') return { session, papers };
    if (type === 'seating') {
      const seats = await (this.prisma as any).examSeatAllocation.findMany({
        where: {
          tenantId,
          deletedAt: null,
          ...(query.sessionId ? { sessionId: query.sessionId } : {}),
        },
        orderBy: [{ classroomId: 'asc' }, { seatNumber: 'asc' }],
        take: 2000,
      });
      const roomIds = Array.from(
        new Set(seats.map((seat: any) => seat.classroomId).filter(Boolean)),
      ) as string[];
      const rooms = roomIds.length
        ? await this.prisma.classroom.findMany({
            where: { tenantId, id: { in: roomIds } },
          })
        : [];
      return { session, papers, rooms, seats };
    }
    if (type === 'invigilators') {
      const invigilators = await (
        this.prisma as any
      ).examInvigilatorAssignment.findMany({
        where: {
          tenantId,
          deletedAt: null,
          ...(query.sessionId ? { sessionId: query.sessionId } : {}),
        },
        orderBy: [{ classroomId: 'asc' }],
        take: 1000,
      });
      const staffIds = Array.from(
        new Set(
          invigilators.map((row: any) => row.staffProfileId).filter(Boolean),
        ),
      ) as string[];
      const roomIds = Array.from(
        new Set(
          invigilators.map((row: any) => row.classroomId).filter(Boolean),
        ),
      ) as string[];
      const [staff, rooms] = await Promise.all([
        staffIds.length
          ? this.prisma.staffProfile.findMany({
              where: { tenantId, id: { in: staffIds } },
              select: {
                id: true,
                fullName: true,
                shortCode: true,
                employeeCode: true,
              },
            })
          : [],
        roomIds.length
          ? this.prisma.classroom.findMany({
              where: { tenantId, id: { in: roomIds } },
            })
          : [],
      ]);
      return { session, papers, invigilators, staff, rooms };
    }
    return { session, papers };
  }

  async studentAdmitCard(user: JwtUser, sessionId?: string) {
    const student = await this.prisma.student.findFirst({
      where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
      include: {
        masterProfile: true,
        user: { select: { displayName: true } },
        programVersion: { include: { program: true } },
        primaryShift: true,
      },
    });
    if (!student)
      return { student: null, papers: [], seats: [], session: null };

    const feeCheck = await this.feeEnforcement.checkFeesClear(
      user.tid,
      student.id,
      'HALL_TICKET',
    );
    if (feeCheck.blocked) {
      return {
        student: null,
        papers: [],
        seats: [],
        session: null,
        feeBlocked: true,
        outstandingAmount: feeCheck.outstandingAmount,
        feeBlockReasons: feeCheck.reasons,
      };
    }

    const seats = await (this.prisma as any).examSeatAllocation.findMany({
      where: {
        tenantId: user.tid,
        studentId: student.id,
        deletedAt: null,
        ...(sessionId ? { sessionId } : {}),
      },
      orderBy: [{ createdAt: 'asc' }],
      take: 100,
    });
    const paperIds = Array.from(
      new Set(seats.map((seat: any) => seat.paperId).filter(Boolean)),
    ) as string[];
    const classroomIds = Array.from(
      new Set(seats.map((seat: any) => seat.classroomId).filter(Boolean)),
    ) as string[];
    const sessionIds = Array.from(
      new Set(seats.map((seat: any) => seat.sessionId).filter(Boolean)),
    ) as string[];
    const [papers, rooms, sessions] = await Promise.all([
      paperIds.length
        ? (this.prisma as any).examPaperSchedule.findMany({
            where: {
              tenantId: user.tid,
              id: { in: paperIds },
              deletedAt: null,
            },
            orderBy: [{ examDate: 'asc' }],
          })
        : [],
      classroomIds.length
        ? this.prisma.classroom.findMany({
            where: { tenantId: user.tid, id: { in: classroomIds } },
            include: { campus: true, roomType: true },
          })
        : [],
      sessionIds.length
        ? (this.prisma as any).examSession.findMany({
            where: {
              tenantId: user.tid,
              id: { in: sessionIds },
              deletedAt: null,
            },
          })
        : [],
    ]);
    return {
      student: {
        ...student,
        program: student.programVersion?.program ?? null,
        shift: student.primaryShift ?? null,
      },
      session: sessionId
        ? (sessions.find((row: any) => row.id === sessionId) ?? null)
        : (sessions[0] ?? null),
      sessions,
      papers,
      rooms,
      seats,
      instructions:
        sessions[0]?.instructions ??
        'Carry your college ID card and report at least 30 minutes before the examination.',
    };
  }

  async exportCsv(tenantId: string, type: string, query: ExamQueryDto) {
    const data = await this.printData(tenantId, type, query);
    if (type === 'seating') {
      return this.toCsv(
        ['Seat No', 'Roll No', 'Student', 'Room', 'Status'],
        (data.seats ?? []).map((seat: any) => [
          seat.seatNumber,
          seat.rollNumber,
          seat.metadata?.studentName ?? '',
          data.rooms?.find((room: any) => room.id === seat.classroomId)?.code ??
            seat.classroomId,
          seat.status,
        ]),
      );
    }
    if (type === 'invigilators') {
      return this.toCsv(
        ['Staff', 'Role', 'Room', 'Status'],
        (data.invigilators ?? []).map((row: any) => [
          data.staff?.find((staff: any) => staff.id === row.staffProfileId)
            ?.fullName ?? row.staffProfileId,
          row.role,
          data.rooms?.find((room: any) => room.id === row.classroomId)?.code ??
            row.classroomId,
          row.status,
        ]),
      );
    }
    return this.toCsv(
      [
        'Paper Code',
        'Paper Name',
        'Date',
        'Start',
        'End',
        'Expected',
        'Status',
      ],
      (data.papers ?? []).map((paper: any) => [
        paper.paperCode,
        paper.paperName,
        this.dateOnly(paper.examDate),
        this.timeOnly(paper.startTime),
        this.timeOnly(paper.endTime),
        paper.expectedCount,
        paper.status,
      ]),
    );
  }

  reports(tenantId: string, type: string, query: ExamQueryDto) {
    if (type === 'seating') {
      return (this.prisma as any).examSeatAllocation.findMany({
        where: {
          tenantId,
          deletedAt: null,
          ...(query.sessionId ? { sessionId: query.sessionId } : {}),
        },
        orderBy: [{ seatNumber: 'asc' }],
        take: 1000,
      });
    }
    if (type === 'invigilators') {
      return (this.prisma as any).examInvigilatorAssignment.findMany({
        where: {
          tenantId,
          deletedAt: null,
          ...(query.sessionId ? { sessionId: query.sessionId } : {}),
        },
        take: 1000,
      });
    }
    if (type === 'rooms') {
      return (this.prisma as any).examRoomAllocation.findMany({
        where: {
          tenantId,
          deletedAt: null,
          ...(query.sessionId ? { sessionId: query.sessionId } : {}),
        },
        take: 1000,
      });
    }
    return this.listPapers(tenantId, query);
  }

  private async sessionOrThrow(tenantId: string, id: string) {
    const row = await (this.prisma as any).examSession.findFirst({
      where: { tenantId, id, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Exam session not found');
    return row;
  }

  private async paperOrThrow(tenantId: string, id: string) {
    const row = await (this.prisma as any).examPaperSchedule.findFirst({
      where: { tenantId, id, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Exam paper not found');
    return row;
  }

  private async roomAvailable(
    tenantId: string,
    classroomId: string,
    paper: any,
  ) {
    const [reservation, allocation] = await Promise.all([
      (this.prisma as any).infrastructureReservation.findFirst({
        where: {
          tenantId,
          classroomId,
          deletedAt: null,
          status: { in: ['PENDING_APPROVAL', 'APPROVED', 'RESERVED'] },
          startAt: { lt: this.combineDateTime(paper.examDate, paper.endTime) },
          endAt: { gt: this.combineDateTime(paper.examDate, paper.startTime) },
        },
      }),
      (this.prisma as any).examRoomAllocation.findFirst({
        where: {
          tenantId,
          classroomId,
          deletedAt: null,
          paperId: { not: paper.id },
        },
      }),
    ]);
    return !reservation && !allocation;
  }

  private async studentsForPaper(tenantId: string, paper: any) {
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
              include: {
                masterProfile: true,
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

  private combineDateTime(date: Date, time: Date) {
    const value = new Date(date);
    value.setHours(time.getUTCHours(), time.getUTCMinutes(), 0, 0);
    return value;
  }

  private timeDate(value: string) {
    const [hours, minutes = '0'] = value.split(':');
    const date = new Date(0);
    date.setUTCHours(Number(hours), Number(minutes), 0, 0);
    return date;
  }

  private toCsv(headers: string[], rows: Array<Array<unknown>>) {
    return [headers, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n');
  }

  private dateOnly(value: Date) {
    return new Date(value).toISOString().slice(0, 10);
  }

  private timeOnly(value: Date) {
    return new Date(value).toISOString().slice(11, 16);
  }

  private resultStatus(total: number, maxMarks: number) {
    if (maxMarks <= 0) return 'PENDING';
    return (total / maxMarks) * 100 >= 40 ? 'PASS' : 'FAIL';
  }

  private gradeFor(total: number, maxMarks: number) {
    if (maxMarks <= 0) return 'NA';
    const percentage = (total / maxMarks) * 100;
    if (percentage >= 90) return 'O';
    if (percentage >= 80) return 'A+';
    if (percentage >= 70) return 'A';
    if (percentage >= 60) return 'B+';
    if (percentage >= 50) return 'B';
    if (percentage >= 40) return 'C';
    return 'F';
  }

  private gradePoint(grade: string) {
    const points: Record<string, number> = {
      O: 10,
      'A+': 9,
      A: 8,
      'B+': 7,
      B: 6,
      C: 5,
      F: 0,
      NA: 0,
    };
    return points[grade] ?? 0;
  }

  private sgpaFromPercentage(percentage: number) {
    return Number(Math.min(10, Math.max(0, percentage / 10)).toFixed(2));
  }

  private assertText(value: string | undefined | null, message: string) {
    if (!String(value ?? '').trim()) throw new BadRequestException(message);
  }

  private async audit(
    user: JwtUser,
    entity: string,
    entityId: string | null,
    action: string,
    before: unknown,
    after: unknown,
  ) {
    await (this.prisma as any).examAuditLog.create({
      data: {
        tenantId: user.tid,
        actorId: user.sub,
        entity,
        entityId,
        action,
        before: before as any,
        after: after as any,
      },
    });
  }
}
