import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AdmissionsCycleService } from '../admissions/admissions-cycle.service';
import {
  formatSchoolDocumentLabels,
  getSchoolFormGaps,
  isSchoolCycleSettings,
  requiredSchoolDocumentCodes,
  evaluateSchoolAgeEligibility,
} from './school-admission.constants';
import { applySchoolCasteCategoryToChild } from './school-admission-category';
import { normalizeSchoolAddressPins } from './school-address-pin';
import {
  isSchoolPaymentTxnSameAsApplicationNumber,
  isValidSchoolPaymentTransactionRef,
  normalizeSchoolPaymentTransactionRef,
} from './school-payment-transaction-ref';
import { SchoolAdmissionsMailService } from './school-admissions-mail.service';
import {
  SchoolAdmissionsPdfService,
  type SchoolSubmissionMeta,
} from './school-admissions-pdf.service';

@Injectable()
export class SchoolAdmissionsFormService {
  private readonly logger = new Logger(SchoolAdmissionsFormService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cycles: AdmissionsCycleService,
    private readonly pdf: SchoolAdmissionsPdfService,
    private readonly mail: SchoolAdmissionsMailService,
  ) {}

  async saveDraft(
    tenantId: string,
    userId: string,
    dto: {
      currentStep?: number;
      formData?: Record<string, unknown>;
      progressPercent?: number;
    },
  ) {
    const application = await this.getEditableApplication(tenantId, userId);
    let merged = {
      ...((application.formData as Record<string, unknown>) ?? {}),
      ...(dto.formData ?? {}),
    };
    merged = normalizeSchoolAddressPins(merged);
    const childInput = (merged.child ?? {}) as Record<string, unknown>;
    try {
      merged.child = applySchoolCasteCategoryToChild(childInput);
    } catch {
      throw new BadRequestException(
        'Select a valid Caste / Category from the list. Typed values are not accepted.',
      );
    }
    const settings = isSchoolCycleSettings(application.cycle?.settings)
      ? application.cycle.settings
      : null;
    const child = (merged.child ?? {}) as {
      fullName?: string;
      dateOfBirth?: string;
    };
    if (settings && child.dateOfBirth?.trim()) {
      const age = evaluateSchoolAgeEligibility(
        child.dateOfBirth.trim(),
        settings.censusDate,
        settings.minAgeYears,
        settings.maxAgeYearsExclusive,
      );
      if (!age.eligible) {
        throw new BadRequestException(age.message);
      }
    }
    const fullName = child.fullName?.trim().toUpperCase();
    const gaps = getSchoolFormGaps(merged, settings);
    const progress =
      dto.progressPercent ??
      Math.min(100, Math.round(((8 - Math.min(gaps.length, 8)) / 8) * 100));

    return this.prisma.admissionApplication.update({
      where: { id: application.id },
      data: {
        formData: merged as Prisma.InputJsonValue,
        currentStep: dto.currentStep ?? application.currentStep,
        progressPercent: progress,
        lastSavedAt: new Date(),
        ...(fullName ? { firstName: fullName, lastName: '' } : {}),
      },
    });
  }

  /**
   * Saves the bank Transaction / UTR / Reference Number (not the application number).
   * Stored on AdmissionApplication.paymentReference.
   */
  async savePaymentTransactionReference(
    tenantId: string,
    userId: string,
    rawReference: string,
  ) {
    const application = await this.prisma.admissionApplication.findFirst({
      where: { tenantId, applicantUserId: userId, deletedAt: null },
      include: {
        cycle: true,
        documents: {
          where: { slotCode: 'PAYMENT_RECEIPT' },
          select: { verificationStatus: true },
        },
      },
    });
    if (!application) throw new NotFoundException('Application not found');
    if (!isSchoolCycleSettings(application.cycle?.settings)) {
      throw new BadRequestException('School admission cycle is not active');
    }
    if (application.cycle?.status === 'ARCHIVED') {
      throw new BadRequestException('This admission cycle is read-only');
    }

    const receiptStatus = application.documents[0]?.verificationStatus ?? null;
    const canEdit =
      application.status === 'draft' ||
      (['submitted', 'under_review'].includes(application.status) &&
        receiptStatus === 'REJECTED');
    if (!canEdit) {
      throw new BadRequestException(
        'This application has already been submitted and can no longer be edited. Contact the school office if a correction is required.',
      );
    }

    const normalized = normalizeSchoolPaymentTransactionRef(rawReference);
    if (!isValidSchoolPaymentTransactionRef(normalized)) {
      throw new BadRequestException(
        'Enter a valid bank transaction / UTR / reference number (4–100 characters).',
      );
    }
    if (
      isSchoolPaymentTxnSameAsApplicationNumber(
        normalized,
        application.applicationNumber,
      )
    ) {
      throw new BadRequestException(
        'Do not enter your application number here. Enter the transaction / UTR / reference number from your bank receipt.',
      );
    }

    const duplicate = await this.prisma.admissionApplication.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        paymentReference: { equals: normalized, mode: 'insensitive' },
        NOT: { id: application.id },
      },
      select: { id: true, applicationNumber: true },
    });
    if (duplicate) {
      throw new BadRequestException(
        'This payment transaction / UTR / reference number is already used on another application.',
      );
    }

    const formData = {
      ...((application.formData as Record<string, unknown> | null) ?? {}),
    };
    const payment = {
      ...((formData.payment &&
      typeof formData.payment === 'object' &&
      !Array.isArray(formData.payment)
        ? formData.payment
        : {}) as Record<string, unknown>),
      transactionReference: normalized,
      transferMentionReference: application.applicationNumber,
      amount: isSchoolCycleSettings(application.cycle?.settings)
        ? application.cycle.settings.applicationFee
        : undefined,
      updatedAt: new Date().toISOString(),
    };
    formData.payment = payment;

    return this.prisma.admissionApplication.update({
      where: { id: application.id },
      data: {
        paymentReference: normalized,
        formData: formData as Prisma.InputJsonValue,
        lastSavedAt: new Date(),
      },
    });
  }

  async submit(tenantId: string, userId: string) {
    const application = await this.getEditableApplication(tenantId, userId);
    const cycle = application.cycle;
    if (!cycle || !isSchoolCycleSettings(cycle.settings)) {
      throw new BadRequestException('School admission cycle is not active');
    }
    if (cycle.applicationDeadline && cycle.applicationDeadline < new Date()) {
      throw new BadRequestException('Application deadline has passed');
    }

    const formData =
      (application.formData as Record<string, unknown> | null) ?? {};
    const gaps = getSchoolFormGaps(formData, cycle.settings);
    if (gaps.length) {
      throw new BadRequestException(
        `Complete the application form before submitting: ${gaps.join(', ')}`,
      );
    }

    const documents = await this.prisma.admissionApplicationDocument.findMany({
      where: { applicationId: application.id },
      select: { slotCode: true },
    });
    const uploaded = new Set(documents.map((doc) => doc.slotCode));
    const missing = requiredSchoolDocumentCodes(
      formData,
      true,
      cycle.settings.documentRequirements,
    ).filter((code) => !uploaded.has(code));
    if (missing.length) {
      throw new BadRequestException(
        `Upload required documents and payment receipt before submitting: ${formatSchoolDocumentLabels(missing, formData, cycle.settings.documentRequirements)}`,
      );
    }

    if (
      cycle.settings.requirePaymentProofBeforeSubmit &&
      !uploaded.has('PAYMENT_RECEIPT')
    ) {
      throw new BadRequestException(
        'Upload the admission fee payment receipt before submitting',
      );
    }

    const paymentTxn = normalizeSchoolPaymentTransactionRef(
      application.paymentReference ?? '',
    );
    if (!isValidSchoolPaymentTransactionRef(paymentTxn)) {
      throw new BadRequestException(
        'Enter your bank transaction / UTR / reference number on the Fee & Receipt step before submitting',
      );
    }
    if (
      isSchoolPaymentTxnSameAsApplicationNumber(
        paymentTxn,
        application.applicationNumber,
      )
    ) {
      throw new BadRequestException(
        'Payment reference must be the bank transaction / UTR number, not your application number',
      );
    }

    const program = await this.prisma.admissionCycleProgram.findFirst({
      where: { cycleId: cycle.id, enabled: true },
    });
    const intake = program
      ? await this.prisma.admissionIntake.findFirst({
          where: {
            cycleId: cycle.id,
            programId: program.programId,
            deletedAt: null,
          },
        })
      : null;

    const submittedAt = new Date();
    const updated = await this.prisma.admissionApplication.update({
      where: { id: application.id },
      data: {
        status: 'submitted',
        submittedAt,
        progressPercent: 100,
        programId: program?.programId ?? application.programId,
        intakeId: intake?.id ?? application.intakeId,
      },
    });

    await this.cycles.audit(
      tenantId,
      cycle.id,
      'application',
      application.id,
      'school.application.submitted',
      userId,
      null,
      { submittedAt: submittedAt.toISOString() },
    );

    const submission = await this.finalizeSubmissionArtifacts(
      tenantId,
      application.id,
      userId,
    );

    return {
      ...updated,
      submission,
    };
  }

  async resendSubmissionEmail(
    tenantId: string,
    applicationId: string,
    actorId: string,
  ) {
    const application = await this.prisma.admissionApplication.findFirst({
      where: { id: applicationId, tenantId, deletedAt: null },
      include: { cycle: true },
    });
    if (!application) throw new NotFoundException('Application not found');
    if (
      ![
        'submitted',
        'under_review',
        'allotted',
        'rejected',
        'shortlisted',
      ].includes(application.status)
    ) {
      throw new BadRequestException('Application has not been submitted yet');
    }

    const pdf = await this.pdf.getStoredPdfForOffice(tenantId, applicationId);
    const branding = await this.prisma.tenantBranding.findUnique({
      where: { tenantId },
    });
    const schoolName =
      branding?.displayName?.trim() || 'Tura Public School, Tura';
    const child = ((application.formData as Record<string, unknown>)?.child ??
      {}) as Record<string, unknown>;
    const childName =
      (typeof child.fullName === 'string' && child.fullName.trim()) ||
      application.firstName;

    const sent = await this.mail.sendSubmissionPdf({
      to: application.email,
      schoolName,
      childName,
      applicationNumber: application.applicationNumber,
      submissionDate: application.submittedAt
        ? application.submittedAt.toLocaleString('en-IN')
        : new Date().toLocaleString('en-IN'),
      pdfBuffer: pdf.buffer,
      pdfFilename: pdf.filename,
    });

    const formData = {
      ...((application.formData as Record<string, unknown>) ?? {}),
    };
    const meta: SchoolSubmissionMeta = {
      ...this.pdf.readSubmissionMeta(formData),
      pdfFileUrl: pdf.pdfFileUrl,
      email: {
        status: sent.ok ? 'SENT' : 'FAILED',
        sentAt: sent.ok ? new Date().toISOString() : null,
        error: sent.ok ? null : (sent.error ?? 'Email send failed'),
        providerRef: sent.ok ? (sent.providerRef ?? null) : null,
        lastAttemptAt: new Date().toISOString(),
      },
    };
    formData.submission = meta as unknown as Record<string, unknown>;
    await this.prisma.admissionApplication.update({
      where: { id: application.id },
      data: { formData: formData as Prisma.InputJsonValue },
    });

    await this.cycles.audit(
      tenantId,
      application.cycleId,
      'application',
      application.id,
      sent.ok
        ? 'school.application.pdf_email_resent'
        : 'school.application.pdf_email_resend_failed',
      actorId,
      null,
      { emailStatus: meta.email?.status, error: meta.email?.error ?? null },
    );

    return {
      ok: sent.ok,
      email: meta.email,
      error: sent.ok ? null : sent.error,
    };
  }

  private async finalizeSubmissionArtifacts(
    tenantId: string,
    applicationId: string,
    userId: string,
  ) {
    let pdfResult: {
      buffer: Buffer;
      filename: string;
      pdfFileUrl: string;
      meta: SchoolSubmissionMeta;
    } | null = null;
    let pdfError: string | null = null;

    try {
      pdfResult = await this.pdf.generateAndStoreForApplication(
        tenantId,
        applicationId,
      );
    } catch (err) {
      pdfError = err instanceof Error ? err.message : 'PDF generation failed';
      this.logger.error(
        `PDF generation failed for ${applicationId}: ${pdfError}`,
      );
      const application = await this.prisma.admissionApplication.findFirst({
        where: { id: applicationId, tenantId },
      });
      if (application) {
        const formData = {
          ...((application.formData as Record<string, unknown>) ?? {}),
        };
        const meta: SchoolSubmissionMeta = {
          ...this.pdf.readSubmissionMeta(formData),
          pdfError,
        };
        formData.submission = meta as unknown as Record<string, unknown>;
        await this.prisma.admissionApplication.update({
          where: { id: applicationId },
          data: { formData: formData as Prisma.InputJsonValue },
        });
      }
    }

    const application = await this.prisma.admissionApplication.findFirst({
      where: { id: applicationId, tenantId },
    });
    if (!application) {
      return { pdfReady: false, emailStatus: 'FAILED' as const, pdfError };
    }

    const branding = await this.prisma.tenantBranding.findUnique({
      where: { tenantId },
    });
    const schoolName =
      branding?.displayName?.trim() || 'Tura Public School, Tura';
    const child = ((application.formData as Record<string, unknown>)?.child ??
      {}) as Record<string, unknown>;
    const childName =
      (typeof child.fullName === 'string' && child.fullName.trim()) ||
      application.firstName;

    let emailMeta: SchoolSubmissionMeta['email'] = {
      status: 'PENDING',
      lastAttemptAt: new Date().toISOString(),
    };

    if (pdfResult) {
      const sent = await this.mail.sendSubmissionPdf({
        to: application.email,
        schoolName,
        childName,
        applicationNumber: application.applicationNumber,
        submissionDate: application.submittedAt
          ? application.submittedAt.toLocaleString('en-IN')
          : new Date().toLocaleString('en-IN'),
        pdfBuffer: pdfResult.buffer,
        pdfFilename: pdfResult.filename,
      });
      emailMeta = {
        status: sent.ok ? 'SENT' : 'FAILED',
        sentAt: sent.ok ? new Date().toISOString() : null,
        error: sent.ok ? null : (sent.error ?? 'Email send failed'),
        providerRef: sent.ok ? (sent.providerRef ?? null) : null,
        lastAttemptAt: new Date().toISOString(),
      };
      if (!sent.ok) {
        this.logger.warn(
          `Submission email failed for ${application.applicationNumber}: ${sent.error}`,
        );
      }
    } else {
      emailMeta = {
        status: 'FAILED',
        error: pdfError || 'PDF was not generated; email not sent',
        lastAttemptAt: new Date().toISOString(),
      };
    }

    const formData = {
      ...((application.formData as Record<string, unknown>) ?? {}),
    };
    const meta: SchoolSubmissionMeta = {
      ...this.pdf.readSubmissionMeta(formData),
      ...(pdfResult
        ? {
            pdfFileUrl: pdfResult.pdfFileUrl,
            pdfGeneratedAt: new Date().toISOString(),
            pdfError: null,
            pdfPackageVersion: pdfResult.meta.pdfPackageVersion,
          }
        : { pdfError }),
      email: emailMeta,
    };
    formData.submission = meta as unknown as Record<string, unknown>;
    await this.prisma.admissionApplication.update({
      where: { id: applicationId },
      data: { formData: formData as Prisma.InputJsonValue },
    });

    await this.cycles.audit(
      tenantId,
      application.cycleId,
      'application',
      applicationId,
      pdfResult
        ? 'school.application.pdf_generated'
        : 'school.application.pdf_failed',
      userId,
      null,
      {
        pdfFileUrl: meta.pdfFileUrl ?? null,
        emailStatus: emailMeta.status,
        emailError: emailMeta.error ?? null,
      },
    );

    return {
      pdfReady: Boolean(pdfResult),
      pdfFileUrl: meta.pdfFileUrl ?? null,
      emailStatus: emailMeta.status,
      emailError: emailMeta.error ?? null,
      pdfError,
    };
  }

  private async getEditableApplication(tenantId: string, userId: string) {
    const application = await this.prisma.admissionApplication.findFirst({
      where: { tenantId, applicantUserId: userId, deletedAt: null },
      include: { cycle: true },
    });
    if (!application) throw new NotFoundException('Application not found');
    if (!isSchoolCycleSettings(application.cycle?.settings)) {
      throw new BadRequestException('School admission cycle is not active');
    }
    if (application.cycle?.status === 'ARCHIVED') {
      throw new BadRequestException('This admission cycle is read-only');
    }
    if (!['draft'].includes(application.status)) {
      throw new BadRequestException(
        'This application has already been submitted and can no longer be edited. Contact the school office if a correction is required.',
      );
    }
    return application;
  }
}
