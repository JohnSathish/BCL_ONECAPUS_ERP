import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createReadStream, existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import type {
  CertificateApprovalDto,
  CertificateBulkIssueDto,
  CertificateCategoryDto,
  CertificateIssueDto,
  CertificatePreviewDto,
  CertificateQueryDto,
  CertificateRequestDto,
  CertificateSequenceDto,
  CertificateSignatureDto,
  CertificateTemplateDto,
} from './dto/certificates.dto';
import { CertificateVariableService } from './certificate-variable.service';
import { CertificateDocumentService } from './certificate-document.service';
import { CommunicationTriggerService } from '../communication/services/communication-trigger.service';
import {
  DBC_OFFICIAL_TEMPLATES,
  DBC_OFFICIAL_VARIABLE_KEYS,
} from './templates/dbc-certificate.layout';

const DEFAULT_TEMPLATE = `
<section style="font-family: Georgia, serif; padding: 56px; border: 12px double #1f2937; min-height: 820px; text-align: center;">
  <h1 style="font-size: 30px; letter-spacing: 3px;">{{college_name}}</h1>
  <p style="font-size: 13px;">Affiliated to {{university_name}}</p>
  <h2 style="margin-top: 80px; font-size: 28px;">Certificate</h2>
  <p style="margin-top: 44px; font-size: 18px; line-height: 1.8;">
    This is to certify that <strong>{{student_name}}</strong>, bearing registration/enrollment
    number <strong>{{registration_number}}</strong>, is/was a student of
    <strong>{{programme}}</strong> under <strong>{{department}}</strong>.
  </p>
  <p style="margin-top: 40px;">Issued on {{date_of_issue}}</p>
  <div style="margin-top: 80px; display: flex; justify-content: space-between;">
    <span>Certificate No: {{certificate_number}}</span>
    <span>{{principal_name}}</span>
  </div>
</section>`;

@Injectable()
export class CertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly variables: CertificateVariableService,
    private readonly documents: CertificateDocumentService,
    private readonly communication: CommunicationTriggerService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  private hasPermission(user: JwtUser, slug: string) {
    return user.permissions?.includes(slug) ?? false;
  }

  private hasAnyPermission(user: JwtUser, slugs: string[]) {
    return slugs.some((slug) => this.hasPermission(user, slug));
  }

  private isCertStaff(user: JwtUser) {
    return this.hasAnyPermission(user, [
      'certificates:read',
      'certificates:manage',
      'certificates:approve',
      'students:read',
      'students:manage',
      'academic:read',
      'academic:manage',
    ]);
  }

  private async resolveStudentRecord(user: JwtUser) {
    const student = await this.prisma.student.findFirst({
      where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
      include: { masterProfile: true },
    });
    if (!student)
      throw new NotFoundException('Student profile not found for this account');
    return student;
  }

  async myProfile(user: JwtUser) {
    const student = await this.resolveStudentRecord(user);
    return {
      studentId: student.id,
      enrollmentNumber: student.enrollmentNumber,
      fullName: student.masterProfile?.fullName ?? '',
    };
  }

  myRequests(user: JwtUser) {
    return this.resolveStudentRecord(user).then((student) =>
      this.listRequests(user.tid, { studentId: student.id }),
    );
  }

  myIssues(user: JwtUser) {
    return this.resolveStudentRecord(user).then((student) =>
      this.listIssues(user.tid, { studentId: student.id }),
    );
  }

  async createMyRequest(user: JwtUser, dto: CertificateRequestDto) {
    const student = await this.resolveStudentRecord(user);
    return this.createRequest(user, { ...dto, studentId: student.id });
  }

  async previewMyCertificate(
    user: JwtUser,
    dto: Omit<CertificatePreviewDto, 'studentId'>,
  ) {
    const student = await this.resolveStudentRecord(user);
    return this.previewCertificate(user, { ...dto, studentId: student.id });
  }

  async getMyIssueDocumentStream(user: JwtUser, issueId: string) {
    const student = await this.resolveStudentRecord(user);
    const issue = await this.getIssue(user.tid, issueId);
    if (issue.studentId !== student.id)
      throw new ForbiddenException(
        'You can only download your own certificates',
      );
    return this.getIssueDocumentStream(user.tid, issueId);
  }

  async dashboard(tenantId: string) {
    const [categories, templates, requests, issues, approvals, verifications] =
      await Promise.all([
        this.db().certificateCategory.count({
          where: { tenantId, deletedAt: null },
        }),
        this.db().certificateTemplate.count({
          where: { tenantId, deletedAt: null },
        }),
        this.db().certificateRequest.findMany({
          where: { tenantId },
          take: 5000,
        }),
        this.db().certificateIssue.findMany({
          where: { tenantId },
          take: 5000,
        }),
        this.db().certificateApproval.count({
          where: { tenantId, status: 'PENDING' },
        }),
        this.db().certificateVerification.count({ where: { tenantId } }),
      ]);
    const today = new Date().toISOString().slice(0, 10);
    return {
      kpis: {
        categories,
        templates,
        requests: requests.length,
        pendingRequests: requests.filter((row: any) =>
          ['SUBMITTED', 'IN_REVIEW'].includes(row.status),
        ).length,
        pendingApprovals: approvals,
        issuedToday: issues.filter((row: any) =>
          String(row.issuedAt).startsWith(today),
        ).length,
        totalIssued: issues.length,
        verificationRequests: verifications,
      },
      trends: this.monthlyTrend(issues),
      mostRequested: this.groupCount(requests, 'requestType'),
      statusMix: this.groupCount(requests, 'status'),
      recentIssues: issues.slice(-10).reverse(),
    };
  }

  seedDefaultCategories(user: JwtUser) {
    const defaults = [
      ['DEGREE', 'Degree Certificate', 'ACADEMIC'],
      ['PROVISIONAL', 'Provisional Certificate', 'ACADEMIC'],
      ['COURSE_COMPLETION', 'Course Completion Certificate', 'ACADEMIC'],
      ['MARKSHEET', 'Marksheet', 'MARKS'],
      ['TRANSCRIPT', 'Transcript', 'MARKS'],
      ['BONAFIDE', 'Bonafide Certificate', 'VERIFICATION'],
      ['STUDY', 'Study Certificate', 'VERIFICATION'],
      ['CONDUCT', 'Conduct Certificate', 'VERIFICATION'],
      ['CHARACTER', 'Character Certificate', 'VERIFICATION'],
      ['MIGRATION', 'Migration Certificate', 'VERIFICATION'],
      ['TRANSFER', 'Transfer Certificate', 'VERIFICATION'],
      ['INTERNSHIP', 'Internship Certificate', 'TRAINING'],
      ['WORKSHOP', 'Workshop Certificate', 'TRAINING'],
      ['SKILL', 'Skill Development Certificate', 'TRAINING'],
      ['MERIT', 'Merit Certificate', 'ACHIEVEMENT'],
      ['SPORTS', 'Sports Certificate', 'ACHIEVEMENT'],
      ['NSS', 'NSS Certificate', 'ACHIEVEMENT'],
      ['NCC', 'NCC Certificate', 'ACHIEVEMENT'],
      ['RECOMMENDATION', 'Recommendation Letter', 'PLACEMENT'],
      ['RESEARCH_PROJECT', 'Research Project Certificate', 'RESEARCH'],
    ];
    return Promise.all(
      defaults.map(([code, name, group]) =>
        this.db().certificateCategory.upsert({
          where: { tenantId_code: { tenantId: user.tid, code } },
          update: { name, group, isActive: true },
          create: { tenantId: user.tid, code, name, group },
        }),
      ),
    );
  }

  async seedDbcOfficialTemplates(user: JwtUser) {
    await this.seedDefaultCategories(user);
    const categories = await this.listCategories(user.tid);
    const results = [];

    for (const categoryCode of Object.keys(DBC_OFFICIAL_TEMPLATES) as Array<
      keyof typeof DBC_OFFICIAL_TEMPLATES
    >) {
      const def = DBC_OFFICIAL_TEMPLATES[categoryCode];
      const category = categories.find(
        (row: { code: string }) => row.code === categoryCode,
      );
      if (!category) continue;

      const existing = await this.db().certificateTemplate.findFirst({
        where: { tenantId: user.tid, code: def.code, deletedAt: null },
        include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
      });

      if (existing) {
        const latestVersion = existing.versions?.[0]?.version ?? 0;
        const version = await this.db().certificateTemplateVersion.create({
          data: {
            tenantId: user.tid,
            templateId: existing.id,
            version: latestVersion + 1,
            mode: 'HTML',
            html: def.html,
            layout: {},
            variables: DBC_OFFICIAL_VARIABLE_KEYS,
            createdById: user.sub,
          },
        });
        await this.db().certificateTemplateVersion.update({
          where: { id: version.id },
          data: { isPublished: true },
        });
        const updated = await this.db().certificateTemplate.update({
          where: { id: existing.id },
          data: {
            name: def.name,
            status: 'PUBLISHED',
            activeVersionId: version.id,
            publishedAt: new Date(),
          },
          include: {
            category: true,
            versions: { orderBy: { version: 'desc' }, take: 1 },
          },
        });
        results.push(updated);
      } else {
        const created = await this.createTemplate(user, {
          categoryId: category.id,
          code: def.code,
          name: def.name,
          description: 'Official Don Bosco College unified certificate layout',
          orientation: 'PORTRAIT',
          pageSize: 'A4',
          html: def.html,
          layout: {},
          variables: DBC_OFFICIAL_VARIABLE_KEYS,
        });
        results.push(await this.publishTemplate(user, created.id));
      }
    }

    await this.audit(user, 'templates.dbc_official_seeded', {
      metadata: { count: results.length },
    });

    const year = new Date().getFullYear();
    await this.db().certificateNumberSequence.upsert({
      where: {
        tenantId_categoryCode_year: {
          tenantId: user.tid,
          categoryCode: 'TRANSFER',
          year,
        },
      },
      update: { prefix: 'DBC/TC', format: '{{prefix}}/{{year}}/{{number}}' },
      create: {
        tenantId: user.tid,
        categoryCode: 'TRANSFER',
        year,
        prefix: 'DBC/TC',
        currentNo: 0,
        format: '{{prefix}}/{{year}}/{{number}}',
      },
    });

    return results;
  }

  listCategories(tenantId: string) {
    return this.db().certificateCategory.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  createCategory(user: JwtUser, dto: CertificateCategoryDto) {
    return this.db().certificateCategory.create({
      data: {
        tenantId: user.tid,
        code: dto.code.toUpperCase(),
        name: dto.name,
        group: dto.group ?? 'CUSTOM',
        description: dto.description,
      },
    });
  }

  listTemplates(tenantId: string, query: CertificateQueryDto) {
    return this.db().certificateTemplate.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: {
        category: true,
        versions: { orderBy: { version: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createTemplate(user: JwtUser, dto: CertificateTemplateDto) {
    const template = await this.db().certificateTemplate.create({
      data: {
        tenantId: user.tid,
        categoryId: dto.categoryId,
        code: dto.code.toUpperCase(),
        name: dto.name,
        description: dto.description,
        language: dto.language ?? 'en',
        orientation: dto.orientation ?? 'PORTRAIT',
        pageSize: dto.pageSize ?? 'A4',
        createdById: user.sub,
        versions: {
          create: {
            tenantId: user.tid,
            version: 1,
            mode: 'HTML',
            html: dto.html ?? DEFAULT_TEMPLATE,
            layout: dto.layout ?? {},
            variables: dto.variables ?? this.defaultVariableKeys(),
            createdById: user.sub,
          },
        },
      },
      include: { category: true, versions: true },
    });
    await this.audit(user, 'template.created', {
      templateId: template.id,
      after: template,
    });
    return template;
  }

  async publishTemplate(user: JwtUser, templateId: string) {
    const latest = await this.db().certificateTemplateVersion.findFirst({
      where: { tenantId: user.tid, templateId },
      orderBy: { version: 'desc' },
    });
    if (!latest) throw new NotFoundException('Template version not found');
    const updated = await this.db().certificateTemplate.update({
      where: { id: templateId },
      data: {
        status: 'PUBLISHED',
        activeVersionId: latest.id,
        publishedAt: new Date(),
      },
      include: { versions: true, category: true },
    });
    await this.db().certificateTemplateVersion.update({
      where: { id: latest.id },
      data: { isPublished: true },
    });
    await this.audit(user, 'template.published', {
      templateId,
      after: updated,
    });
    return updated;
  }

  async cloneTemplate(user: JwtUser, templateId: string) {
    const original = await this.db().certificateTemplate.findFirst({
      where: { tenantId: user.tid, id: templateId, deletedAt: null },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!original) throw new NotFoundException('Template not found');
    return this.createTemplate(user, {
      categoryId: original.categoryId,
      code: `${original.code}_COPY_${Date.now()}`,
      name: `${original.name} Copy`,
      description: original.description,
      language: original.language,
      orientation: original.orientation,
      pageSize: original.pageSize,
      html: original.versions?.[0]?.html ?? DEFAULT_TEMPLATE,
      layout: original.versions?.[0]?.layout ?? {},
      variables:
        original.versions?.[0]?.variables ?? this.defaultVariableKeys(),
    });
  }

  async listRequests(tenantId: string, query: CertificateQueryDto) {
    return this.db().certificateRequest.findMany({
      where: {
        tenantId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.studentId ? { studentId: query.studentId } : {}),
      },
      include: {
        category: true,
        approvals: { orderBy: { sequence: 'asc' } },
        issues: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  async createRequest(user: JwtUser, dto: CertificateRequestDto) {
    let studentId = dto.studentId;
    const selfOnly =
      this.hasPermission(user, 'certificates:self') &&
      !this.hasAnyPermission(user, ['certificates:manage', 'students:manage']);
    if (selfOnly) {
      const student = await this.resolveStudentRecord(user);
      if (dto.studentId && dto.studentId !== student.id) {
        throw new ForbiddenException(
          'You can only submit certificate requests for your own profile',
        );
      }
      studentId = student.id;
    } else if (
      !this.hasAnyPermission(user, [
        'certificates:manage',
        'students:manage',
        'students:read',
      ])
    ) {
      throw new ForbiddenException(
        'You do not have permission to submit certificate requests',
      );
    }
    if (!studentId) throw new BadRequestException('studentId is required');

    const request = await this.db().certificateRequest.create({
      data: {
        tenantId: user.tid,
        categoryId: dto.categoryId,
        templateId: dto.templateId,
        studentId,
        requestNo: await this.nextRequestNo(user.tid),
        requestType: dto.requestType,
        purpose: dto.purpose,
        variableData: dto.variableData ?? {},
        submittedById: user.sub,
        status: 'SUBMITTED',
        approvals: {
          create: this.defaultApprovalSteps(user.tid),
        },
      },
      include: { category: true, approvals: { orderBy: { sequence: 'asc' } } },
    });
    await this.audit(user, 'request.submitted', {
      requestId: request.id,
      after: request,
    });
    return request;
  }

  async actOnApproval(
    user: JwtUser,
    approvalId: string,
    dto: CertificateApprovalDto,
  ) {
    const approval = await this.db().certificateApproval.findFirst({
      where: { tenantId: user.tid, id: approvalId },
      include: { request: true },
    });
    if (!approval) throw new NotFoundException('Approval step not found');
    if (approval.status !== 'PENDING')
      throw new BadRequestException('This approval step is already completed');
    if (
      ['REJECTED', 'ISSUED', 'CANCELLED'].includes(
        approval.request?.status ?? '',
      )
    ) {
      throw new BadRequestException(
        'This request is no longer open for approval',
      );
    }

    const steps = await this.db().certificateApproval.findMany({
      where: { tenantId: user.tid, requestId: approval.requestId },
      orderBy: { sequence: 'asc' },
    });
    const currentStep = steps.find(
      (step: { status: string }) => step.status === 'PENDING',
    );
    if (!currentStep || currentStep.id !== approvalId) {
      throw new BadRequestException(
        'Previous workflow steps must be completed first',
      );
    }

    const roleMatch = user.roles?.includes(approval.roleSlug) ?? false;
    const canApprove =
      this.hasPermission(user, 'certificates:manage') ||
      (this.hasAnyPermission(user, [
        'certificates:approve',
        'students:manage',
        'academic:manage',
      ]) &&
        roleMatch);
    if (!canApprove) {
      throw new ForbiddenException(
        `This step requires the ${approval.roleSlug} role`,
      );
    }

    const status = dto.action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const updated = await this.db().certificateApproval.update({
      where: { id: approvalId },
      data: {
        status,
        comments: dto.comments,
        approverId: user.sub,
        actedAt: new Date(),
      },
    });
    const remaining = await this.db().certificateApproval.count({
      where: {
        tenantId: user.tid,
        requestId: approval.requestId,
        status: 'PENDING',
      },
    });
    await this.db().certificateRequest.update({
      where: { id: approval.requestId },
      data: {
        status:
          status === 'REJECTED'
            ? 'REJECTED'
            : remaining === 0
              ? 'APPROVED'
              : 'IN_REVIEW',
        ...(status === 'REJECTED'
          ? { rejectedAt: new Date(), rejectionReason: dto.comments }
          : {}),
      },
    });
    await this.audit(user, `approval.${status.toLowerCase()}`, {
      requestId: approval.requestId,
      after: updated,
    });
    return updated;
  }

  listIssues(tenantId: string, query: CertificateQueryDto) {
    return this.db().certificateIssue.findMany({
      where: {
        tenantId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.studentId ? { studentId: query.studentId } : {}),
      },
      include: { category: true, request: true },
      orderBy: { issuedAt: 'desc' },
      take: 500,
    });
  }

  async getIssue(tenantId: string, issueId: string) {
    const issue = await this.db().certificateIssue.findFirst({
      where: { tenantId, id: issueId },
      include: { category: true, template: true },
    });
    if (!issue) throw new NotFoundException('Certificate issue not found');
    return issue;
  }

  async previewCertificate(user: JwtUser, dto: CertificatePreviewDto) {
    const category = await this.db().certificateCategory.findFirst({
      where: { tenantId: user.tid, id: dto.categoryId },
    });
    if (!category)
      throw new NotFoundException('Certificate category not found');

    const template = await this.resolveTemplate(
      user.tid,
      dto.categoryId,
      dto.templateId,
    );
    const version = template?.versions?.[0];
    const certificateNo = 'PREVIEW-0000';
    const verificationToken = randomUUID();
    const variableSnapshot = await this.variables.buildStudentVariables(
      user.tid,
      dto.studentId,
      { ...(dto.variableData ?? {}), certificate_number: certificateNo },
      {
        verificationToken,
        certificateNo,
        categoryCode: category.code,
        preview: true,
      },
    );
    const renderedHtml = this.variables.renderTemplate(
      version?.html ?? DEFAULT_TEMPLATE,
      variableSnapshot,
    );
    return { renderedHtml, variableSnapshot, templateId: template?.id ?? null };
  }

  async getIssueDocumentStream(
    tenantId: string,
    issueId: string,
    user?: JwtUser,
  ) {
    const issue = await this.getIssue(tenantId, issueId);
    if (
      user &&
      this.hasPermission(user, 'certificates:self') &&
      !this.isCertStaff(user)
    ) {
      const student = await this.resolveStudentRecord(user);
      if (issue.studentId !== student.id)
        throw new ForbiddenException(
          'You can only download your own certificates',
        );
    }
    const publicPath = issue.pdfPath;
    if (!publicPath)
      throw new NotFoundException('Certificate document not found');
    const absolutePath = this.documents.resolveAbsolutePath(publicPath);
    if (!existsSync(absolutePath))
      throw new NotFoundException('Certificate file missing on disk');
    const ext = publicPath.endsWith('.pdf') ? '.pdf' : '.html';
    const filename = `${issue.certificateNo.replace(/\//g, '-')}${ext}`;
    return {
      stream: createReadStream(absolutePath),
      filename,
      mimeType: this.documents.mimeTypeForPath(publicPath),
    };
  }

  async issuanceRegister(tenantId: string, query: CertificateQueryDto) {
    const issues = await this.db().certificateIssue.findMany({
      where: {
        tenantId,
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.studentId ? { studentId: query.studentId } : {}),
      },
      include: {
        category: true,
        template: true,
      },
      orderBy: { issuedAt: 'desc' },
      take: 1000,
    });

    const studentIds = [
      ...new Set(issues.map((row: { studentId: string }) => row.studentId)),
    ];
    const students = studentIds.length
      ? await this.db().student.findMany({
          where: { tenantId, id: { in: studentIds } },
          include: {
            masterProfile: true,
            department: true,
            programVersion: { include: { program: true } },
          },
        })
      : [];
    const studentById = new Map<string, Record<string, unknown>>(
      students.map((row: Record<string, unknown>) => [String(row.id), row]),
    );

    const rows = issues.map((issue: any) => {
      const student = studentById.get(issue.studentId) as
        | {
            enrollmentNumber?: string;
            masterProfile?: { fullName?: string | null } | null;
            programVersion?: {
              program?: { name?: string | null } | null;
            } | null;
            department?: { name?: string | null } | null;
          }
        | undefined;
      return {
        id: issue.id,
        certificateNo: issue.certificateNo,
        categoryCode: issue.category?.code,
        categoryName: issue.category?.name,
        templateName: issue.template?.name,
        status: issue.status,
        issuedAt: issue.issuedAt,
        studentId: issue.studentId,
        studentName: student?.masterProfile?.fullName ?? '',
        enrollmentNumber: student?.enrollmentNumber ?? '',
        programme: student?.programVersion?.program?.name ?? '',
        department: student?.department?.name ?? '',
        verificationToken: issue.verificationToken,
      };
    });

    const byCategory = this.groupCount(rows, 'categoryName');
    const byMonth = this.monthlyTrend(issues);

    return {
      summary: {
        total: rows.length,
        issued: rows.filter(
          (row: { status: string }) => row.status === 'ISSUED',
        ).length,
        revoked: rows.filter(
          (row: { status: string }) => row.status === 'REVOKED',
        ).length,
      },
      byCategory,
      byMonth,
      rows,
    };
  }

  private async resolveTemplate(
    tenantId: string,
    categoryId: string,
    templateId?: string,
  ) {
    if (templateId) {
      return this.db().certificateTemplate.findFirst({
        where: { tenantId, id: templateId, deletedAt: null },
        include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
      });
    }
    return this.db().certificateTemplate.findFirst({
      where: { tenantId, categoryId, status: 'PUBLISHED', deletedAt: null },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async issueCertificate(user: JwtUser, dto: CertificateIssueDto) {
    if (
      !this.hasAnyPermission(user, ['certificates:manage', 'students:manage'])
    ) {
      throw new ForbiddenException(
        'You do not have permission to issue certificates',
      );
    }

    const category = await this.db().certificateCategory.findFirst({
      where: { tenantId: user.tid, id: dto.categoryId },
    });
    if (!category)
      throw new NotFoundException('Certificate category not found');

    if (dto.requestId) {
      const request = await this.db().certificateRequest.findFirst({
        where: { tenantId: user.tid, id: dto.requestId },
        include: { issues: true },
      });
      if (!request)
        throw new NotFoundException('Certificate request not found');
      if (request.status !== 'APPROVED') {
        throw new BadRequestException(
          'Certificate can only be issued after the request is fully approved',
        );
      }
      if (request.studentId !== dto.studentId) {
        throw new BadRequestException(
          'Student does not match the approved request',
        );
      }
      if (request.issues?.length) {
        throw new BadRequestException(
          'A certificate has already been issued for this request',
        );
      }
    }

    const template = await this.resolveTemplate(
      user.tid,
      dto.categoryId,
      dto.templateId,
    );

    const certificateNo = await this.nextCertificateNo(user.tid, category.code);
    const verificationToken = randomUUID();
    const variableSnapshot = await this.variables.buildStudentVariables(
      user.tid,
      dto.studentId,
      { ...(dto.variableData ?? {}), certificate_number: certificateNo },
      { verificationToken, certificateNo, categoryCode: category.code },
    );
    const version = template?.versions?.[0];
    const renderedHtml = this.variables.renderTemplate(
      version?.html ?? DEFAULT_TEMPLATE,
      variableSnapshot,
    );
    const qrPayload = `/verify/certificates/${verificationToken}`;

    const issue = await this.db().certificateIssue.create({
      data: {
        tenantId: user.tid,
        categoryId: dto.categoryId,
        templateId: template?.id,
        templateVersionId: version?.id,
        requestId: dto.requestId,
        studentId: dto.studentId,
        certificateNo,
        renderedHtml,
        qrPayload,
        verificationToken,
        variableSnapshot,
        issuedById: user.sub,
      },
      include: { category: true, template: true },
    });

    const document = await this.documents.persistCertificateDocument(
      user.tid,
      issue.id,
      renderedHtml,
    );
    const withDocument = await this.db().certificateIssue.update({
      where: { id: issue.id },
      data: {
        pdfPath: document.primaryPath,
        metadata: { htmlPath: document.htmlPath, pdfPath: document.pdfPath },
      },
      include: { category: true, template: true },
    });

    if (dto.requestId) {
      await this.db().certificateRequest.update({
        where: { id: dto.requestId },
        data: { status: 'ISSUED', completedAt: new Date() },
      });
    }
    await this.audit(user, 'certificate.issued', {
      issueId: issue.id,
      requestId: dto.requestId,
      after: withDocument,
    });
    void this.notifyCertificateIssued(user.tid, withDocument);
    return withDocument;
  }

  private async notifyCertificateIssued(
    tenantId: string,
    issue: {
      id: string;
      studentId: string;
      certificateNo: string;
      category?: { name: string };
    },
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: issue.studentId, tenantId, deletedAt: null },
      include: {
        user: { select: { id: true, email: true, displayName: true } },
        masterProfile: { select: { fullName: true, email: true } },
      },
    });
    if (!student?.user) return;

    const institutionName =
      await this.communication.getInstitutionName(tenantId);
    const displayName =
      student.masterProfile?.fullName ??
      student.user.displayName ??
      student.user.email;

    await this.communication.trigger({
      tenantId,
      templateCode: 'CERTIFICATE_READY',
      triggerKey: 'certificate.issued',
      entityType: 'certificate_issue',
      entityId: issue.id,
      recipient: {
        recipientType: 'STUDENT',
        userId: student.userId,
        studentId: student.id,
        displayName,
        email: student.masterProfile?.email ?? student.user.email,
      },
      variables: {
        student_name: displayName,
        certificate_type: issue.category?.name ?? 'Certificate',
        certificate_number: issue.certificateNo,
        institution_name: institutionName,
      },
    });
  }

  async bulkIssue(user: JwtUser, dto: CertificateBulkIssueDto) {
    const issued = [];
    for (const studentId of dto.studentIds) {
      issued.push(
        await this.issueCertificate(user, {
          categoryId: dto.categoryId,
          templateId: dto.templateId,
          studentId,
        }),
      );
    }
    return { issuedCount: issued.length, issued };
  }

  async revokeIssue(user: JwtUser, issueId: string, reason?: string) {
    const issue = await this.db().certificateIssue.findFirst({
      where: { tenantId: user.tid, id: issueId },
    });
    if (!issue) throw new NotFoundException('Certificate issue not found');
    if (issue.status === 'REVOKED')
      throw new BadRequestException('Certificate is already revoked');

    const updated = await this.db().certificateIssue.update({
      where: { id: issueId },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokedById: user.sub,
        revokeReason: reason,
      },
    });
    await this.audit(user, 'certificate.revoked', {
      issueId,
      reason,
      after: updated,
    });
    return updated;
  }

  async verify(
    token: string,
    meta: { ipAddress?: string; userAgent?: string },
  ) {
    const issue = await this.db().certificateIssue.findFirst({
      where: { verificationToken: token },
      include: { category: true },
    });
    if (!issue) throw new NotFoundException('Certificate not found');
    await this.db().certificateVerification.create({
      data: {
        tenantId: issue.tenantId,
        issueId: issue.id,
        token,
        status: issue.status === 'ISSUED' ? 'VALID' : issue.status,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });
    return {
      valid: issue.status === 'ISSUED',
      status: issue.status,
      certificateNo: issue.certificateNo,
      certificateType: issue.category.name,
      studentName: issue.variableSnapshot?.student_name,
      programme: issue.variableSnapshot?.programme,
      issueDate: issue.issuedAt,
      institution: issue.variableSnapshot?.college_name,
    };
  }

  sequences(tenantId: string) {
    return this.db().certificateNumberSequence.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  upsertSequence(user: JwtUser, dto: CertificateSequenceDto) {
    return this.db().certificateNumberSequence.upsert({
      where: {
        tenantId_categoryCode_year: {
          tenantId: user.tid,
          categoryCode: dto.categoryCode,
          year: dto.year,
        },
      },
      update: {
        prefix: dto.prefix,
        suffix: dto.suffix,
        format: dto.format ?? '{{prefix}}/{{year}}/{{number}}',
      },
      create: {
        tenantId: user.tid,
        categoryCode: dto.categoryCode,
        prefix: dto.prefix,
        suffix: dto.suffix,
        year: dto.year,
        format: dto.format ?? '{{prefix}}/{{year}}/{{number}}',
      },
    });
  }

  signatures(tenantId: string) {
    return this.db().certificateSignature.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { roleSlug: 'asc' },
    });
  }

  async upsertSignature(user: JwtUser, dto: CertificateSignatureDto) {
    const existing = await this.db().certificateSignature.findFirst({
      where: { tenantId: user.tid, roleSlug: dto.roleSlug, deletedAt: null },
    });
    if (existing) {
      return this.db().certificateSignature.update({
        where: { id: existing.id },
        data: {
          displayName: dto.displayName,
          designation: dto.designation,
          signaturePath: dto.signaturePath ?? existing.signaturePath,
          sealPath: dto.sealPath ?? existing.sealPath,
          isActive: dto.isActive ?? true,
        },
      });
    }
    return this.db().certificateSignature.create({
      data: {
        tenantId: user.tid,
        roleSlug: dto.roleSlug,
        displayName: dto.displayName,
        designation: dto.designation,
        signaturePath: dto.signaturePath,
        sealPath: dto.sealPath,
        isActive: dto.isActive ?? true,
      },
    });
  }

  auditLogs(tenantId: string) {
    return this.db().certificateAuditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
  }

  private async nextRequestNo(tenantId: string) {
    const count = await this.db().certificateRequest.count({
      where: { tenantId },
    });
    return `CERT-REQ-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
  }

  private async nextCertificateNo(tenantId: string, categoryCode: string) {
    const year = new Date().getFullYear();
    const prefixCode = categoryCode === 'TRANSFER' ? 'TC' : categoryCode;
    const seq = await this.db().certificateNumberSequence.upsert({
      where: { tenantId_categoryCode_year: { tenantId, categoryCode, year } },
      update: { currentNo: { increment: 1 } },
      create: {
        tenantId,
        categoryCode,
        year,
        prefix: `DBC/${prefixCode}`,
        currentNo: 1,
        format: '{{prefix}}/{{year}}/{{number}}',
      },
    });
    const pad = categoryCode === 'TRANSFER' ? 5 : 4;
    const number = String(seq.currentNo).padStart(pad, '0');
    return String(seq.format)
      .replace('{{prefix}}', seq.prefix)
      .replace('{{year}}', String(year))
      .replace('{{number}}', number)
      .replace('{{suffix}}', seq.suffix ?? '');
  }

  private defaultApprovalSteps(tenantId: string) {
    return [
      {
        tenantId,
        stepCode: 'DEPARTMENT_VERIFY',
        stepName: 'Department Verification',
        roleSlug: 'hod',
        sequence: 1,
      },
      {
        tenantId,
        stepCode: 'FINAL_ISSUE',
        stepName: 'Final Issue',
        roleSlug: 'college-admin',
        sequence: 2,
      },
    ];
  }

  private defaultVariableKeys() {
    return DBC_OFFICIAL_VARIABLE_KEYS;
  }

  private monthlyTrend(rows: any[]) {
    const buckets = new Map<string, number>();
    for (const row of rows) {
      const key = String(row.issuedAt ?? row.createdAt).slice(0, 7);
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    return Array.from(buckets.entries()).map(([month, issued]) => ({
      month,
      issued,
    }));
  }

  private groupCount(rows: any[], field: string) {
    const buckets = new Map<string, number>();
    for (const row of rows)
      buckets.set(
        String(row[field] ?? 'UNKNOWN'),
        (buckets.get(String(row[field] ?? 'UNKNOWN')) ?? 0) + 1,
      );
    return Array.from(buckets.entries()).map(([label, value]) => ({
      label,
      value,
    }));
  }

  private audit(
    user: JwtUser,
    action: string,
    input: Record<string, any> = {},
  ) {
    return this.db().certificateAuditLog.create({
      data: {
        tenantId: user.tid,
        actorId: user.sub,
        templateId: input.templateId,
        requestId: input.requestId,
        issueId: input.issueId,
        action,
        reason: input.reason,
        before: input.before,
        after: input.after,
        metadata: input.metadata,
      },
    });
  }
}
