import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { LicenseEnforcementService } from '../../licensing/services/license-enforcement.service';
import { ExamCalendarSyncService } from '../exam-calendar-sync.service';
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

  async listPapers(tenantId: string, query: IaQueryDto) {
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
    return papers.map((paper: { courseId?: string | null }) => {
      const course = paper.courseId ? courseById.get(paper.courseId) : null;
      return {
        ...paper,
        course: course
          ? {
              id: course.id,
              code: course.code,
              title: course.title,
              credits: course.credits != null ? Number(course.credits) : null,
              courseType: course.courseType,
              departmentId: course.department?.id ?? course.departmentId,
              departmentName: course.department?.name ?? null,
            }
          : null,
      };
    });
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
