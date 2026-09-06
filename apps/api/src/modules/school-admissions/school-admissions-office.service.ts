import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import { AdmissionsCycleService } from '../admissions/admissions-cycle.service';
import {
  evaluateSchoolAgeEligibility,
  evaluateSchoolAdmissionWindow,
  isSchoolCycleSettings,
  requiredSchoolDocumentCodes,
  schoolMaxOnlineApplications,
  type SchoolCycleSettings,
} from './school-admission.constants';
import {
  SCHOOL_CASTE_CATEGORY_POLICY,
  isSchoolCasteCategoryCode,
  resolveSchoolCasteCategory,
  schoolCasteCategoryPolicy,
  type SchoolCasteCategoryCode,
} from './school-admission-category';
import {
  normalizeSchoolDocumentRequirements,
  resolveApplicableSchoolCertificates,
} from './school-document-requirements';
import { SchoolOfficeListQueryDto } from './dto/school-admissions.dto';
import { buildSchoolKgAdmissionExcelReport } from './reports/school-kg-admission-excel.report';
import { generateSchoolLoginPin } from './school-login-pin';

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function categoryFromApplication(formData: unknown) {
  const child = asRecord(asRecord(formData).child);
  return {
    child,
    category: resolveSchoolCasteCategory(child),
  };
}

function buildCertificateChecklist(
  formData: unknown,
  documents: Array<{
    slotCode: string;
    verificationStatus: string;
    fileUrl?: string | null;
    createdAt?: Date | string | null;
    sizeBytes?: number | null;
    remarks?: string | null;
  }>,
  settings?: SchoolCycleSettings | null,
) {
  const { category } = categoryFromApplication(formData);
  const applicable = resolveApplicableSchoolCertificates(asRecord(formData), {
    categoryCode: category?.code ?? null,
    documentRequirements: settings?.documentRequirements,
  });
  const byCode = new Map(documents.map((doc) => [doc.slotCode, doc]));

  return applicable.map((item) => {
    const uploaded = byCode.get(item.slotCode);
    return {
      slotCode: item.slotCode,
      label: item.label,
      helperText: item.helperText,
      required: item.required,
      uploaded: Boolean(uploaded),
      verificationStatus: uploaded?.verificationStatus ?? 'MISSING',
      fileUrl: uploaded?.fileUrl ?? null,
      createdAt: uploaded?.createdAt
        ? new Date(uploaded.createdAt).toISOString()
        : null,
      sizeBytes: uploaded?.sizeBytes ?? null,
      remarks: uploaded?.remarks ?? null,
    };
  });
}

type DocRollupFilter = 'pending' | 'verified' | 'rejected' | 'incomplete';

function documentRollupForApp(
  formData: unknown,
  documents: Array<{ slotCode: string; verificationStatus: string }>,
  settings?: SchoolCycleSettings | null,
): {
  filterKey: DocRollupFilter | 'none';
  pendingCount: number;
  allRequiredVerified: boolean;
  hasRejected: boolean;
} {
  const requiredCodes = requiredSchoolDocumentCodes(
    asRecord(formData),
    false,
    settings?.documentRequirements,
  ).filter((code) => code !== 'PAYMENT_RECEIPT');
  const byCode = new Map(documents.map((d) => [d.slotCode, d]));

  let missing = 0;
  let pending = 0;
  let rejected = 0;
  let verified = 0;

  for (const code of requiredCodes) {
    const doc = byCode.get(code);
    const status = (doc?.verificationStatus ?? 'MISSING').toUpperCase();
    if (!doc || status === 'MISSING') missing += 1;
    else if (status === 'VERIFIED') verified += 1;
    else if (status === 'REJECTED') rejected += 1;
    else pending += 1;
  }

  if (requiredCodes.length === 0) {
    return {
      filterKey: 'none',
      pendingCount: 0,
      allRequiredVerified: true,
      hasRejected: false,
    };
  }
  if (rejected > 0) {
    return {
      filterKey: 'rejected',
      pendingCount: pending,
      allRequiredVerified: false,
      hasRejected: true,
    };
  }
  if (verified === requiredCodes.length) {
    return {
      filterKey: 'verified',
      pendingCount: 0,
      allRequiredVerified: true,
      hasRejected: false,
    };
  }
  if (missing > 0 && pending === 0 && verified === 0) {
    return {
      filterKey: 'incomplete',
      pendingCount: 0,
      allRequiredVerified: false,
      hasRejected: false,
    };
  }
  return {
    filterKey: 'pending',
    pendingCount: pending + missing,
    allRequiredVerified: false,
    hasRejected: false,
  };
}

function receiptStatus(
  documents: Array<{ slotCode: string; verificationStatus: string }>,
): string {
  return (
    documents.find((d) => d.slotCode === 'PAYMENT_RECEIPT')
      ?.verificationStatus ?? 'MISSING'
  );
}

function isReadyForDecision(
  app: {
    status: string;
    paymentStatus: string;
    formData: unknown;
    documents: Array<{ slotCode: string; verificationStatus: string }>;
  },
  settings?: SchoolCycleSettings | null,
): boolean {
  const status = app.status.toLowerCase();
  if (!['submitted', 'under_review'].includes(status)) return false;
  if (app.paymentStatus !== 'PAID') return false;
  if (receiptStatus(app.documents).toUpperCase() !== 'VERIFIED') return false;
  const rollup = documentRollupForApp(app.formData, app.documents, settings);
  return rollup.allRequiredVerified;
}

function parseOptionalDateTime(value: string | null | undefined): Date | null {
  if (value === undefined) return null;
  if (value === null || value.trim() === '') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException('Invalid date/time value');
  }
  return parsed;
}

@Injectable()
export class SchoolAdmissionsOfficeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cycles: AdmissionsCycleService,
  ) {}

  private listWhere(
    tenantId: string,
    query: SchoolOfficeListQueryDto,
  ): Prisma.AdmissionApplicationWhereInput {
    const filters: Prisma.AdmissionApplicationWhereInput[] = [];
    if (query.status) filters.push({ status: query.status });
    if (query.paymentStatus)
      filters.push({ paymentStatus: query.paymentStatus });
    if (query.search) {
      filters.push({
        OR: [
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
          { phone: { contains: query.search, mode: 'insensitive' } },
          {
            applicationNumber: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
        ],
      });
    }
    if (query.category && isSchoolCasteCategoryCode(query.category)) {
      filters.push({
        OR: [
          {
            formData: {
              path: ['child', 'category'],
              equals: query.category,
            },
          },
          {
            formData: {
              path: ['child', 'caste'],
              equals:
                schoolCasteCategoryPolicy(query.category)?.label ??
                query.category,
            },
          },
        ],
      });
    }
    return {
      tenantId,
      deletedAt: null,
      ...(filters.length ? { AND: filters } : {}),
    };
  }

  async list(tenantId: string, query: SchoolOfficeListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.listWhere(tenantId, query);
    const needsComputedFilter = Boolean(
      query.documentVerification || query.decisionQueue,
    );

    if (!needsComputedFilter) {
      const [total, data] = await this.prisma.$transaction([
        this.prisma.admissionApplication.count({ where }),
        this.prisma.admissionApplication.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          include: {
            documents: true,
            cycle: { select: { title: true, settings: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      return paginate(
        data.map((app) => this.mapListItem(app)),
        total,
        page,
        limit,
      );
    }

    const all = await this.prisma.admissionApplication.findMany({
      where,
      include: {
        documents: true,
        cycle: { select: { title: true, settings: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const filtered = all.filter((app) => {
      const settings = isSchoolCycleSettings(app.cycle?.settings)
        ? app.cycle.settings
        : null;
      if (query.documentVerification) {
        const rollup = documentRollupForApp(
          app.formData,
          app.documents,
          settings,
        );
        if (query.documentVerification === 'pending') {
          if (
            rollup.filterKey !== 'pending' &&
            rollup.filterKey !== 'incomplete'
          ) {
            return false;
          }
        } else if (rollup.filterKey !== query.documentVerification) {
          return false;
        }
      }
      if (query.decisionQueue) {
        if (query.decisionQueue === 'granted') return app.status === 'allotted';
        if (query.decisionQueue === 'not_granted')
          return app.status === 'rejected';
        if (query.decisionQueue === 'ready') {
          return isReadyForDecision(app, settings);
        }
      }
      return true;
    });

    const slice = filtered.slice((page - 1) * limit, page * limit);
    return paginate(
      slice.map((app) => this.mapListItem(app)),
      filtered.length,
      page,
      limit,
    );
  }

  private mapListItem(app: {
    id: string;
    applicationNumber: string | null;
    firstName: string;
    email: string;
    phone: string | null;
    status: string;
    paymentStatus: string;
    paymentReference: string | null;
    submittedAt: Date | null;
    createdAt: Date;
    formData: unknown;
    documents: Array<{
      slotCode: string;
      verificationStatus: string;
      fileUrl?: string | null;
      createdAt?: Date;
      sizeBytes?: number | null;
      remarks?: string | null;
    }>;
    cycle?: { title?: string | null; settings?: unknown } | null;
    [key: string]: unknown;
  }) {
    const { child, category } = categoryFromApplication(app.formData);
    const settings = isSchoolCycleSettings(app.cycle?.settings)
      ? app.cycle.settings
      : null;
    const certificateChecklist = buildCertificateChecklist(
      app.formData,
      app.documents,
      settings,
    );
    const documentRollup = documentRollupForApp(
      app.formData,
      app.documents,
      settings,
    );
    const father = asRecord(asRecord(app.formData).father);
    const office = asRecord(asRecord(app.formData).office);
    const payment = asRecord(asRecord(app.formData).payment);
    const submission = asRecord(asRecord(app.formData).submission);
    const { formData: _formData, cycle: _cycle, documents, ...publicApp } = app;
    return {
      ...publicApp,
      category: category?.code ?? null,
      categoryLabel: category?.label ?? null,
      community: text(child.community) || null,
      fatherName: text(father.fullName) || null,
      childName: text(child.fullName) || text(app.firstName) || null,
      certificateChecklist,
      documentRollup,
      receiptVerificationStatus: receiptStatus(app.documents),
      officeDecision: text(office.decision) || null,
      indexNumber: text(office.indexNumber) || null,
      paymentMeta: payment,
      applicationFee: settings?.applicationFee ?? 100,
      readyForDecision: isReadyForDecision(app, settings),
      /** True when a stored application PDF exists — never expose the storage path. */
      pdfAvailable: Boolean(text(submission.pdfFileUrl)),
      documents: documents.map((doc) => ({
        slotCode: doc.slotCode,
        verificationStatus: doc.verificationStatus,
        createdAt: doc.createdAt,
        sizeBytes: doc.sizeBytes ?? null,
        remarks: doc.remarks ?? null,
      })),
    };
  }

  async exportExcelReport(tenantId: string, query: SchoolOfficeListQueryDto) {
    const where = this.listWhere(tenantId, query);
    const applications = await this.prisma.admissionApplication.findMany({
      where,
      include: {
        documents: true,
        cycle: { select: { settings: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
    return buildSchoolKgAdmissionExcelReport({ applications });
  }

  async summary(tenantId: string) {
    const base = { tenantId, deletedAt: null } as const;
    const [
      total,
      draft,
      submitted,
      underReview,
      allotted,
      rejected,
      paid,
      pendingPayment,
    ] = await this.prisma.$transaction([
      this.prisma.admissionApplication.count({ where: base }),
      this.prisma.admissionApplication.count({
        where: { ...base, status: 'draft' },
      }),
      this.prisma.admissionApplication.count({
        where: { ...base, status: 'submitted' },
      }),
      this.prisma.admissionApplication.count({
        where: { ...base, status: 'under_review' },
      }),
      this.prisma.admissionApplication.count({
        where: { ...base, status: 'allotted' },
      }),
      this.prisma.admissionApplication.count({
        where: { ...base, status: 'rejected' },
      }),
      this.prisma.admissionApplication.count({
        where: { ...base, paymentStatus: 'PAID' },
      }),
      this.prisma.admissionApplication.count({
        where: { ...base, paymentStatus: { not: 'PAID' } },
      }),
    ]);

    const apps = await this.prisma.admissionApplication.findMany({
      where: base,
      include: { documents: true, cycle: { select: { settings: true } } },
    });
    const byCategory = Object.fromEntries(
      SCHOOL_CASTE_CATEGORY_POLICY.map((item) => [item.code, 0]),
    ) as Record<SchoolCasteCategoryCode, number>;
    let uncategorised = 0;
    let pendingPaymentVerification = 0;
    let verifiedPayments = 0;
    let rejectedPayments = 0;
    let pendingDocumentVerification = 0;
    let readyForDecision = 0;

    for (const app of apps) {
      const { category } = categoryFromApplication(app.formData);
      if (category) byCategory[category.code] += 1;
      else uncategorised += 1;

      const settings = isSchoolCycleSettings(app.cycle?.settings)
        ? app.cycle.settings
        : null;
      const receipt = receiptStatus(app.documents).toUpperCase();
      if (receipt === 'VERIFIED' || app.paymentStatus === 'PAID')
        verifiedPayments += 1;
      else if (receipt === 'REJECTED') rejectedPayments += 1;
      else if (receipt === 'PENDING') pendingPaymentVerification += 1;

      const rollup = documentRollupForApp(
        app.formData,
        app.documents,
        settings,
      );
      if (rollup.filterKey === 'pending' || rollup.filterKey === 'incomplete') {
        pendingDocumentVerification += 1;
      }
      if (isReadyForDecision(app, settings)) readyForDecision += 1;
    }

    const cycle = await this.loadCycleForSummary(tenantId);
    const fee = cycle?.settings?.applicationFee ?? 100;
    const applicationCount = cycle
      ? await this.prisma.admissionApplication.count({
          where: { tenantId, cycleId: cycle.id, deletedAt: null },
        })
      : total;
    const admissionWindow = evaluateSchoolAdmissionWindow({
      cycleStatus: cycle?.status,
      settings: cycle?.settings ?? null,
      registrationOpensAt: cycle?.registrationOpensAt,
      registrationClosesAt: cycle?.registrationClosesAt,
      currentApplicationCount: applicationCount,
    });

    return {
      total,
      draft,
      submitted,
      underReview,
      granted: allotted,
      notGranted: rejected,
      paid,
      pendingPayment,
      pendingPaymentVerification,
      verifiedPayments,
      rejectedPayments,
      pendingDocumentVerification,
      readyForDecision,
      applicationFee: fee,
      amountReceived: verifiedPayments * fee,
      amountPendingVerification: pendingPaymentVerification * fee,
      byCategory,
      uncategorised,
      admissionWindow: {
        status: admissionWindow.status,
        isOpen: admissionWindow.isOpen,
        newAdmissionsEnabled: admissionWindow.newAdmissionsEnabled,
        message: admissionWindow.message,
        lastDateLabel: admissionWindow.lastDateLabel,
        registrationOpensAt:
          admissionWindow.registrationOpensAt?.toISOString() ?? null,
        registrationClosesAt:
          admissionWindow.registrationClosesAt?.toISOString() ?? null,
        closedReason: admissionWindow.closedReason,
        maxOnlineApplications: admissionWindow.maxOnlineApplications,
        applicationCount: admissionWindow.applicationCount,
        seatsRemaining: admissionWindow.seatsRemaining,
      },
    };
  }

  private async loadCycleForSummary(tenantId: string) {
    try {
      return await this.requireSchoolCycle(tenantId);
    } catch {
      return null;
    }
  }

  async get(tenantId: string, applicationId: string) {
    const application = await this.prisma.admissionApplication.findFirst({
      where: { id: applicationId, tenantId, deletedAt: null },
      include: { documents: true, cycle: true },
    });
    if (!application || !isSchoolCycleSettings(application.cycle?.settings)) {
      throw new NotFoundException('Application not found');
    }

    const formData =
      (application.formData as Record<string, unknown> | null) ?? {};
    const child = asRecord(formData.child);
    const category = resolveSchoolCasteCategory(child);
    const age = evaluateSchoolAgeEligibility(
      text(child.dateOfBirth),
      application.cycle.settings.censusDate,
      application.cycle.settings.minAgeYears,
      application.cycle.settings.maxAgeYearsExclusive,
    );

    const certificateChecklist = buildCertificateChecklist(
      formData,
      application.documents,
      application.cycle.settings,
    );
    const submission = asRecord(formData.submission);

    return {
      application,
      age,
      settings: application.cycle.settings,
      category: category?.code ?? null,
      categoryLabel: category?.label ?? null,
      community: text(child.community) || null,
      certificateChecklist,
      submission: Object.keys(submission).length ? submission : null,
    };
  }

  async resetApplicantLoginPin(
    tenantId: string,
    applicationId: string,
    actorUserId: string,
  ) {
    const application = await this.prisma.admissionApplication.findFirst({
      where: { id: applicationId, tenantId, deletedAt: null },
      include: { applicantUser: true, cycle: true },
    });
    if (
      !application?.applicantUserId ||
      !application.applicantUser ||
      !isSchoolCycleSettings(application.cycle?.settings)
    ) {
      throw new NotFoundException('Application not found');
    }

    const pin = generateSchoolLoginPin();
    const passwordHash = await bcrypt.hash(pin, 12);
    await this.prisma.user.update({
      where: { id: application.applicantUserId },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        mustResetPassword: false,
      },
    });
    await this.cycles.audit(
      tenantId,
      application.cycleId,
      'application',
      application.id,
      'school.application.login_pin_reset',
      actorUserId,
    );

    return {
      applicationNumber: application.applicationNumber,
      pin,
      message:
        'Share this 6-digit PIN with the parent once. It is stored only as a hash.',
    };
  }

  async getCycleSettings(tenantId: string) {
    const cycle = await this.requireSchoolCycle(tenantId);
    const applicationCount = await this.prisma.admissionApplication.count({
      where: { tenantId, cycleId: cycle.id, deletedAt: null },
    });
    const window = evaluateSchoolAdmissionWindow({
      cycleStatus: cycle.status,
      settings: cycle.settings,
      registrationOpensAt: cycle.registrationOpensAt,
      registrationClosesAt: cycle.registrationClosesAt,
      currentApplicationCount: applicationCount,
    });
    return {
      cycleId: cycle.id,
      title: cycle.title,
      code: cycle.code,
      settings: cycle.settings,
      documentRequirements: normalizeSchoolDocumentRequirements(
        cycle.settings.documentRequirements,
      ),
      admissionWindow: {
        status: window.status,
        isOpen: window.isOpen,
        newAdmissionsEnabled: window.newAdmissionsEnabled,
        message: window.message,
        lastDateLabel: window.lastDateLabel,
        registrationOpensAt: window.registrationOpensAt?.toISOString() ?? null,
        registrationClosesAt:
          window.registrationClosesAt?.toISOString() ?? null,
        closedReason: window.closedReason,
        applicationDeadline: cycle.applicationDeadline?.toISOString() ?? null,
        maxOnlineApplications: window.maxOnlineApplications,
        applicationCount: window.applicationCount,
        seatsRemaining: window.seatsRemaining,
      },
    };
  }

  async getAdmissionWindow(tenantId: string) {
    return this.getCycleSettings(tenantId).then((s) => ({
      cycleId: s.cycleId,
      title: s.title,
      code: s.code,
      ...s.admissionWindow,
    }));
  }

  async updateAdmissionWindow(
    tenantId: string,
    actorId: string,
    dto: {
      newAdmissionsEnabled: boolean;
      registrationOpensAt?: string | null;
      registrationClosesAt?: string | null;
      maxOnlineApplications: number;
    },
  ) {
    const cycle = await this.requireSchoolCycle(tenantId);
    const maxOnlineApplications = schoolMaxOnlineApplications({
      maxOnlineApplications: dto.maxOnlineApplications,
    });
    const previous = {
      newAdmissionsEnabled: cycle.settings.newAdmissionsEnabled !== false,
      registrationOpensAt: cycle.registrationOpensAt?.toISOString() ?? null,
      registrationClosesAt: cycle.registrationClosesAt?.toISOString() ?? null,
      applicationDeadline: cycle.applicationDeadline?.toISOString() ?? null,
      maxOnlineApplications: schoolMaxOnlineApplications(cycle.settings),
    };

    const opensAt =
      dto.registrationOpensAt === undefined
        ? cycle.registrationOpensAt
        : parseOptionalDateTime(dto.registrationOpensAt);
    const closesAt =
      dto.registrationClosesAt === undefined
        ? cycle.registrationClosesAt
        : parseOptionalDateTime(dto.registrationClosesAt);
    if (opensAt && closesAt && closesAt < opensAt) {
      throw new BadRequestException(
        'Admission last date/time must be on or after the start date/time',
      );
    }

    const nextSettings: SchoolCycleSettings = {
      ...cycle.settings,
      newAdmissionsEnabled: dto.newAdmissionsEnabled,
      maxOnlineApplications,
    };

    await this.prisma.admissionCycle.update({
      where: { id: cycle.id },
      data: {
        settings: nextSettings as unknown as Prisma.InputJsonValue,
        registrationOpensAt: opensAt,
        registrationClosesAt: closesAt,
        // Keep application deadline aligned with last registration date so
        // first-time applicants cannot bypass the window via late submit paths.
        applicationDeadline: closesAt,
      },
    });

    const next = {
      newAdmissionsEnabled: dto.newAdmissionsEnabled,
      registrationOpensAt: opensAt?.toISOString() ?? null,
      registrationClosesAt: closesAt?.toISOString() ?? null,
      applicationDeadline: closesAt?.toISOString() ?? null,
      maxOnlineApplications,
    };

    await this.cycles.audit(
      tenantId,
      cycle.id,
      'cycle',
      cycle.id,
      'school.admission_window.updated',
      actorId,
      previous,
      next,
    );

    return this.getAdmissionWindow(tenantId);
  }

  async updateDocumentRequirements(
    tenantId: string,
    actorId: string,
    documentRequirements: unknown,
  ) {
    const cycle = await this.requireSchoolCycle(tenantId);
    const normalized =
      normalizeSchoolDocumentRequirements(documentRequirements);
    const nextSettings: SchoolCycleSettings = {
      ...cycle.settings,
      documentRequirements: normalized,
    };
    await this.prisma.admissionCycle.update({
      where: { id: cycle.id },
      data: { settings: nextSettings as unknown as Prisma.InputJsonValue },
    });
    await this.cycles.audit(
      tenantId,
      cycle.id,
      'cycle',
      cycle.id,
      'school.document_requirements.updated',
      actorId,
      null,
      { ruleCount: normalized.rules.length },
    );
    return {
      cycleId: cycle.id,
      documentRequirements: normalized,
      settings: nextSettings,
    };
  }

  private async requireSchoolCycle(tenantId: string) {
    const open = await this.prisma.admissionCycle.findFirst({
      where: { tenantId, status: 'OPEN', deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (open && isSchoolCycleSettings(open.settings)) {
      return { ...open, settings: open.settings };
    }
    const any = await this.prisma.admissionCycle.findFirst({
      where: { tenantId, deletedAt: null, status: { not: 'ARCHIVED' } },
      orderBy: { createdAt: 'desc' },
    });
    if (any && isSchoolCycleSettings(any.settings)) {
      return { ...any, settings: any.settings };
    }
    throw new NotFoundException('School admission cycle not found');
  }

  async verifyPayment(
    tenantId: string,
    applicationId: string,
    actorId: string,
    dto: { remarks?: string; paymentReference?: string },
  ) {
    const { application } = await this.get(tenantId, applicationId);
    const receipt = application.documents.find(
      (doc) => doc.slotCode === 'PAYMENT_RECEIPT',
    );
    if (!receipt) {
      throw new BadRequestException('No payment receipt has been uploaded');
    }

    await this.prisma.admissionApplicationDocument.update({
      where: { id: receipt.id },
      data: {
        verificationStatus: 'VERIFIED',
        verifiedById: actorId,
        verifiedAt: new Date(),
        remarks: dto.remarks ?? null,
      },
    });

    // Preserve applicant-entered bank UTR/transaction reference.
    // Never overwrite with the application number.
    const pickBankTxn = (value?: string | null) => {
      const trimmed = value?.trim() || '';
      if (!trimmed || trimmed === application.applicationNumber) return null;
      return trimmed;
    };
    const bankTxnRef =
      pickBankTxn(dto.paymentReference) ??
      pickBankTxn(application.paymentReference);

    const updated = await this.prisma.admissionApplication.update({
      where: { id: application.id },
      data: {
        paymentStatus: 'PAID',
        ...(bankTxnRef ? { paymentReference: bankTxnRef } : {}),
        status:
          application.status === 'submitted'
            ? 'under_review'
            : application.status,
      },
    });

    await this.cycles.audit(
      tenantId,
      application.cycleId,
      'application',
      application.id,
      'school.payment.verified',
      actorId,
    );

    return updated;
  }

  async rejectPayment(
    tenantId: string,
    applicationId: string,
    actorId: string,
    remarks: string,
  ) {
    const { application } = await this.get(tenantId, applicationId);
    const receipt = application.documents.find(
      (doc) => doc.slotCode === 'PAYMENT_RECEIPT',
    );
    if (!receipt) {
      throw new BadRequestException('No payment receipt has been uploaded');
    }

    await this.prisma.admissionApplicationDocument.update({
      where: { id: receipt.id },
      data: {
        verificationStatus: 'REJECTED',
        verifiedById: actorId,
        verifiedAt: new Date(),
        remarks,
      },
    });

    const formData =
      (application.formData as Record<string, unknown> | null) ?? {};
    const updated = await this.prisma.admissionApplication.update({
      where: { id: application.id },
      data: {
        paymentStatus: 'PENDING',
        status:
          application.status === 'allotted' ? application.status : 'draft',
        submittedAt:
          application.status === 'allotted' ? application.submittedAt : null,
        formData: {
          ...formData,
          payment: { rejected: true, remarks },
        } as Prisma.InputJsonValue,
      },
    });

    await this.cycles.audit(
      tenantId,
      application.cycleId,
      'application',
      application.id,
      'school.payment.rejected',
      actorId,
    );

    return updated;
  }

  async decide(
    tenantId: string,
    applicationId: string,
    actorId: string,
    dto: {
      decision: 'GRANTED' | 'NOT_GRANTED';
      indexNumber?: string;
      remarks?: string;
    },
  ) {
    const { application, age, certificateChecklist } = await this.get(
      tenantId,
      applicationId,
    );
    const formData =
      (application.formData as Record<string, unknown> | null) ?? {};
    const status = application.status.toLowerCase();
    const indexNumber = dto.indexNumber?.trim() || '';
    const remarks = dto.remarks?.trim() || '';

    if (dto.decision === 'NOT_GRANTED') {
      if (remarks.length < 3) {
        throw new BadRequestException(
          'Remarks are required when refusing admission',
        );
      }
    } else {
      if (!['submitted', 'under_review'].includes(status)) {
        throw new BadRequestException(
          'Only submitted applications can be granted admission',
        );
      }
      if (!age.eligible) {
        throw new BadRequestException(
          age.message || 'Applicant is not age-eligible for admission',
        );
      }
      const receipt = application.documents.find(
        (doc) => doc.slotCode === 'PAYMENT_RECEIPT',
      );
      if (
        application.paymentStatus !== 'PAID' ||
        receipt?.verificationStatus !== 'VERIFIED'
      ) {
        throw new BadRequestException(
          'Verify the admission fee payment before granting admission',
        );
      }
      const settings = isSchoolCycleSettings(application.cycle?.settings)
        ? application.cycle.settings
        : null;
      const rollup = documentRollupForApp(
        formData,
        application.documents,
        settings,
      );
      if (!rollup.allRequiredVerified) {
        throw new BadRequestException(
          'Verify all required documents before granting admission',
        );
      }
      // certificateChecklist used for audit context
      void certificateChecklist;
      if (!indexNumber) {
        throw new BadRequestException(
          'Index number is required when granting admission',
        );
      }
    }

    const previousOffice = asRecord(formData.office);
    const office = {
      ...previousOffice,
      decision: dto.decision,
      indexNumber:
        dto.decision === 'GRANTED'
          ? indexNumber
          : text(previousOffice.indexNumber) || undefined,
      remarks,
      ageYears: age.age?.years ?? null,
      ageMonths: age.age?.months ?? null,
      ageDays: age.age?.days ?? null,
      decidedAt: new Date().toISOString(),
    };

    const updated = await this.prisma.admissionApplication.update({
      where: { id: application.id },
      data: {
        status: dto.decision === 'GRANTED' ? 'allotted' : 'rejected',
        formData: { ...formData, office } as Prisma.InputJsonValue,
      },
    });

    await this.cycles.audit(
      tenantId,
      application.cycleId,
      'application',
      application.id,
      dto.decision === 'GRANTED'
        ? 'school.admission.granted'
        : 'school.admission.not_granted',
      actorId,
      null,
      { indexNumber: office.indexNumber, remarks },
    );

    return updated;
  }

  async verifyDocument(
    tenantId: string,
    applicationId: string,
    slotCode: string,
    actorId: string,
    dto: { remarks?: string },
  ) {
    if (slotCode === 'PAYMENT_RECEIPT') {
      throw new BadRequestException(
        'Use payment verification for the admission fee receipt',
      );
    }
    const { application } = await this.get(tenantId, applicationId);
    const doc = application.documents.find(
      (item) => item.slotCode === slotCode,
    );
    if (!doc) {
      throw new BadRequestException('Document has not been uploaded');
    }

    await this.prisma.admissionApplicationDocument.update({
      where: { id: doc.id },
      data: {
        verificationStatus: 'VERIFIED',
        verifiedById: actorId,
        verifiedAt: new Date(),
        remarks: dto.remarks ?? null,
      },
    });

    const formData =
      (application.formData as Record<string, unknown> | null) ?? {};
    const office = asRecord(formData.office);
    const history = Array.isArray(office.documentHistory)
      ? [...office.documentHistory]
      : [];
    history.push({
      slotCode,
      action: 'VERIFIED',
      remarks: dto.remarks ?? null,
      at: new Date().toISOString(),
      by: actorId,
    });
    await this.prisma.admissionApplication.update({
      where: { id: application.id },
      data: {
        formData: {
          ...formData,
          office: { ...office, documentHistory: history },
        } as Prisma.InputJsonValue,
        status:
          application.status === 'submitted'
            ? 'under_review'
            : application.status,
      },
    });

    await this.cycles.audit(
      tenantId,
      application.cycleId,
      'application',
      application.id,
      'school.document.verified',
      actorId,
      null,
      { slotCode, remarks: dto.remarks ?? null },
    );

    return this.get(tenantId, applicationId);
  }

  async rejectDocument(
    tenantId: string,
    applicationId: string,
    slotCode: string,
    actorId: string,
    remarks: string,
  ) {
    if (slotCode === 'PAYMENT_RECEIPT') {
      throw new BadRequestException(
        'Use payment rejection for the admission fee receipt',
      );
    }
    if (!remarks.trim()) {
      throw new BadRequestException('Rejection reason is required');
    }
    const { application } = await this.get(tenantId, applicationId);
    const doc = application.documents.find(
      (item) => item.slotCode === slotCode,
    );
    if (!doc) {
      throw new BadRequestException('Document has not been uploaded');
    }

    await this.prisma.admissionApplicationDocument.update({
      where: { id: doc.id },
      data: {
        verificationStatus: 'REJECTED',
        verifiedById: actorId,
        verifiedAt: new Date(),
        remarks: remarks.trim(),
      },
    });

    const formData =
      (application.formData as Record<string, unknown> | null) ?? {};
    const office = asRecord(formData.office);
    const history = Array.isArray(office.documentHistory)
      ? [...office.documentHistory]
      : [];
    history.push({
      slotCode,
      action: 'REJECTED',
      remarks: remarks.trim(),
      at: new Date().toISOString(),
      by: actorId,
    });
    await this.prisma.admissionApplication.update({
      where: { id: application.id },
      data: {
        formData: {
          ...formData,
          office: { ...office, documentHistory: history },
        } as Prisma.InputJsonValue,
      },
    });

    await this.cycles.audit(
      tenantId,
      application.cycleId,
      'application',
      application.id,
      'school.document.rejected',
      actorId,
      null,
      { slotCode, remarks: remarks.trim() },
    );

    return this.get(tenantId, applicationId);
  }
}
