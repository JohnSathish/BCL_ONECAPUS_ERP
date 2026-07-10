import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { EXAM_APPLICATION_STATUSES } from '../constants/exam-fee.constants';
import type {
  AddBackPaperDto,
  ExamApplicationListQueryDto,
  StartExamApplicationDto,
  SubmitExamApplicationDto,
} from '../dto/examination-fees.dto';
import { toNumber } from '../utils/exam-fee.util';
import { ExamFeeCalcService } from './exam-fee-calc.service';
import { ExamFeeSessionService } from './exam-fee-session.service';
import { ExamFeeSettingsService } from './exam-fee-settings.service';

const EDITABLE = new Set([
  EXAM_APPLICATION_STATUSES.DRAFT,
  EXAM_APPLICATION_STATUSES.CORRECTION_REQUESTED,
  EXAM_APPLICATION_STATUSES.AWAITING_PAYMENT,
  EXAM_APPLICATION_STATUSES.SUBMITTED,
]);

@Injectable()
export class ExamApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: ExamFeeSessionService,
    private readonly calc: ExamFeeCalcService,
    private readonly settings: ExamFeeSettingsService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  private include() {
    return {
      currentSubjects: { orderBy: { sortOrder: 'asc' } },
      backPapers: { orderBy: { sortOrder: 'asc' } },
      statusHistory: { orderBy: { createdAt: 'desc' }, take: 20 },
      payments: { orderBy: { createdAt: 'desc' } },
      receipts: { orderBy: { issuedAt: 'desc' } },
      session: true,
    };
  }

  async resolveStudentId(user: JwtUser, studentId?: string) {
    if (studentId) return studentId;
    const student = await this.db().student.findFirst({
      where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
      select: { id: true },
    });
    if (!student) throw new ForbiddenException('Student profile not found');
    return student.id as string;
  }

  private async nextApplicationNo(tenantId: string) {
    const year = new Date().getFullYear();
    const count = await this.db().examApplication.count({
      where: { tenantId },
    });
    return `EXA-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  private async pushHistory(
    tenantId: string,
    applicationId: string,
    fromStatus: string | null,
    toStatus: string,
    action: string,
    actorUserId?: string,
    remarks?: string,
  ) {
    await this.db().examApplicationStatusHistory.create({
      data: {
        tenantId,
        applicationId,
        fromStatus,
        toStatus,
        action,
        actorUserId: actorUserId ?? null,
        remarks: remarks ?? null,
      },
    });
  }

  async persistCalculation(applicationId: string, tenantId: string) {
    const app = await this.db().examApplication.findFirst({
      where: { id: applicationId, tenantId },
      include: {
        session: true,
        backPapers: true,
      },
    });
    if (!app) throw new NotFoundException('Application not found');

    const result = await this.calc.calculate({
      tenantId,
      studentId: app.studentId,
      semesterCycle: app.session.semesterCycle,
      lateFeeDate: app.session.lateFeeDate,
      backPapers: app.backPapers.map((p: any) => ({
        semesterNo: p.semesterNo,
        subjectCode: p.subjectCode,
        subjectName: p.subjectName,
        examPaperType: p.examPaperType,
      })),
    });

    await this.db().examApplicationCurrentSubject.deleteMany({
      where: { applicationId, tenantId },
    });
    if (result.currentSubjects.length) {
      await this.db().examApplicationCurrentSubject.createMany({
        data: result.currentSubjects.map((s, index) => ({
          tenantId,
          applicationId,
          courseId: s.courseId,
          subjectCode: s.subjectCode,
          subjectName: s.subjectName,
          examPaperType: s.examPaperType,
          amount: s.amount,
          sortOrder: index,
        })),
      });
    }

    for (const paper of result.backPapers) {
      await this.db().examApplicationBackPaper.updateMany({
        where: {
          applicationId,
          tenantId,
          semesterNo: paper.semesterNo,
          subjectCode: paper.subjectCode,
        },
        data: { amount: paper.amount, examPaperType: paper.examPaperType },
      });
    }

    return this.db().examApplication.update({
      where: { id: applicationId },
      data: {
        currentSemesterNo: result.context.semesterNo,
        departmentId: result.context.departmentId,
        departmentName: result.context.departmentName,
        currentSemesterFee: result.currentSemesterFee,
        backPaperFee: result.backPaperFee,
        processingFee: result.processingFee,
        lateFee: result.lateFee,
        totalFee: result.totalFee,
        feeBreakdown: {
          lines: result.breakdown,
          masterId: result.masterId,
        },
      },
      include: this.include(),
    });
  }

  async start(user: JwtUser, dto: StartExamApplicationDto, studentId?: string) {
    const sid = await this.resolveStudentId(user, studentId);
    const session = await this.sessions.assertOpenForApplications(
      user.tid,
      dto.sessionId,
    );

    const applicable = Array.isArray(session.applicableSemesters)
      ? session.applicableSemesters.map(Number)
      : [];
    const ctx = await this.calc.loadStudentContext(user.tid, sid);
    if (applicable.length && !applicable.includes(ctx.semesterNo)) {
      throw new BadRequestException(
        `Semester ${ctx.semesterNo} is not applicable for this examination session.`,
      );
    }

    const existing = await this.db().examApplication.findFirst({
      where: {
        tenantId: user.tid,
        sessionId: dto.sessionId,
        studentId: sid,
      },
      include: this.include(),
    });
    if (existing) {
      if (
        [
          EXAM_APPLICATION_STATUSES.PAID,
          EXAM_APPLICATION_STATUSES.MANUAL_PAID,
          EXAM_APPLICATION_STATUSES.APPROVED,
        ].includes(existing.status)
      ) {
        return existing;
      }
      return this.persistCalculation(existing.id, user.tid);
    }

    const created = await this.db().examApplication.create({
      data: {
        tenantId: user.tid,
        sessionId: dto.sessionId,
        studentId: sid,
        applicationNo: await this.nextApplicationNo(user.tid),
        currentSemesterNo: ctx.semesterNo,
        departmentId: ctx.departmentId,
        departmentName: ctx.departmentName,
        status: EXAM_APPLICATION_STATUSES.DRAFT,
      },
    });
    await this.pushHistory(
      user.tid,
      created.id,
      null,
      EXAM_APPLICATION_STATUSES.DRAFT,
      'CREATED',
      user.sub,
    );
    return this.persistCalculation(created.id, user.tid);
  }

  async get(tenantId: string, id: string) {
    const row = await this.db().examApplication.findFirst({
      where: { id, tenantId },
      include: this.include(),
    });
    if (!row) throw new NotFoundException('Examination application not found');
    return row;
  }

  async list(tenantId: string, query: ExamApplicationListQueryDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 25, 100);
    const where: Record<string, unknown> = { tenantId };
    if (query.sessionId) where.sessionId = query.sessionId;
    if (query.status) where.status = query.status;
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.q) {
      where.OR = [
        { applicationNo: { contains: query.q, mode: 'insensitive' } },
        { departmentName: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.db().examApplication.findMany({
        where,
        include: {
          currentSubjects: true,
          backPapers: true,
          receipts: { take: 1, orderBy: { issuedAt: 'desc' } },
          session: { select: { id: true, name: true, semesterCycle: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.db().examApplication.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async listMine(user: JwtUser) {
    const studentId = await this.resolveStudentId(user);
    return this.db().examApplication.findMany({
      where: { tenantId: user.tid, studentId },
      include: this.include(),
      orderBy: { updatedAt: 'desc' },
    });
  }

  async addBackPaper(
    user: JwtUser,
    applicationId: string,
    dto: AddBackPaperDto,
    studentId?: string,
  ) {
    const app = await this.get(user.tid, applicationId);
    if (studentId && app.studentId !== studentId) {
      throw new ForbiddenException();
    }
    if (!EDITABLE.has(app.status)) {
      throw new BadRequestException(
        'Back papers cannot be edited for this application status.',
      );
    }

    this.calc.validateBackPaper(app.session.semesterCycle, dto);
    const masterCalc = await this.calc.calculate({
      tenantId: user.tid,
      studentId: app.studentId,
      semesterCycle: app.session.semesterCycle,
      lateFeeDate: app.session.lateFeeDate,
      backPapers: [
        ...app.backPapers.map((p: any) => ({
          semesterNo: p.semesterNo,
          subjectCode: p.subjectCode,
          subjectName: p.subjectName,
          examPaperType: p.examPaperType,
        })),
        dto,
      ],
    });
    const priced = masterCalc.backPapers.find(
      (p) =>
        p.semesterNo === dto.semesterNo &&
        p.subjectCode.toUpperCase() === dto.subjectCode.toUpperCase(),
    );

    await this.db().examApplicationBackPaper.create({
      data: {
        tenantId: user.tid,
        applicationId,
        semesterNo: dto.semesterNo,
        subjectCode: dto.subjectCode.trim().toUpperCase(),
        subjectName: dto.subjectName.trim(),
        examPaperType: dto.examPaperType,
        amount: priced?.amount ?? 0,
        source: 'MANUAL',
        sortOrder: app.backPapers.length,
      },
    });

    return this.persistCalculation(applicationId, user.tid);
  }

  async removeBackPaper(
    user: JwtUser,
    applicationId: string,
    backPaperId: string,
    studentId?: string,
  ) {
    const app = await this.get(user.tid, applicationId);
    if (studentId && app.studentId !== studentId) {
      throw new ForbiddenException();
    }
    if (!EDITABLE.has(app.status)) {
      throw new BadRequestException(
        'Back papers cannot be edited for this application status.',
      );
    }
    await this.db().examApplicationBackPaper.deleteMany({
      where: { id: backPaperId, applicationId, tenantId: user.tid },
    });
    return this.persistCalculation(applicationId, user.tid);
  }

  async submit(
    user: JwtUser,
    applicationId: string,
    dto: SubmitExamApplicationDto,
    studentId?: string,
  ) {
    const app = await this.get(user.tid, applicationId);
    if (studentId && app.studentId !== studentId) {
      throw new ForbiddenException();
    }
    const settings = await this.settings.get(user.tid);
    if (settings.requireDeclaration && !dto.declarationAccepted) {
      throw new BadRequestException(
        'You must accept the declaration before submitting.',
      );
    }
    if (!EDITABLE.has(app.status)) {
      throw new BadRequestException('Application cannot be submitted.');
    }

    const refreshed = await this.persistCalculation(applicationId, user.tid);
    if (toNumber(refreshed.totalFee) <= 0) {
      throw new BadRequestException('Total fee must be greater than zero.');
    }

    const updated = await this.db().examApplication.update({
      where: { id: applicationId },
      data: {
        status: EXAM_APPLICATION_STATUSES.AWAITING_PAYMENT,
        declarationAccepted: true,
        declarationAcceptedAt: new Date(),
        submittedAt: new Date(),
      },
      include: this.include(),
    });
    await this.pushHistory(
      user.tid,
      applicationId,
      app.status,
      EXAM_APPLICATION_STATUSES.AWAITING_PAYMENT,
      'SUBMITTED',
      user.sub,
    );
    return updated;
  }

  async listBackPapersAdmin(tenantId: string, sessionId?: string) {
    return this.db().examApplicationBackPaper.findMany({
      where: {
        tenantId,
        ...(sessionId ? { application: { sessionId } } : {}),
      },
      include: {
        application: {
          select: {
            id: true,
            applicationNo: true,
            studentId: true,
            status: true,
            departmentName: true,
            sessionId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }
}
