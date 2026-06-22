import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import JSZip from 'jszip';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { toPublicUploadUrl } from '../../../common/uploads/public-upload-url';
import { PrismaService } from '../../../database/prisma.service';
import { IA_EXAM_TYPES } from './ia.constants';
import { IaAdmitEligibilityService } from './ia-admit-eligibility.service';
import { IaAdmitPdfService } from './ia-admit-pdf.service';
import { IaAuditService } from './ia-audit.service';
import { IaDefaulterService } from './ia-defaulter.service';
import { IaSettingsService } from './ia-settings.service';
import {
  renderIaAdmitCardHtml,
  type IaAdmitCardTemplateInput,
} from './templates/ia-admit-card.template';

type PaperRow = {
  id: string;
  paperCode: string;
  paperName: string;
  examDate: Date;
  startTime: Date;
  endTime: Date;
  semesterNo?: number | null;
  metadata?: unknown;
  courseId?: string | null;
  offeringId?: string | null;
};

@Injectable()
export class IaAdmitCardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: IaSettingsService,
    private readonly defaulters: IaDefaulterService,
    private readonly eligibility: IaAdmitEligibilityService,
    private readonly pdf: IaAdmitPdfService,
    private readonly audit: IaAuditService,
  ) {}

  private db() {
    return this.prisma as any;
  }

  private verifyBaseUrl() {
    return (
      process.env.WEB_PUBLIC_URL ??
      process.env.APP_URL ??
      'http://localhost:3000'
    ).replace(/\/$/, '');
  }

  private async getSession(tenantId: string, sessionId: string) {
    const session = await this.db().examSession.findFirst({
      where: {
        id: sessionId,
        tenantId,
        deletedAt: null,
        examType: { in: [...IA_EXAM_TYPES] },
      },
    });
    if (!session) throw new NotFoundException('IA session not found');
    return session;
  }

  private async institutionContext(tenantId: string) {
    const [tenant, branding, institution] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      }),
      this.prisma.tenantBranding.findUnique({
        where: { tenantId },
        select: {
          displayName: true,
          address: true,
          logoUrl: true,
          portalSubtitle: true,
        },
      }),
      this.prisma.institution.findFirst({
        where: { tenantId, deletedAt: null },
        select: { name: true },
      }),
    ]);
    return {
      name: tenant?.name ?? 'College',
      displayName: branding?.displayName ?? institution?.name ?? tenant?.name,
      address: branding?.address ?? null,
      logoUrl:
        toPublicUploadUrl(branding?.logoUrl) ?? branding?.logoUrl ?? null,
      affiliation:
        branding?.portalSubtitle ??
        'Affiliated to North-Eastern Hill University (NEHU)',
      contact: null as string | null,
    };
  }

  private async academicYearLabel(
    tenantId: string,
    academicYearId?: string | null,
  ) {
    if (!academicYearId) return null;
    const year = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, tenantId },
      select: { name: true },
    });
    return year?.name ?? null;
  }

  private async nextAdmitCardNumber(
    tenantId: string,
    semesterNo?: number | null,
  ) {
    const year = new Date().getFullYear() % 100;
    const sem = String(semesterNo ?? 0).padStart(2, '0');
    const prefix = `AC${year}${sem}`;
    const last = await this.db().iaAdmitCardIssue.findFirst({
      where: { tenantId, admitCardNumber: { startsWith: prefix } },
      orderBy: { admitCardNumber: 'desc' },
    });
    const seq = last
      ? parseInt(String(last.admitCardNumber).slice(-4), 10) + 1
      : 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  private paperTypeFromMetadata(metadata: unknown) {
    if (metadata && typeof metadata === 'object') {
      const m = metadata as Record<string, unknown>;
      if (typeof m.paperType === 'string') return m.paperType;
      if (typeof m.category === 'string') return m.category;
    }
    return 'Major';
  }

  private maxMarksFromMetadata(metadata: unknown) {
    if (metadata && typeof metadata === 'object') {
      const m = metadata as Record<string, unknown>;
      if (m.maxMarks != null) return Number(m.maxMarks);
    }
    return 20;
  }

  private async studentsForPaper(tenantId: string, paper: PaperRow) {
    const studentSelect = {
      id: true,
      rollNumber: true,
      enrollmentNumber: true,
      admissionNumber: true,
      departmentId: true,
      programVersionId: true,
      user: { select: { displayName: true } },
      masterProfile: { select: { fullName: true } },
      programVersion: {
        include: { program: { select: { name: true, code: true } } },
      },
      department: { select: { name: true, code: true } },
    } as const;

    if (paper.offeringId) {
      const lines = await this.prisma.semesterRegistrationLine.findMany({
        where: {
          tenantId,
          offeringId: paper.offeringId,
          status: { in: ['approved', 'confirmed', 'registered', 'pending'] },
          ...(paper.semesterNo != null
            ? { registration: { semesterSequence: paper.semesterNo } }
            : {}),
        },
        include: {
          registration: {
            include: {
              student: { select: studentSelect },
            },
          },
        },
      });
      return Array.from(
        new Map(
          lines.map((line) => [
            line.registration.student.id,
            line.registration.student,
          ]),
        ).values(),
      );
    }

    if (!paper.courseId) return [];

    const lines = await this.prisma.semesterRegistrationLine.findMany({
      where: {
        tenantId,
        offering: { courseId: paper.courseId },
        status: { in: ['approved', 'confirmed', 'registered', 'pending'] },
        ...(paper.semesterNo != null
          ? { registration: { semesterSequence: paper.semesterNo } }
          : {}),
      },
      include: {
        registration: {
          include: {
            student: { select: studentSelect },
          },
        },
      },
      take: 2000,
    });
    return Array.from(
      new Map(
        lines.map((line) => [
          line.registration.student.id,
          line.registration.student,
        ]),
      ).values(),
    );
  }

  async listSessions(tenantId: string) {
    const sessions = await this.db().examSession.findMany({
      where: {
        tenantId,
        deletedAt: null,
        examType: { in: [...IA_EXAM_TYPES] },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
      select: {
        id: true,
        name: true,
        examType: true,
        semesterNo: true,
        startDate: true,
        endDate: true,
        status: true,
        instructions: true,
        academicYearId: true,
      },
    });
    return sessions.map((s: { name: string }) => ({
      ...s,
      isDemo: /demo/i.test(s.name),
    }));
  }

  async dashboard(
    tenantId: string,
    sessionId: string,
    filters?: {
      programmeCode?: string;
      departmentId?: string;
      semesterNo?: number;
    },
  ) {
    const roster = await this.listStudents(tenantId, sessionId, filters);
    const issues = await this.db().iaAdmitCardIssue.findMany({
      where: { tenantId, sessionId, deletedAt: null },
      select: {
        id: true,
        studentId: true,
        downloadCount: true,
        printCount: true,
        generatedAt: true,
      },
    });
    const issueByStudent = new Map(
      issues.map((i: { studentId: string }) => [i.studentId, i]),
    );

    const students = roster.students;
    const eligible = students.filter((s) => s.eligible);
    const ineligible = students.filter((s) => !s.eligible);
    const generated = students.filter((s) => issueByStudent.has(s.id));
    const downloaded = issues.filter(
      (i: { downloadCount: number }) => i.downloadCount > 0,
    );
    const pendingVerification = students.filter(
      (s) => s.eligible && !issueByStudent.has(s.id),
    );

    const lastGenerated = issues.length
      ? issues.reduce(
          (max: Date, i: { generatedAt: Date }) =>
            i.generatedAt > max ? i.generatedAt : max,
          issues[0].generatedAt,
        )
      : null;

    return {
      session: roster.session,
      isDemo: /demo/i.test(roster.session.name ?? ''),
      filters: filters ?? {},
      kpis: {
        totalRegistered: students.length,
        eligible: eligible.length,
        ineligible: ineligible.length,
        admitCardsGenerated: generated.length,
        admitCardsDownloaded: downloaded.length,
        pendingEligibilityVerification: pendingVerification.length,
        iaSessions: 1,
        lastGeneratedDate: lastGenerated,
      },
      attendanceDefaulters: students.filter((s) =>
        s.ineligibilityReasons.some((r) => /attendance/i.test(r)),
      ).length,
      feeDefaulters: students.filter((s) =>
        s.ineligibilityReasons.some((r) => /fee|dues/i.test(r)),
      ).length,
    };
  }

  async listStudents(
    tenantId: string,
    sessionId: string,
    filters?: {
      programmeCode?: string;
      departmentId?: string;
      semesterNo?: number;
    },
  ) {
    const session = await this.getSession(tenantId, sessionId);
    const papers: PaperRow[] = await this.db().examPaperSchedule.findMany({
      where: { tenantId, sessionId, deletedAt: null },
      orderBy: [{ examDate: 'asc' }],
    });

    const defaulterList = await this.defaulters.list(tenantId);
    const defaulterIds = new Set(
      defaulterList.items.map((d: { studentId: string }) => d.studentId),
    );

    const byStudent = new Map<
      string,
      {
        id: string;
        rollNumber?: string | null;
        enrollmentNumber?: string;
        admissionNumber?: string | null;
        fullName?: string | null;
        programme?: string | null;
        programmeCode?: string | null;
        department?: string | null;
        departmentId?: string | null;
        paperCount: number;
        isDefaulter: boolean;
      }
    >();

    for (const paper of papers) {
      const students = await this.studentsForPaper(tenantId, paper);
      for (const s of students) {
        const existing = byStudent.get(s.id);
        if (existing) {
          existing.paperCount += 1;
        } else {
          byStudent.set(s.id, {
            id: s.id,
            rollNumber: s.rollNumber ?? s.enrollmentNumber ?? s.admissionNumber,
            enrollmentNumber: s.enrollmentNumber,
            admissionNumber: s.admissionNumber,
            fullName: s.masterProfile?.fullName ?? s.user?.displayName,
            programme: s.programVersion?.program?.name,
            programmeCode: s.programVersion?.program?.code,
            department: s.department?.name,
            departmentId: s.departmentId,
            paperCount: 1,
            isDefaulter: defaulterIds.has(s.id),
          });
        }
      }
    }

    let studentRows = Array.from(byStudent.values());
    if (filters?.programmeCode) {
      studentRows = studentRows.filter(
        (s) =>
          s.programmeCode?.toUpperCase() ===
          filters.programmeCode?.toUpperCase(),
      );
    }
    if (filters?.departmentId) {
      studentRows = studentRows.filter(
        (s) => s.departmentId === filters.departmentId,
      );
    }

    const eligibilityMap = await this.eligibility.evaluateBatch(
      tenantId,
      studentRows.map((s) => s.id),
      { semesterNo: session.semesterNo, defaulterIds },
    );

    const issues = await this.db().iaAdmitCardIssue.findMany({
      where: {
        tenantId,
        sessionId,
        studentId: { in: studentRows.map((s) => s.id) },
        deletedAt: null,
      },
      select: {
        studentId: true,
        admitCardNumber: true,
        generatedAt: true,
        downloadCount: true,
        printCount: true,
      },
    });
    const issueMap = new Map<
      string,
      {
        admitCardNumber: string;
        generatedAt: Date;
        downloadCount: number;
        printCount: number;
      }
    >(
      issues.map(
        (i: {
          studentId: string;
          admitCardNumber: string;
          generatedAt: Date;
          downloadCount: number;
          printCount: number;
        }) => [i.studentId, i],
      ),
    );

    const students = studentRows
      .map((s) => {
        const elig = eligibilityMap.get(s.id);
        const issue = issueMap.get(s.id);
        const eligible = elig?.eligible ?? false;
        return {
          ...s,
          eligible,
          blocked: !eligible,
          status: eligible ? 'ELIGIBLE' : 'INELIGIBLE',
          ineligibilityReasons: elig?.reasons ?? [],
          missingFields: elig?.missingFields ?? [],
          attendancePercent: elig?.attendancePercent ?? null,
          feeDue: elig?.feeDue ?? null,
          admitCardNumber: issue?.admitCardNumber ?? null,
          generatedAt: issue?.generatedAt ?? null,
          downloaded: (issue?.downloadCount ?? 0) > 0,
        };
      })
      .sort((a, b) =>
        String(a.rollNumber ?? '').localeCompare(
          String(b.rollNumber ?? ''),
          undefined,
          {
            numeric: true,
          },
        ),
      );

    return {
      session: {
        id: session.id,
        name: session.name,
        examType: session.examType,
        semesterNo: session.semesterNo,
        instructions: session.instructions,
        isDemo: /demo/i.test(session.name),
      },
      papers: papers.map((p) => ({
        id: p.id,
        paperCode: p.paperCode,
        paperName: p.paperName,
        examDate: p.examDate,
        startTime: p.startTime,
        endTime: p.endTime,
        paperType: this.paperTypeFromMetadata(p.metadata),
        maxMarks: this.maxMarksFromMetadata(p.metadata),
      })),
      students,
    };
  }

  private async loadStudentCardContext(
    tenantId: string,
    sessionId: string,
    studentId: string,
  ) {
    const session = await this.getSession(tenantId, sessionId);
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
      include: {
        user: { select: { displayName: true } },
        masterProfile: true,
        programVersion: {
          include: { program: { select: { name: true, code: true } } },
        },
        department: { select: { name: true, code: true } },
        abcAccount: { select: { abcId: true } },
        guardians: { select: { guardianType: true, fullName: true } },
        academicStanding: true,
        semesterProgress: {
          select: { semesterSequence: true },
          take: 1,
          orderBy: { semesterSequence: 'desc' },
        },
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    const defaulterList = await this.defaulters.list(tenantId);
    const isDefaulter = defaulterList.items.some(
      (d: { studentId: string }) => d.studentId === studentId,
    );
    const elig = await this.eligibility.evaluateStudent(tenantId, student, {
      semesterNo: session.semesterNo,
      isDefaulter,
    });

    const papers: PaperRow[] = await this.db().examPaperSchedule.findMany({
      where: { tenantId, sessionId, deletedAt: null },
      orderBy: [{ examDate: 'asc' }, { startTime: 'asc' }],
    });

    const studentPaperIds = new Set<string>();
    for (const paper of papers) {
      const roster = await this.studentsForPaper(tenantId, paper);
      if (roster.some((s) => s.id === studentId)) {
        studentPaperIds.add(paper.id);
      }
    }
    const studentPapers = papers.filter((p) => studentPaperIds.has(p.id));

    const father = student.guardians.find((g) =>
      /father/i.test(g.guardianType),
    );
    const mother = student.guardians.find((g) =>
      /mother/i.test(g.guardianType),
    );

    return {
      session,
      student,
      elig,
      isDefaulter,
      studentPapers,
      fatherName: father?.fullName ?? student.masterProfile?.guardianName,
      motherName: mother?.fullName ?? null,
    };
  }

  private buildTemplateInput(
    ctx: Awaited<ReturnType<IaAdmitCardService['loadStudentCardContext']>>,
    institution: Awaited<ReturnType<IaAdmitCardService['institutionContext']>>,
    academicYear: string | null,
    admitCardNumber: string,
    verifyToken: string,
    verifyCode: string,
  ): IaAdmitCardTemplateInput {
    const { session, student, studentPapers } = ctx;
    const verifyUrl = `${this.verifyBaseUrl()}/verify/ia-admit/${verifyToken}`;
    return {
      institution,
      session: {
        name: session.name,
        examType: session.examType,
        semesterNo: session.semesterNo,
        academicYear,
        instructions: session.instructions,
      },
      student: {
        fullName: student.masterProfile?.fullName ?? student.user?.displayName,
        rollNumber: student.rollNumber,
        enrollmentNumber: student.enrollmentNumber,
        admissionNumber: student.admissionNumber,
        abcId: student.abcAccount?.abcId ?? null,
        programme: student.programVersion?.program?.name,
        department: student.department?.name,
        semesterNo:
          session.semesterNo ??
          student.semesterProgress?.[0]?.semesterSequence ??
          null,
        gender: student.masterProfile?.gender,
        dateOfBirth: student.masterProfile?.dateOfBirth?.toISOString() ?? null,
        fatherName: ctx.fatherName,
        motherName: ctx.motherName,
        photoUrl: toPublicUploadUrl(student.masterProfile?.photoPath),
      },
      papers: studentPapers.map((p) => ({
        paperCode: p.paperCode,
        paperName: p.paperName,
        paperType: this.paperTypeFromMetadata(p.metadata),
        maxMarks: this.maxMarksFromMetadata(p.metadata),
        examDate: p.examDate.toISOString(),
        startTime: String(p.startTime),
        endTime: String(p.endTime),
      })),
      admitCardNumber,
      verifyCode,
      verifyUrl,
      generatedAt: new Date().toISOString(),
      watermark: institution.displayName ?? institution.name,
    };
  }

  async generateCard(
    tenantId: string,
    sessionId: string,
    studentId: string,
    user?: JwtUser,
    options?: { persist?: boolean; force?: boolean },
  ) {
    const ctx = await this.loadStudentCardContext(
      tenantId,
      sessionId,
      studentId,
    );
    const cfg = await this.settings.getOrCreate(tenantId);

    if (!ctx.elig.eligible && !options?.force) {
      return {
        blocked: true,
        reason: ctx.elig.reasons.join('; ') || 'Student not eligible',
        studentId,
        eligibility: ctx.elig,
      };
    }
    if (cfg.blockAdmitOnDefaulter && ctx.isDefaulter && !options?.force) {
      return {
        blocked: true,
        reason: 'Defaulter — admit card blocked by examination settings',
        studentId,
        eligibility: ctx.elig,
      };
    }

    const [institution, academicYear] = await Promise.all([
      this.institutionContext(tenantId),
      this.academicYearLabel(tenantId, ctx.session.academicYearId),
    ]);

    let issue = await this.db().iaAdmitCardIssue.findFirst({
      where: { tenantId, sessionId, studentId, deletedAt: null },
    });

    const verifyToken = issue?.verifyToken ?? randomUUID();
    const verifyHash =
      issue?.verifyHash ??
      createHash('sha256')
        .update(`${studentId}:${sessionId}:${verifyToken}`)
        .digest('hex');
    const verifyCode = verifyHash.slice(0, 16).toUpperCase();
    const admitCardNumber =
      issue?.admitCardNumber ??
      (await this.nextAdmitCardNumber(tenantId, ctx.session.semesterNo));

    const template = this.buildTemplateInput(
      ctx,
      institution,
      academicYear,
      admitCardNumber,
      verifyToken,
      verifyCode,
    );

    const cardPayload = {
      blocked: false,
      admitCardNumber,
      verifyToken,
      verifyCode,
      verifyUrl: template.verifyUrl,
      qrPayload: `IA-ADMIT:${verifyToken}`,
      session: template.session,
      institutionName: institution.displayName ?? institution.name,
      institution,
      student: template.student,
      papers: template.papers,
      eligibility: ctx.elig,
      generatedAt: new Date().toISOString(),
    };

    if (options?.persist !== false) {
      if (issue) {
        issue = await this.db().iaAdmitCardIssue.update({
          where: { id: issue.id },
          data: {
            cardSnapshot: cardPayload,
            eligibilitySnapshot: ctx.elig,
            regeneratedCount: { increment: 1 },
            generatedById: user?.sub,
            generatedAt: new Date(),
            verifyHash,
          },
        });
        await this.recordEvent(tenantId, issue.id, 'REGENERATED', user?.sub);
      } else {
        issue = await this.db().iaAdmitCardIssue.create({
          data: {
            tenantId,
            sessionId,
            studentId,
            admitCardNumber,
            verifyToken,
            verifyHash,
            cardSnapshot: cardPayload,
            eligibilitySnapshot: ctx.elig,
            generatedById: user?.sub,
          },
        });
        await this.recordEvent(tenantId, issue.id, 'GENERATED', user?.sub);
      }

      if (user) {
        await this.audit.log(
          user,
          'ia_admit_card',
          issue.id,
          issue.regeneratedCount > 0 ? 'REGENERATED' : 'GENERATED',
          undefined,
          { admitCardNumber, studentId },
        );
      }
    }

    return { ...cardPayload, issueId: issue?.id };
  }

  async bulkGenerate(user: JwtUser, sessionId: string, studentIds: string[]) {
    const cards = [];
    for (const studentId of studentIds) {
      const card = await this.generateCard(
        user.tid,
        sessionId,
        studentId,
        user,
      );
      cards.push(card);
    }
    return { sessionId, count: cards.length, cards };
  }

  async recordDownload(user: JwtUser, issueId: string) {
    const issue = await this.db().iaAdmitCardIssue.findFirst({
      where: { id: issueId, tenantId: user.tid, deletedAt: null },
    });
    if (!issue) throw new NotFoundException('Admit card issue not found');
    await this.db().iaAdmitCardIssue.update({
      where: { id: issueId },
      data: {
        downloadCount: { increment: 1 },
        lastDownloadAt: new Date(),
      },
    });
    await this.recordEvent(user.tid, issueId, 'DOWNLOADED', user.sub);
    await this.audit.log(user, 'ia_admit_card', issueId, 'DOWNLOADED');
    return { ok: true };
  }

  async recordPrint(user: JwtUser, issueId: string) {
    const issue = await this.db().iaAdmitCardIssue.findFirst({
      where: { id: issueId, tenantId: user.tid, deletedAt: null },
    });
    if (!issue) throw new NotFoundException('Admit card issue not found');
    await this.db().iaAdmitCardIssue.update({
      where: { id: issueId },
      data: {
        printCount: { increment: 1 },
        lastPrintAt: new Date(),
      },
    });
    await this.recordEvent(user.tid, issueId, 'PRINTED', user.sub);
    await this.audit.log(user, 'ia_admit_card', issueId, 'PRINTED');
    return { ok: true };
  }

  private async recordEvent(
    tenantId: string,
    issueId: string,
    action: string,
    actorId?: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.db().iaAdmitCardEvent.create({
      data: { tenantId, issueId, action, actorId, metadata: metadata ?? {} },
    });
  }

  async verifyToken(token: string) {
    const issue = await this.db().iaAdmitCardIssue.findFirst({
      where: { verifyToken: token, deletedAt: null },
    });
    if (!issue) {
      return {
        valid: false,
        status: 'NOT_FOUND',
        message: 'Admit card not found',
      };
    }
    const snapshot = issue.cardSnapshot as Record<string, unknown>;
    await this.recordEvent(issue.tenantId, issue.id, 'VERIFIED', undefined, {
      source: 'public',
    });
    return {
      valid: true,
      status: 'VERIFIED',
      admitCardNumber: issue.admitCardNumber,
      generatedAt: issue.generatedAt,
      student: snapshot.student,
      session: snapshot.session,
      institutionName: snapshot.institutionName,
      verificationStatus: 'AUTHENTIC',
    };
  }

  async auditTrail(tenantId: string, sessionId: string) {
    const issues = await this.db().iaAdmitCardIssue.findMany({
      where: { tenantId, sessionId, deletedAt: null },
      include: {
        events: { orderBy: { createdAt: 'desc' }, take: 5 },
        student: {
          select: {
            rollNumber: true,
            masterProfile: { select: { fullName: true } },
          },
        },
      },
      orderBy: { generatedAt: 'desc' },
      take: 200,
    });
    return issues.map((i: any) => ({
      issueId: i.id,
      admitCardNumber: i.admitCardNumber,
      studentId: i.studentId,
      rollNumber: i.student?.rollNumber,
      fullName: i.student?.masterProfile?.fullName,
      generatedAt: i.generatedAt,
      downloadCount: i.downloadCount,
      printCount: i.printCount,
      regeneratedCount: i.regeneratedCount,
      recentEvents: i.events,
    }));
  }

  async exportPdf(
    tenantId: string,
    sessionId: string,
    studentIds: string[],
    user?: JwtUser,
  ) {
    if (!studentIds.length) {
      throw new BadRequestException('No students selected');
    }
    const templates: IaAdmitCardTemplateInput[] = [];
    for (const studentId of studentIds) {
      const card = await this.generateCard(
        tenantId,
        sessionId,
        studentId,
        user,
      );
      if (card.blocked || !('admitCardNumber' in card)) continue;
      const [institution, academicYear] = await Promise.all([
        this.institutionContext(tenantId),
        this.academicYearLabel(
          tenantId,
          (await this.getSession(tenantId, sessionId)).academicYearId,
        ),
      ]);
      templates.push(
        this.buildTemplateInput(
          await this.loadStudentCardContext(tenantId, sessionId, studentId),
          institution,
          academicYear,
          card.admitCardNumber,
          card.verifyToken,
          card.verifyCode,
        ),
      );
      if ('issueId' in card && card.issueId && user) {
        await this.recordDownload(user, card.issueId);
      }
    }
    if (!templates.length) {
      throw new BadRequestException('No eligible admit cards to export');
    }
    const buffer =
      templates.length === 1
        ? await this.pdf.renderCardPdf(templates[0])
        : await this.pdf.renderBatchPdf(templates);
    const filename =
      templates.length === 1
        ? `ia-admit-${templates[0].student.rollNumber ?? 'student'}.pdf`
        : `ia-admit-batch-${sessionId.slice(0, 8)}.pdf`;
    return { buffer, filename, count: templates.length };
  }

  async exportZip(
    tenantId: string,
    sessionId: string,
    studentIds: string[],
    user?: JwtUser,
  ) {
    const session = await this.getSession(tenantId, sessionId);
    const folder = `Semester-${session.semesterNo ?? 'All'}`;
    const zip = new JSZip();
    const folderNode = zip.folder(folder);
    if (!folderNode) throw new BadRequestException('ZIP creation failed');

    for (const studentId of studentIds) {
      const card = await this.generateCard(
        tenantId,
        sessionId,
        studentId,
        user,
      );
      if (card.blocked || !('admitCardNumber' in card)) continue;
      const [institution, academicYear] = await Promise.all([
        this.institutionContext(tenantId),
        this.academicYearLabel(tenantId, session.academicYearId),
      ]);
      const template = this.buildTemplateInput(
        await this.loadStudentCardContext(tenantId, sessionId, studentId),
        institution,
        academicYear,
        card.admitCardNumber as string,
        card.verifyToken as string,
        card.verifyCode as string,
      );
      const pdf = await this.pdf.renderCardPdf(template);
      const name = `${template.student.rollNumber ?? studentId.slice(0, 8)}.pdf`;
      folderNode.file(name, pdf);
      if ('issueId' in card && card.issueId && user) {
        await this.recordDownload(user, card.issueId);
      }
    }

    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    return {
      buffer,
      filename: `ia-admit-cards-${folder}.zip`,
    };
  }

  async ineligibleReport(tenantId: string, sessionId: string) {
    const roster = await this.listStudents(tenantId, sessionId);
    return {
      session: roster.session,
      items: roster.students
        .filter((s) => !s.eligible)
        .map((s) => ({
          studentId: s.id,
          rollNumber: s.rollNumber,
          fullName: s.fullName,
          programme: s.programme,
          department: s.department,
          reasons: s.ineligibilityReasons,
          missingFields: s.missingFields,
          attendancePercent: s.attendancePercent,
          feeDue: s.feeDue,
        })),
    };
  }

  renderPreviewHtml(tenantId: string, sessionId: string, studentId: string) {
    return this.generateCard(tenantId, sessionId, studentId, undefined, {
      persist: false,
    }).then(async (card) => {
      if (card.blocked || !('admitCardNumber' in card)) {
        return renderIaAdmitCardHtml({
          institution: { name: 'Preview Blocked' },
          session: { name: '—' },
          student: { fullName: 'Ineligible' },
          papers: [],
          admitCardNumber: '—',
          verifyCode: '—',
        });
      }
      const ctx = await this.loadStudentCardContext(
        tenantId,
        sessionId,
        studentId,
      );
      const [institution, academicYear] = await Promise.all([
        this.institutionContext(tenantId),
        this.academicYearLabel(tenantId, ctx.session.academicYearId),
      ]);
      return renderIaAdmitCardHtml(
        this.buildTemplateInput(
          ctx,
          institution,
          academicYear,
          card.admitCardNumber,
          card.verifyToken,
          card.verifyCode,
        ),
      );
    });
  }
}
