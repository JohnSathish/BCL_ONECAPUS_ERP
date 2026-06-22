import { Injectable, Logger } from '@nestjs/common';
import { CommunicationTriggerService } from '../../communication/services/communication-trigger.service';
import type { ResolvedRecipient } from '../../communication/services/communication-audience.service';

type Applicant = {
  id: string;
  fullName: string;
  email?: string | null;
  mobile?: string | null;
  applicationNo?: string | null;
  vacancy?: { title?: string } | null;
};

@Injectable()
export class RecruitmentNotificationService {
  private readonly logger = new Logger(RecruitmentNotificationService.name);

  constructor(private readonly triggers: CommunicationTriggerService) {}

  private applicantRecipient(app: Applicant): ResolvedRecipient {
    return {
      recipientType: 'USER',
      displayName: app.fullName,
      email: app.email ?? undefined,
      phone: app.mobile ?? undefined,
    };
  }

  private async fire(
    tenantId: string,
    templateCode: string,
    triggerKey: string,
    entityId: string,
    app: Applicant,
    variables: Record<string, string>,
    channels: ('EMAIL' | 'WHATSAPP' | 'SMS' | 'IN_APP')[] = [
      'EMAIL',
      'WHATSAPP',
    ],
    options?: { entityType?: string; skipDedupe?: boolean },
  ) {
    if (!app.email && !app.mobile) return;
    try {
      const institutionName = await this.triggers.getInstitutionName(tenantId);
      await this.triggers.trigger({
        tenantId,
        templateCode,
        triggerKey,
        entityType: options?.entityType ?? 'recruitment_application',
        entityId,
        recipient: this.applicantRecipient(app),
        variables: {
          candidate_name: app.fullName,
          application_no: app.applicationNo ?? '',
          vacancy_title: app.vacancy?.title ?? '',
          institution_name: institutionName,
          ...variables,
        },
        channels,
        skipDedupe: options?.skipDedupe,
      });
    } catch (err) {
      this.logger.warn(
        `Recruitment notify ${triggerKey} failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  applicationReceived(tenantId: string, app: Applicant) {
    return this.fire(
      tenantId,
      'RECRUITMENT_APPLICATION_RECEIVED',
      'recruitment.application_received',
      app.id,
      app,
      {},
    );
  }

  hrNewApplication(tenantId: string, app: Applicant, hrEmail?: string | null) {
    const email =
      hrEmail?.trim() ||
      process.env.CAREERS_HR_EMAIL?.trim() ||
      'career@donboscocollege.ac.in';
    return this.fire(
      tenantId,
      'RECRUITMENT_HR_NEW_APPLICATION',
      `recruitment.hr_new_application.${app.id}`,
      app.id,
      {
        ...app,
        fullName: 'Recruitment Office',
        email,
        mobile: undefined,
      },
      {
        candidate_name: app.fullName,
        candidate_mobile: app.mobile ?? '',
        candidate_email: app.email ?? '',
      },
      ['EMAIL'],
      { skipDedupe: true },
    );
  }

  statusUpdated(tenantId: string, app: Applicant, status: string) {
    const labels: Record<string, string> = {
      UNDER_REVIEW: 'Under Review',
      SHORTLISTED: 'Shortlisted',
      INTERVIEW: 'Interview Scheduled',
      WAITING_LIST: 'Waiting List',
      SELECTED: 'Selected',
      OFFERED: 'Offer Extended',
      REJECTED: 'Not Selected',
      HIRED: 'Hired',
      APPOINTED: 'Appointed',
    };
    return this.fire(
      tenantId,
      'RECRUITMENT_STATUS_UPDATE',
      `recruitment.status.${status}.${app.id}`,
      app.id,
      app,
      { status_label: labels[status] ?? status.replace(/_/g, ' ') },
    );
  }

  interviewScheduled(
    tenantId: string,
    app: Applicant,
    interview: { scheduledAt: Date; venue?: string | null },
  ) {
    return this.fire(
      tenantId,
      'RECRUITMENT_INTERVIEW_CALL',
      'recruitment.interview_scheduled',
      app.id,
      app,
      {
        interview_date: interview.scheduledAt.toLocaleString('en-IN'),
        interview_venue: interview.venue ?? 'To be announced',
      },
    );
  }

  selected(tenantId: string, app: Applicant) {
    return this.fire(
      tenantId,
      'RECRUITMENT_SELECTED',
      'recruitment.selected',
      app.id,
      app,
      {},
    );
  }

  rejected(tenantId: string, app: Applicant, reason?: string) {
    return this.fire(
      tenantId,
      'RECRUITMENT_REJECTED',
      'recruitment.rejected',
      app.id,
      app,
      { rejection_reason: reason ?? 'Not specified' },
    );
  }

  interviewReminder(
    tenantId: string,
    interviewId: string,
    app: Applicant,
    interview: { scheduledAt: Date; venue?: string | null },
  ) {
    return this.fire(
      tenantId,
      'RECRUITMENT_INTERVIEW_REMINDER',
      'recruitment.interview_reminder',
      interviewId,
      app,
      {
        interview_date: interview.scheduledAt.toLocaleString('en-IN'),
        interview_venue: interview.venue ?? 'To be announced',
      },
      ['EMAIL', 'WHATSAPP'],
      { entityType: 'recruitment_interview' },
    );
  }

  documentsPending(tenantId: string, app: Applicant, message?: string) {
    return this.fire(
      tenantId,
      'RECRUITMENT_DOCUMENTS_PENDING',
      `recruitment.documents_pending.${Date.now()}`,
      app.id,
      app,
      {
        document_message:
          message ??
          'Please submit originals and photocopies of your certificates, experience proofs, and identity documents at the HR office.',
      },
      ['EMAIL', 'WHATSAPP'],
      { skipDedupe: true },
    );
  }

  joiningReminder(
    tenantId: string,
    orderId: string,
    app: Applicant,
    joiningDate: Date,
  ) {
    return this.fire(
      tenantId,
      'RECRUITMENT_JOINING_REMINDER',
      'recruitment.joining_reminder',
      orderId,
      app,
      {
        joining_date: joiningDate.toLocaleDateString('en-IN'),
      },
      ['EMAIL', 'WHATSAPP'],
      { entityType: 'appointment_order' },
    );
  }

  appointmentOrderSent(
    tenantId: string,
    orderId: string,
    app: Applicant,
    order: { orderNo?: string | null; joiningDate?: Date | null },
  ) {
    return this.fire(
      tenantId,
      'RECRUITMENT_APPOINTMENT_SENT',
      'recruitment.appointment_sent',
      orderId,
      app,
      {
        order_no: order.orderNo ?? 'Pending',
        joining_date: order.joiningDate
          ? order.joiningDate.toLocaleDateString('en-IN')
          : 'To be confirmed',
      },
      ['EMAIL', 'WHATSAPP'],
      { entityType: 'appointment_order' },
    );
  }
}
