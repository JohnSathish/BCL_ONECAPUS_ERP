import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import JSZip from 'jszip';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { toPublicUploadUrl } from '../../../common/uploads/public-upload-url';
import { sanitizeDisplayText } from '../../../common/utils/display-text.util';
import { PrismaService } from '../../../database/prisma.service';
import { IA_EXAM_TYPES } from './ia.constants';
import { IaAdmitEligibilityService } from './ia-admit-eligibility.service';
import { IaAdmitPdfService } from './ia-admit-pdf.service';
import { IaAuditService } from './ia-audit.service';
import { IaDefaulterService } from './ia-defaulter.service';
import { IaExamProvisioningService } from './ia-exam-provisioning.service';
import { formatExamWallClock } from './ia-noticeboard-grid';
import { registeredSubjectPrint } from '../../academic-engine/domain/offering-paper-title';
import {
  iaPaperCategory,
  normalizeIaSubjectCategory,
  pickIaPaperForRegistration,
} from './ia-category-policy';
import { refreshExamPaperNames } from './ia-paper-names';
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
    private readonly provisioning: IaExamProvisioningService,
  ) {}

  private db() {
    return this.prisma as any;
  }

  private isLoopbackOrigin(value: string) {
    const host = value
      .trim()
      .replace(/^https?:\/\//i, '')
      .split('/')[0]
      .split(':')[0]
      .toLowerCase();
    return (
      !host ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.endsWith('.localhost')
    );
  }

  /** Printed QR must open the public ERP, not the machine that generated the card. */
  private configuredPublicOrigin() {
    const candidates = [
      process.env.WEB_PUBLIC_URL,
      process.env.APP_PUBLIC_URL,
      process.env.WEB_ORIGIN,
      process.env.WEB_APP_URL,
      process.env.APP_URL,
    ];
    for (const raw of candidates) {
      const value = raw?.trim().replace(/\/$/, '') ?? '';
      if (!value || this.isLoopbackOrigin(value)) continue;
      return /^https?:\/\//i.test(value) ? value : `https://${value}`;
    }
    return null;
  }

  private async verifyBaseUrl(tenantId: string) {
    const configured = this.configuredPublicOrigin();
    if (configured) return configured;

    const domains = await this.prisma.tenantDomain.findMany({
      where: { tenantId, deletedAt: null },
      select: { host: true, verified: true },
      orderBy: { verified: 'desc' },
    });
    const hosts = domains
      .map((row) => row.host.trim().toLowerCase())
      .filter((host) => host && !this.isLoopbackOrigin(host));
    const erp = hosts.find((host) => host.startsWith('erp.'));
    if (erp) return `https://${erp}`;
    if (hosts[0]) return `https://${hosts[0]}`;
    return 'https://erp.donboscocollege.ac.in';
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
        sanitizeDisplayText(branding?.portalSubtitle) ??
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

  private sessionSemesterNos(
    session: { semesterNo?: number | null; metadata?: unknown },
    papers: PaperRow[],
  ) {
    const semesterNos = new Set<number>();
    const meta = (session.metadata ?? {}) as { semesterNos?: unknown };
    if (Array.isArray(meta.semesterNos)) {
      for (const value of meta.semesterNos) {
        const semesterNo = Number(value);
        if (Number.isFinite(semesterNo) && semesterNo > 0) {
          semesterNos.add(semesterNo);
        }
      }
    }
    for (const paper of papers) {
      if (paper.semesterNo != null) semesterNos.add(paper.semesterNo);
    }
    if (!semesterNos.size && session.semesterNo != null) {
      semesterNos.add(session.semesterNo);
    }
    return [...semesterNos];
  }

  /**
   * A day/morning exam often covers several semesters, but the session row
   * keeps only the first one. Match each registered subject to the paper for
   * that subject and semester, not to session.semesterNo.
   */
  private registrationLineInclude() {
    return {
      offering: {
        select: {
          courseId: true,
          category: true,
          titleOverride: true,
          course: { select: { code: true, title: true } },
        },
      },
      registration: {
        select: { studentId: true, shiftId: true, semesterSequence: true },
      },
    } as const;
  }

  private async papersForStudentFromRegistrations(
    tenantId: string,
    studentId: string,
    session: {
      semesterNo?: number | null;
      shiftId?: string | null;
      metadata?: unknown;
    },
    sessionPapers: PaperRow[],
    studentShiftId?: string | null,
  ) {
    const semesterNos = this.sessionSemesterNos(session, sessionPapers);
    const lines = await this.prisma.semesterRegistrationLine.findMany({
      where: {
        tenantId,
        status: { in: ['approved', 'confirmed', 'registered', 'pending'] },
        registration: {
          studentId,
          ...(semesterNos.length
            ? { semesterSequence: { in: semesterNos } }
            : {}),
        },
      },
      include: this.registrationLineInclude(),
    });
    return this.matchRegisteredPapers(
      lines,
      session.shiftId ?? null,
      sessionPapers,
      studentShiftId,
    );
  }

  private matchRegisteredPapers(
    lines: Array<{
      offeringId: string;
      category?: string | null;
      offering: {
        courseId: string;
        category?: string | null;
        titleOverride?: string | null;
        course: { code?: string | null; title?: string | null };
      };
      registration: {
        shiftId?: string | null;
        semesterSequence?: number | null;
      };
    }>,
    sessionShiftId: string | null,
    sessionPapers: PaperRow[],
    studentShiftId?: string | null,
  ) {
    const eligible = sessionShiftId
      ? lines.filter((line) => {
          const shift = line.registration.shiftId || studentShiftId;
          return !shift || shift === sessionShiftId;
        })
      : lines;

    const matched: PaperRow[] = [];
    const seen = new Set<string>();
    // Semester 1 minors are often stored twice: the offering paper and a
    // course-level copy with the same code, title, and sitting.
    const seenPrint = new Set<string>();
    for (const line of eligible) {
      const semesterPapers = sessionPapers.filter(
        (paper) =>
          paper.semesterNo == null ||
          paper.semesterNo === line.registration.semesterSequence,
      );
      const paper = pickIaPaperForRegistration(semesterPapers, {
        offeringId: line.offeringId,
        category: line.category,
        courseId: line.offering.courseId,
      });
      if (!paper || seen.has(paper.id)) continue;
      const lineCategory = normalizeIaSubjectCategory(line.category) ?? '';
      const category =
        lineCategory ||
        normalizeIaSubjectCategory(line.offering.category) ||
        iaPaperCategory(paper.metadata);
      const printed = registeredSubjectPrint(
        line.offering.course,
        line.offering,
      );
      const paperName = printed.title || paper.paperName;
      const paperCode = printed.code || paper.paperCode;
      const printKey = `${paperCode.trim().toUpperCase()}|${category}`;
      if (seenPrint.has(printKey)) continue;
      seen.add(paper.id);
      seenPrint.add(printKey);
      const metadata =
        paper.metadata && typeof paper.metadata === 'object'
          ? { ...(paper.metadata as Record<string, unknown>), category }
          : { category };
      matched.push({ ...paper, paperCode, paperName, metadata });
    }

    return matched.sort((a, b) => {
      const dateCmp = a.examDate.getTime() - b.examDate.getTime();
      if (dateCmp !== 0) return dateCmp;
      return a.startTime.getTime() - b.startTime.getTime();
    });
  }

  private async studentsForPaper(tenantId: string, paper: PaperRow) {
    const studentSelect = {
      id: true,
      primaryShiftId: true,
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
    const sessionId = (paper as PaperRow & { sessionId?: string }).sessionId;

    if (paper.offeringId) {
      const paperCat = iaPaperCategory(paper.metadata);
      let splitByCategory = false;
      if (paperCat && sessionId) {
        const siblings = await this.db().examPaperSchedule.findMany({
          where: {
            tenantId,
            sessionId,
            offeringId: paper.offeringId,
            deletedAt: null,
          },
          select: { metadata: true },
        });
        const categories = new Set(
          siblings
            .map((row: { metadata?: unknown }) => iaPaperCategory(row.metadata))
            .filter(Boolean),
        );
        splitByCategory = categories.size > 1;
      }
      const lines = await this.prisma.semesterRegistrationLine.findMany({
        where: {
          tenantId,
          offeringId: paper.offeringId,
          ...(splitByCategory ? { category: paperCat } : {}),
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
      return this.studentsOnSessionShift(sessionId, tenantId, lines);
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
    return this.studentsOnSessionShift(sessionId, tenantId, lines);
  }

  private async studentsOnSessionShift<
    T extends { id: string; primaryShiftId: string | null },
  >(
    sessionId: string | undefined,
    tenantId: string,
    lines: Array<{
      registration: {
        shiftId: string | null;
        student: T;
      };
    }>,
  ) {
    const sessionShiftId = sessionId
      ? ((
          await this.db().examSession.findFirst({
            where: { id: sessionId, tenantId },
            select: { shiftId: true },
          })
        )?.shiftId ?? null)
      : null;
    const eligible = sessionShiftId
      ? lines.filter((line) => {
          const studentShift =
            line.registration.shiftId ||
            line.registration.student.primaryShiftId;
          return !studentShift || studentShift === sessionShiftId;
        })
      : lines;
    return Array.from(
      new Map(
        eligible.map((line) => [
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
        shiftId: true,
      },
    });
    const typedSessions = sessions as Array<{
      id: string;
      name: string;
      examType: string;
      semesterNo: number | null;
      startDate: Date | null;
      endDate: Date | null;
      status: string;
      instructions: string | null;
      academicYearId: string | null;
      shiftId: string | null;
    }>;
    const shiftIds = [
      ...new Set(
        typedSessions
          .map((s) => s.shiftId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const yearIds = [
      ...new Set(
        typedSessions
          .map((s) => s.academicYearId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const [shifts, years] = await Promise.all([
      shiftIds.length
        ? this.prisma.shift.findMany({
            where: { id: { in: shiftIds } },
            select: { id: true, name: true },
          })
        : [],
      yearIds.length
        ? this.prisma.academicYear.findMany({
            where: { id: { in: yearIds } },
            select: { id: true, name: true },
          })
        : [],
    ]);
    const shiftName = new Map(shifts.map((s) => [s.id, s.name]));
    const yearName = new Map(years.map((y) => [y.id, y.name]));
    return typedSessions.map((s) => ({
      ...s,
      isDemo: /demo/i.test(s.name),
      shiftName: s.shiftId ? (shiftName.get(s.shiftId) ?? null) : null,
      academicYearName: s.academicYearId
        ? (yearName.get(s.academicYearId) ?? null)
        : null,
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
    await this.provisioning.syncSessionPapersFromRegistrations(
      tenantId,
      sessionId,
    );
    await refreshExamPaperNames(this.prisma, tenantId, sessionId);
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
        semesterNos: number[];
      }
    >();

    for (const paper of papers) {
      const students = await this.studentsForPaper(tenantId, paper);
      for (const s of students) {
        const existing = byStudent.get(s.id);
        if (existing) {
          existing.paperCount += 1;
          if (
            paper.semesterNo != null &&
            !existing.semesterNos.includes(paper.semesterNo)
          ) {
            existing.semesterNos.push(paper.semesterNo);
          }
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
            semesterNos: paper.semesterNo != null ? [paper.semesterNo] : [],
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
    if (filters?.semesterNo != null) {
      studentRows = studentRows.filter((s) =>
        s.semesterNos.includes(filters.semesterNo as number),
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
    options?: { waiveFee?: boolean },
  ) {
    const session = await this.getSession(tenantId, sessionId);
    await this.provisioning.syncSessionPapersFromRegistrations(
      tenantId,
      sessionId,
    );
    await refreshExamPaperNames(this.prisma, tenantId, sessionId);
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
      waiveFee: options?.waiveFee,
    });

    const papers: PaperRow[] = await this.db().examPaperSchedule.findMany({
      where: { tenantId, sessionId, deletedAt: null },
      orderBy: [{ examDate: 'asc' }, { startTime: 'asc' }],
    });

    const studentPapers = await this.papersForStudentFromRegistrations(
      tenantId,
      studentId,
      session,
      papers,
      student.primaryShiftId,
    );

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

  private async shiftName(shiftId?: string | null) {
    if (!shiftId) return null;
    const shift = await this.prisma.shift.findFirst({
      where: { id: shiftId },
      select: { name: true },
    });
    return shift?.name ?? null;
  }

  private async buildTemplateInput(
    tenantId: string,
    ctx: Awaited<ReturnType<IaAdmitCardService['loadStudentCardContext']>>,
    institution: Awaited<ReturnType<IaAdmitCardService['institutionContext']>>,
    academicYear: string | null,
    admitCardNumber: string,
    verifyToken: string,
    verifyCode: string,
    hints?: { verifyBase?: string; shiftName?: string | null },
  ): Promise<IaAdmitCardTemplateInput> {
    const { session, student, studentPapers } = ctx;
    const verifyUrl = `${hints?.verifyBase ?? (await this.verifyBaseUrl(tenantId))}/verify/ia-admit/${verifyToken}`;
    const sittingSemesters = [
      ...new Set(
        studentPapers
          .map((paper) => paper.semesterNo)
          .filter((semesterNo): semesterNo is number => semesterNo != null),
      ),
    ].sort((a, b) => a - b);
    const progressSemester =
      student.semesterProgress?.[0]?.semesterSequence ?? null;
    const semesterLabel = sittingSemesters.length
      ? sittingSemesters.join(', ')
      : progressSemester != null
        ? String(progressSemester)
        : session.semesterNo != null
          ? String(session.semesterNo)
          : null;
    return {
      institution,
      session: {
        name: session.name,
        examType: session.examType,
        semesterNo:
          sittingSemesters.length === 1
            ? sittingSemesters[0]
            : session.semesterNo,
        semesterLabel,
        academicYear,
        instructions: session.instructions,
        shiftName: hints
          ? (hints.shiftName ?? null)
          : await this.shiftName(session.shiftId),
      },
      student: {
        fullName: student.masterProfile?.fullName ?? student.user?.displayName,
        rollNumber: student.rollNumber,
        enrollmentNumber: student.enrollmentNumber,
        admissionNumber: student.admissionNumber,
        universityRollNumber:
          student.universityRollNumber?.trim() ||
          student.admissionNumber?.trim() ||
          null,
        abcId: student.abcAccount?.abcId ?? null,
        programme: student.programVersion?.program?.name,
        department: student.department?.name,
        semesterNo:
          sittingSemesters.length === 1
            ? sittingSemesters[0]
            : (progressSemester ?? session.semesterNo ?? null),
        semesterLabel,
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
        startTime: formatExamWallClock(p.startTime) ?? '',
        endTime: formatExamWallClock(p.endTime) ?? '',
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
    options?: { persist?: boolean; force?: boolean; waiveFee?: boolean },
  ) {
    const ctx = await this.loadStudentCardContext(
      tenantId,
      sessionId,
      studentId,
      { waiveFee: options?.waiveFee },
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

    const template = await this.buildTemplateInput(
      tenantId,
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
          {
            admitCardNumber,
            studentId,
            feeBookVerified: options?.waiveFee === true,
          },
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

  private async eachChunk<T>(
    items: T[],
    size: number,
    run: (item: T) => Promise<unknown>,
  ) {
    for (let index = 0; index < items.length; index += size) {
      await Promise.all(
        items.slice(index, index + size).map((item) => run(item)),
      );
    }
  }

  /**
   * Bulk export used to rebuild every card from scratch, including a full
   * defaulter scan, then load that student again for the PDF. A cohort of
   * ~1,000 cards never finished inside the client and proxy timeouts.
   * Session papers, institution, and eligibility settings are loaded once.
   */
  private async buildExportTemplates(
    tenantId: string,
    sessionId: string,
    studentIds: string[],
    user?: JwtUser,
    audit?: 'download' | 'print',
    options?: { waiveFee?: boolean },
  ): Promise<IaAdmitCardTemplateInput[]> {
    const orderedIds = [...new Set(studentIds)];
    if (!orderedIds.length) {
      throw new BadRequestException('No students selected');
    }

    await this.provisioning.syncSessionPapersFromRegistrations(
      tenantId,
      sessionId,
    );
    await refreshExamPaperNames(this.prisma, tenantId, sessionId);
    const session = await this.getSession(tenantId, sessionId);
    const [
      institution,
      academicYear,
      verifyBase,
      shiftLabel,
      cfg,
      defaulterList,
      papers,
    ] = await Promise.all([
      this.institutionContext(tenantId),
      this.academicYearLabel(tenantId, session.academicYearId),
      this.verifyBaseUrl(tenantId),
      this.shiftName(session.shiftId),
      this.settings.getOrCreate(tenantId),
      this.defaulters.list(tenantId),
      this.db().examPaperSchedule.findMany({
        where: { tenantId, sessionId, deletedAt: null },
        orderBy: [{ examDate: 'asc' }, { startTime: 'asc' }],
      }) as Promise<PaperRow[]>,
    ]);
    const defaulterIds = new Set(
      (defaulterList.items as Array<{ studentId: string }>).map(
        (row) => row.studentId,
      ),
    );
    const semesterNos = this.sessionSemesterNos(session, papers);

    const slices: string[][] = [];
    for (let index = 0; index < orderedIds.length; index += 300) {
      slices.push(orderedIds.slice(index, index + 300));
    }
    const loaded = await Promise.all(
      slices.map(async (slice) => {
        const [studentBatch, lineBatch] = await Promise.all([
          this.prisma.student.findMany({
            where: { id: { in: slice }, tenantId, deletedAt: null },
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
          }),
          this.prisma.semesterRegistrationLine.findMany({
            where: {
              tenantId,
              status: {
                in: ['approved', 'confirmed', 'registered', 'pending'],
              },
              registration: {
                studentId: { in: slice },
                ...(semesterNos.length
                  ? { semesterSequence: { in: semesterNos } }
                  : {}),
              },
            },
            include: this.registrationLineInclude(),
          }),
        ]);
        return { studentBatch, lineBatch };
      }),
    );
    const students = loaded.flatMap((batch) => batch.studentBatch);
    const lines = loaded.flatMap((batch) => batch.lineBatch);

    const studentById = new Map(
      students.map((student) => [student.id, student]),
    );
    const linesByStudent = new Map<string, typeof lines>();
    for (const line of lines) {
      const studentId = line.registration.studentId;
      const bucket = linesByStudent.get(studentId);
      if (bucket) bucket.push(line);
      else linesByStudent.set(studentId, [line]);
    }

    const existingIssues: Array<{
      id: string;
      studentId: string;
      admitCardNumber: string;
      verifyToken: string;
      verifyHash: string;
    }> = await this.db().iaAdmitCardIssue.findMany({
      where: {
        tenantId,
        sessionId,
        studentId: { in: orderedIds },
        deletedAt: null,
      },
    });
    const issueByStudent = new Map(
      existingIssues.map((issue) => [issue.studentId, issue]),
    );

    const [attendanceRows, feeRows] = await Promise.all([
      this.prisma.studentAttendanceSummary.findMany({
        where: {
          tenantId,
          studentId: { in: orderedIds },
          periodKey: 'SEMESTER',
          ...(session.semesterNo != null
            ? { semesterNo: session.semesterNo }
            : {}),
        },
        select: { studentId: true, percentage: true },
      }),
      this.prisma.studentFeeSummary.findMany({
        where: { tenantId, studentId: { in: orderedIds } },
        select: { studentId: true, totalOutstanding: true, feeStatus: true },
      }),
    ]);
    const attendanceByStudent = new Map<string, number[]>();
    for (const row of attendanceRows) {
      const bucket = attendanceByStudent.get(row.studentId) ?? [];
      bucket.push(Number(row.percentage ?? 0));
      attendanceByStudent.set(row.studentId, bucket);
    }
    const feeByStudent = new Map(
      feeRows.map((row) => [
        row.studentId,
        {
          feeDue: Number(row.totalOutstanding ?? 0),
          feeStatus: row.feeStatus ?? null,
        },
      ]),
    );

    const year = new Date().getFullYear() % 100;
    const sem = String(session.semesterNo ?? 0).padStart(2, '0');
    const prefix = `AC${year}${sem}`;
    const last = await this.db().iaAdmitCardIssue.findFirst({
      where: { tenantId, admitCardNumber: { startsWith: prefix } },
      orderBy: { admitCardNumber: 'desc' },
    });
    let seq = last
      ? parseInt(String(last.admitCardNumber).slice(-4), 10) + 1
      : 1;

    const prepared: Array<{
      studentId: string;
      existing: (typeof existingIssues)[number] | undefined;
      template: IaAdmitCardTemplateInput;
      cardPayload: Record<string, unknown>;
      verifyToken: string;
      verifyHash: string;
      admitCardNumber: string;
      elig: unknown;
    }> = [];

    for (const studentId of orderedIds) {
      const student = studentById.get(studentId);
      if (!student) continue;
      const isDefaulter = defaulterIds.has(studentId);
      const attendanceSamples = attendanceByStudent.get(studentId) ?? [];
      const fee = feeByStudent.get(studentId);
      const elig = await this.eligibility.evaluateStudent(tenantId, student, {
        semesterNo: session.semesterNo,
        isDefaulter,
        waiveFee: options?.waiveFee,
        settings: cfg,
        preloaded: {
          attendancePercent: attendanceSamples.length
            ? Math.round(
                attendanceSamples.reduce((sum, value) => sum + value, 0) /
                  attendanceSamples.length,
              )
            : null,
          feeDue: fee?.feeDue ?? 0,
          feeStatus: fee?.feeStatus ?? null,
        },
      });
      if (!elig.eligible) continue;
      if (cfg.blockAdmitOnDefaulter && isDefaulter) continue;

      const studentPapers = this.matchRegisteredPapers(
        linesByStudent.get(studentId) ?? [],
        session.shiftId ?? null,
        papers,
        student.primaryShiftId,
      );
      const father = student.guardians.find((guardian) =>
        /father/i.test(guardian.guardianType),
      );
      const mother = student.guardians.find((guardian) =>
        /mother/i.test(guardian.guardianType),
      );
      const issue = issueByStudent.get(studentId);
      const verifyToken = issue?.verifyToken ?? randomUUID();
      const verifyHash =
        issue?.verifyHash ??
        createHash('sha256')
          .update(`${studentId}:${sessionId}:${verifyToken}`)
          .digest('hex');
      const verifyCode = verifyHash.slice(0, 16).toUpperCase();
      const admitCardNumber =
        issue?.admitCardNumber ?? `${prefix}${String(seq++).padStart(4, '0')}`;
      const ctx = {
        session,
        student,
        elig,
        isDefaulter,
        studentPapers,
        fatherName: father?.fullName ?? student.masterProfile?.guardianName,
        motherName: mother?.fullName ?? null,
      } as Awaited<ReturnType<IaAdmitCardService['loadStudentCardContext']>>;
      const template = await this.buildTemplateInput(
        tenantId,
        ctx,
        institution,
        academicYear,
        admitCardNumber,
        verifyToken,
        verifyCode,
        { verifyBase, shiftName: shiftLabel },
      );
      prepared.push({
        studentId,
        existing: issue,
        template,
        verifyToken,
        verifyHash,
        admitCardNumber,
        elig,
        cardPayload: {
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
          eligibility: elig,
          generatedAt: new Date().toISOString(),
        },
      });
    }

    if (!prepared.length) {
      throw new BadRequestException('No eligible admit cards to export');
    }

    const now = new Date();
    const updates = prepared.filter((row) => row.existing);
    const creates = prepared.filter((row) => !row.existing);
    await this.eachChunk(updates, 20, (row) =>
      this.db().iaAdmitCardIssue.update({
        where: { id: row.existing!.id },
        data: {
          cardSnapshot: row.cardPayload,
          eligibilitySnapshot: row.elig,
          regeneratedCount: { increment: 1 },
          generatedById: user?.sub,
          generatedAt: now,
          verifyHash: row.verifyHash,
        },
      }),
    );
    if (creates.length) {
      await this.db().iaAdmitCardIssue.createMany({
        data: creates.map((row) => ({
          tenantId,
          sessionId,
          studentId: row.studentId,
          admitCardNumber: row.admitCardNumber,
          verifyToken: row.verifyToken,
          verifyHash: row.verifyHash,
          cardSnapshot: row.cardPayload,
          eligibilitySnapshot: row.elig,
          generatedById: user?.sub,
        })),
      });
    }

    const saved: Array<{ id: string; studentId: string }> =
      await this.db().iaAdmitCardIssue.findMany({
        where: {
          tenantId,
          sessionId,
          studentId: { in: prepared.map((row) => row.studentId) },
          deletedAt: null,
        },
        select: { id: true, studentId: true },
      });
    if (user) {
      await this.db().iaAdmitCardEvent.createMany({
        data: saved.map((row) => ({
          tenantId,
          issueId: row.id,
          action: issueByStudent.has(row.studentId)
            ? 'REGENERATED'
            : 'GENERATED',
          actorId: user.sub,
        })),
      });
      const admitByStudent = new Map(
        prepared.map((row) => [row.studentId, row.admitCardNumber]),
      );
      await this.db().examAuditLog.createMany({
        data: saved.map((row) => ({
          tenantId: user.tid,
          actorId: user.sub,
          entity: 'ia_admit_card',
          entityId: row.id,
          action: issueByStudent.has(row.studentId)
            ? 'REGENERATED'
            : 'GENERATED',
          after: {
            admitCardNumber: admitByStudent.get(row.studentId),
            studentId: row.studentId,
            feeBookVerified: options?.waiveFee === true,
          },
          metadata: { module: 'ia' },
        })),
      });
    }

    if (user && audit) {
      const issueIds = saved.map((row) => row.id);
      if (audit === 'download') {
        await this.db().iaAdmitCardIssue.updateMany({
          where: { id: { in: issueIds } },
          data: { downloadCount: { increment: 1 }, lastDownloadAt: now },
        });
      } else {
        await this.db().iaAdmitCardIssue.updateMany({
          where: { id: { in: issueIds } },
          data: { printCount: { increment: 1 }, lastPrintAt: now },
        });
      }
      await this.db().iaAdmitCardEvent.createMany({
        data: issueIds.map((issueId) => ({
          tenantId,
          issueId,
          action: audit === 'download' ? 'DOWNLOADED' : 'PRINTED',
          actorId: user.sub,
        })),
      });
      await this.db().examAuditLog.createMany({
        data: issueIds.map((issueId) => ({
          tenantId: user.tid,
          actorId: user.sub,
          entity: 'ia_admit_card',
          entityId: issueId,
          action: audit === 'download' ? 'DOWNLOADED' : 'PRINTED',
          metadata: { module: 'ia' },
        })),
      });
    }

    return prepared.map((row) => row.template);
  }

  async exportHtml(
    tenantId: string,
    sessionId: string,
    studentIds: string[],
    user?: JwtUser,
    options?: { waiveFee?: boolean },
  ) {
    const templates = await this.buildExportTemplates(
      tenantId,
      sessionId,
      studentIds,
      user,
      'print',
      options,
    );
    const layout = templates.length > 1 ? 'pair' : 'single';
    const html = await this.pdf.renderDocumentHtml(templates, layout);
    return { html, count: templates.length };
  }

  async exportPdf(
    tenantId: string,
    sessionId: string,
    studentIds: string[],
    user?: JwtUser,
    options?: { waiveFee?: boolean },
  ) {
    const templates = await this.buildExportTemplates(
      tenantId,
      sessionId,
      studentIds,
      user,
      'download',
      options,
    );
    const buffer =
      templates.length === 1
        ? await this.pdf.renderCardPdf(templates[0])
        : await this.pdf.renderBatchPdf(templates);
    const filename =
      templates.length === 1
        ? `ia-admit-${templates[0].student.rollNumber ?? 'student'}.pdf`
        : `ia-admit-cards-${templates.length}.pdf`;
    return { buffer, filename, count: templates.length };
  }

  async exportZip(
    tenantId: string,
    sessionId: string,
    studentIds: string[],
    user?: JwtUser,
    options?: { waiveFee?: boolean },
  ) {
    const session = await this.getSession(tenantId, sessionId);
    const folder = `Semester-${session.semesterNo ?? 'All'}`;
    const zip = new JSZip();
    const folderNode = zip.folder(folder);
    if (!folderNode) throw new BadRequestException('ZIP creation failed');

    const templates = await this.buildExportTemplates(
      tenantId,
      sessionId,
      studentIds,
      user,
      'download',
      options,
    );
    const usedNames = new Set<string>();
    await this.pdf.writeSinglePdfs(templates, (index, pdf) => {
      const roll = templates[index].student.rollNumber?.trim();
      const base = roll || `student-${index + 1}`;
      let name = `${base}.pdf`;
      let suffix = 2;
      while (usedNames.has(name)) {
        name = `${base}-${suffix}.pdf`;
        suffix += 1;
      }
      usedNames.add(name);
      folderNode.file(name, pdf);
    });

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
        await this.buildTemplateInput(
          tenantId,
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
