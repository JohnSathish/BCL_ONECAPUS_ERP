import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CommunicationTriggerService } from '../communication/services/communication-trigger.service';
import {
  findMissingRequiredDocuments,
  formatMissingDocumentLabels,
} from './admissions-document.constants';
import { AdmissionsCycleService } from './admissions-cycle.service';

const TOTAL_STEPS = 7;

@Injectable()
export class AdmissionsFormService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cycles: AdmissionsCycleService,
    private readonly communication: CommunicationTriggerService,
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
    const application = await this.getApplicationForUser(tenantId, userId);
    this.assertEditable(application);

    const merged = {
      ...((application.formData as Record<string, unknown>) ?? {}),
      ...(dto.formData ?? {}),
    };

    const step = dto.currentStep ?? application.currentStep;
    const progress =
      dto.progressPercent ??
      Math.min(100, Math.round((step / TOTAL_STEPS) * 100));

    const subjectCodes = this.extractSubjectCodes(merged);

    const updated = await this.prisma.admissionApplication.update({
      where: { id: application.id },
      data: {
        formData: merged as Prisma.InputJsonValue,
        currentStep: step,
        progressPercent: progress,
        lastSavedAt: new Date(),
        ...subjectCodes,
        ...(merged.personal && typeof merged.personal === 'object'
          ? (() => {
              const personal = merged.personal as {
                fullName?: string;
                firstName?: string;
                lastName?: string;
                phone?: string;
              };
              const fullName =
                personal.fullName?.trim() ||
                [personal.firstName, personal.lastName]
                  .filter(Boolean)
                  .join(' ')
                  .trim();
              return {
                firstName: fullName || application.firstName,
                lastName: fullName
                  ? ''
                  : (personal.lastName ?? application.lastName),
                phone: personal.phone ?? application.phone,
              };
            })()
          : {}),
      },
    });

    return updated;
  }

  async submit(tenantId: string, userId: string) {
    const application = await this.getApplicationForUser(tenantId, userId);
    this.assertEditable(application);

    if (application.progressPercent < 85) {
      throw new BadRequestException(
        'Complete all form sections before submitting',
      );
    }

    const cycle = application.cycle;
    if (!cycle)
      throw new BadRequestException('Application is not linked to a cycle');
    if (cycle.applicationDeadline && cycle.applicationDeadline < new Date()) {
      throw new BadRequestException('Application deadline has passed');
    }

    if (!this.isPaymentSatisfied(application)) {
      throw new BadRequestException(
        'Application fee must be paid before submitting. Pay online on the Payments page or at the college office.',
      );
    }

    const formData = (application.formData as Record<string, unknown>) ?? {};
    const missingDocs = await this.getMissingRequiredDocuments(
      application.id,
      formData,
    );
    if (missingDocs.length) {
      throw new BadRequestException(
        `Upload required documents before submitting: ${formatMissingDocumentLabels(missingDocs)}`,
      );
    }

    const majorCode = application.majorSubjectCode;
    let programId = application.programId;

    if (majorCode && !programId) {
      const program = await this.prisma.program.findFirst({
        where: {
          tenantId,
          deletedAt: null,
          code: majorCode,
        },
      });
      if (program) programId = program.id;
    }

    let intakeId = application.intakeId;
    if (programId && !intakeId && cycle.id) {
      const intake = await this.prisma.admissionIntake.findFirst({
        where: { cycleId: cycle.id, programId, deletedAt: null },
      });
      if (intake) intakeId = intake.id;
    }

    const meritScore = this.computeMeritScore(formData, cycle.settings);

    const updated = await this.prisma.admissionApplication.update({
      where: { id: application.id },
      data: {
        status: 'submitted',
        submittedAt: new Date(),
        progressPercent: 100,
        programId,
        intakeId,
        meritScore,
      },
      include: { cycle: true, program: true },
    });

    await this.cycles.audit(
      tenantId,
      cycle.id,
      'application',
      application.id,
      'application.submitted',
      userId,
    );

    void this.notifySubmitted(tenantId, updated);
    return updated;
  }

  private async getMissingRequiredDocuments(
    applicationId: string,
    formData: Record<string, unknown>,
  ) {
    const documents = await this.prisma.admissionApplicationDocument.findMany({
      where: { applicationId },
      select: { slotCode: true },
    });
    return findMissingRequiredDocuments(
      documents.map((doc) => doc.slotCode),
      formData,
    );
  }

  private isPaymentSatisfied(application: {
    paymentStatus: string;
    cycle?: { settings: unknown } | null;
  }) {
    const settings = application.cycle?.settings as
      | { requirePaymentBeforeSubmit?: boolean }
      | null
      | undefined;
    if (settings?.requirePaymentBeforeSubmit === false) {
      return true;
    }
    return ['PAID', 'WAIVED'].includes(application.paymentStatus);
  }

  private computeMeritScore(
    formData: Record<string, unknown>,
    settings: unknown,
  ): number {
    const rules = (
      settings as {
        meritRules?: { class12Weight?: number; cuetWeight?: number };
      }
    )?.meritRules;
    const class12Weight = rules?.class12Weight ?? 1;
    const cuetWeight = rules?.cuetWeight ?? 0;

    const academic = formData.academic as
      | { class12Percentage?: number; cuetScore?: number }
      | undefined;
    const class12 = academic?.class12Percentage ?? 0;
    const cuet = academic?.cuetScore ?? 0;

    return Number((class12 * class12Weight + cuet * cuetWeight).toFixed(2));
  }

  private extractSubjectCodes(formData: Record<string, unknown>) {
    const prefs = formData.coursePreferences as
      | {
          majorCode?: string;
          minorCode?: string;
          mdcCode?: string;
          aecCode?: string;
          secCode?: string;
          vacCode?: string;
          shiftId?: string;
        }
      | undefined;

    return {
      majorSubjectCode: prefs?.majorCode || null,
      minorSubjectCode: prefs?.minorCode || null,
      mdcSubjectCode: prefs?.mdcCode || null,
      aecSubjectCode: prefs?.aecCode || null,
      secSubjectCode: prefs?.secCode || null,
      vacSubjectCode: prefs?.vacCode || null,
      preferredShiftId: prefs?.shiftId?.trim() ? prefs.shiftId.trim() : null,
    };
  }

  private async getApplicationForUser(tenantId: string, userId: string) {
    const application = await this.prisma.admissionApplication.findFirst({
      where: { tenantId, applicantUserId: userId, deletedAt: null },
      include: { cycle: true },
    });
    if (!application) throw new NotFoundException('Application not found');
    return application;
  }

  private assertEditable(application: {
    status: string;
    cycle?: { status: string } | null;
  }) {
    if (application.cycle?.status === 'ARCHIVED') {
      throw new BadRequestException(
        'This application is archived and read-only',
      );
    }
    if (
      [
        'submitted',
        'under_review',
        'shortlisted',
        'allotted',
        'rejected',
      ].includes(application.status)
    ) {
      throw new BadRequestException('Application has already been submitted');
    }
  }

  private async notifySubmitted(
    tenantId: string,
    application: {
      id: string;
      applicationNumber: string;
      firstName: string;
      lastName: string;
      email: string;
      program?: { name: string } | null;
    },
  ) {
    const institutionName =
      await this.communication.getInstitutionName(tenantId);
    await this.communication.trigger({
      tenantId,
      templateCode: 'APPLICATION_SUBMITTED',
      triggerKey: 'admission.application_submitted',
      entityType: 'admission_application',
      entityId: application.id,
      recipient: {
        recipientType: 'USER',
        displayName: `${application.firstName} ${application.lastName}`.trim(),
        email: application.email,
      },
      variables: {
        student_name: `${application.firstName} ${application.lastName}`.trim(),
        application_number: application.applicationNumber,
        program_name: application.program?.name ?? 'FYUP Semester 1',
        institution_name: institutionName,
      },
    });
  }
}
