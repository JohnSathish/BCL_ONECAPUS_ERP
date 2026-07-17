import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { CertificateDocumentService } from '../../certificates/certificate-document.service';
import { CertificateVariableService } from '../../certificates/certificate-variable.service';
import { CommunicationTriggerService } from '../../communication/services/communication-trigger.service';
import { academicYearLabel } from '../../governance/constants/governance.constants';
import { NaacEvidenceService } from '../../naac-iqac/services/naac-evidence.service';
import {
  COMPETITION_POSITIONS,
  DEPARTMENT_ACTIVITY_TYPES,
  isCompetitionActivityType,
  positionCertificateType,
  positionLabel,
  type CompetitionPosition,
} from '../domain/activity-types';
import type {
  AddMediaDto,
  ReviewPresentationDto,
  SubmitPresentationDto,
  UpsertActivityReportDto,
  UpsertResultsDto,
} from '../dto/department-activities.dto';
import { DepartmentActivitiesService } from './department-activities.service';

const ACTIVE_REGISTRATION = 'REGISTERED';

const AWARD_POSITIONS = new Set<string>(COMPETITION_POSITIONS);

const CALENDAR_STATUSES = ['APPROVED', 'OPEN', 'CLOSED', 'COMPLETED'] as const;

@Injectable()
export class DepartmentActivitiesPhase2Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly variables: CertificateVariableService,
    private readonly documents: CertificateDocumentService,
    private readonly activities: DepartmentActivitiesService,
    @Optional() private readonly communication?: CommunicationTriggerService,
    @Optional() private readonly naacEvidence?: NaacEvidenceService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  private hasPermission(user: JwtUser, slug: string) {
    return user.permissions?.includes(slug) ?? false;
  }

  private requireManage(user: JwtUser) {
    if (!this.hasPermission(user, 'department-activities:manage')) {
      throw new ForbiddenException('Manage permission required.');
    }
  }

  private isAwardPosition(position: string) {
    return AWARD_POSITIONS.has(position);
  }

  private activityTypeLabel(code: string) {
    return (
      DEPARTMENT_ACTIVITY_TYPES.find((t) => t.code === code)?.label ?? code
    );
  }

  private formatEventDate(date: Date) {
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  private buildReportWhere(
    user: JwtUser,
    query: { departmentId?: string; from?: string; to?: string } = {},
  ) {
    const where: Record<string, unknown> = {
      tenantId: user.tid,
      deletedAt: null,
    };

    if (query.departmentId) {
      where.departmentId = query.departmentId;
    }

    if (query.from || query.to) {
      const eventDate: Record<string, Date> = {};
      if (query.from) {
        eventDate.gte = new Date(query.from);
      }
      if (query.to) {
        const to = new Date(query.to);
        to.setHours(23, 59, 59, 999);
        eventDate.lte = to;
      }
      where.eventDate = eventDate;
    }

    return where;
  }

  private csvEscape(value: string) {
    if (/[",\n\r]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  async listResults(user: JwtUser, activityId: string) {
    await this.activities.getActivity(user, activityId);

    return this.db().departmentActivityResult.findMany({
      where: { tenantId: user.tid, activityId },
      include: {
        registration: {
          include: {
            student: {
              select: {
                id: true,
                enrollmentNumber: true,
                rollNumber: true,
                masterProfile: { select: { fullName: true } },
                user: { select: { displayName: true } },
              },
            },
          },
        },
      },
      orderBy: [{ position: 'asc' }, { recordedAt: 'asc' }],
    });
  }

  async upsertResults(
    user: JwtUser,
    activityId: string,
    dto: UpsertResultsDto,
  ) {
    this.requireManage(user);
    await this.activities.getActivity(user, activityId);

    const registrationIds = dto.results.map((r) => r.registrationId);
    if (registrationIds.length) {
      const registrations =
        await this.db().departmentActivityRegistration.findMany({
          where: {
            tenantId: user.tid,
            activityId,
            id: { in: registrationIds },
            status: ACTIVE_REGISTRATION,
          },
          select: { id: true },
        });

      if (registrations.length !== registrationIds.length) {
        throw new BadRequestException(
          'One or more registrations are invalid for this activity.',
        );
      }
    }

    const now = new Date();
    const saved = [];

    for (const item of dto.results) {
      saved.push(
        await this.db().departmentActivityResult.upsert({
          where: { registrationId: item.registrationId },
          create: {
            tenantId: user.tid,
            activityId,
            registrationId: item.registrationId,
            position: item.position,
            remarks: item.remarks?.trim() ?? '',
            recordedById: user.sub,
            recordedAt: now,
          },
          update: {
            position: item.position,
            remarks: item.remarks?.trim() ?? '',
            recordedById: user.sub,
            recordedAt: now,
          },
        }),
      );
    }

    return saved;
  }

  private awardCertificateHtml(positionTitle: string) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
@page{size:A4 landscape;margin:12mm}
body{font-family:Georgia,serif;color:#1e3a5f;margin:0}
.wrap{border:3px double #1e3a5f;padding:18mm 16mm;min-height:170mm;position:relative}
h1{text-align:center;letter-spacing:2px;margin:0 0 6px;font-size:22px}
h2{text-align:center;letter-spacing:3px;margin:18px 0;font-size:18px;text-decoration:underline}
.meta{display:flex;justify-content:space-between;font-size:12px;margin-bottom:16px}
.body{font-size:14px;line-height:1.7;text-align:justify}
.footer{display:flex;justify-content:space-between;margin-top:36px;font-size:12px;text-align:center}
.footer div{min-width:28%}
.qr{text-align:center}
</style></head><body><div class="wrap">
  <h1>{{college_name_upper}}</h1>
  <p style="text-align:center;font-size:11px;margin:0">{{university_affiliation}} · {{naac_info}}</p>
  <h2>CERTIFICATE OF ${positionTitle.toUpperCase()}</h2>
  <div class="meta"><div>No. {{certificate_number}}</div><div>Verification: {{verification_id}}</div><div>{{date_of_issue}}</div></div>
  <div class="body">
    <p>This is to certify that <strong>{{student_title}} {{student_name}}</strong> has been awarded
    <strong>${positionTitle}</strong> in <strong>{{activity_title}}</strong> organized by the
    <strong>{{department_name}}</strong> department on <strong>{{event_date}}</strong> at {{college_name}}.</p>
    <p>Activity type: <strong>{{activity_type_label}}</strong>. Venue: <strong>{{venue}}</strong>.</p>
  </div>
  <div class="footer">
    <div>{{registrar_block}}</div>
    <div class="qr">{{qr_code}}<div>{{verification_portal}}</div></div>
    <div>{{principal_signature_block}}</div>
  </div>
</div></body></html>`;
  }

  private async resolveCertificateCategory(
    tenantId: string,
    activityType: string,
  ) {
    const code =
      activityType === 'WORKSHOP' ? 'WORKSHOP' : 'DEPARTMENT_ACTIVITY';
    const name =
      activityType === 'WORKSHOP'
        ? 'Workshop Participation'
        : 'Department Activity Participation';

    let category = await this.db().certificateCategory.findFirst({
      where: { tenantId, code, deletedAt: null },
    });
    if (!category) {
      category = await this.db().certificateCategory.create({
        data: {
          tenantId,
          code,
          name,
          group: 'ACADEMIC',
          description: `Certificate of participation for ${name.toLowerCase()}`,
        },
      });
    }
    return category;
  }

  private async issueSingleAwardCertificate(
    user: JwtUser,
    activity: {
      id: string;
      title: string;
      activityType: string;
      eventDate: Date;
      venue: string;
      department: { code: string; name: string };
    },
    registration: { id: string; studentId: string },
    position: string,
    sequenceNo: number,
  ) {
    const certificateType = positionCertificateType(position);
    const category = await this.resolveCertificateCategory(
      user.tid,
      activity.activityType,
    );
    const year = new Date(activity.eventDate).getFullYear();
    const deptCode = activity.department.code.toUpperCase();
    const certificateNo = `DBC-${deptCode}-${year}-AWD-${String(sequenceNo).padStart(4, '0')}`;
    const verificationToken = randomUUID();
    const positionTitle = positionLabel(position);

    const variableSnapshot = await this.variables.buildStudentVariables(
      user.tid,
      registration.studentId,
      {
        programme: activity.title,
        activity_title: activity.title,
        activity_type: activity.activityType,
        activity_type_label: this.activityTypeLabel(activity.activityType),
        event_date: this.formatEventDate(activity.eventDate),
        department_name: activity.department.name,
        venue: activity.venue,
        certificate_number: certificateNo,
        position: positionTitle,
        position_label: positionTitle,
      },
      {
        verificationToken,
        certificateNo,
        categoryCode: category.code,
      },
    );

    const html = this.variables.renderTemplate(
      this.awardCertificateHtml(positionTitle),
      variableSnapshot,
    );

    const issue = await this.db().certificateIssue.create({
      data: {
        tenantId: user.tid,
        categoryId: category.id,
        studentId: registration.studentId,
        certificateNo,
        renderedHtml: html,
        qrPayload: `/verify/certificates/${verificationToken}`,
        verificationToken,
        variableSnapshot,
        issuedById: user.sub,
      },
    });

    try {
      const document = await this.documents.persistCertificateDocument(
        user.tid,
        issue.id,
        html,
      );
      await this.db().certificateIssue.update({
        where: { id: issue.id },
        data: {
          pdfPath: document.primaryPath,
          metadata: { htmlPath: document.htmlPath, pdfPath: document.pdfPath },
        },
      });
    } catch {
      /* PDF optional if puppeteer unavailable */
    }

    const link = await this.db().departmentActivityCertificateLink.create({
      data: {
        tenantId: user.tid,
        activityId: activity.id,
        registrationId: registration.id,
        certificateIssueId: issue.id,
        certificateType,
      },
    });

    return { issue, link };
  }

  async issueAwardCertificates(user: JwtUser, activityId: string) {
    this.requireManage(user);
    await this.activities.getActivity(user, activityId);

    const activity = await this.db().departmentActivity.findFirst({
      where: { id: activityId, tenantId: user.tid, deletedAt: null },
      include: {
        department: { select: { id: true, name: true, code: true } },
      },
    });
    if (!activity) throw new NotFoundException('Activity not found');

    const results = await this.db().departmentActivityResult.findMany({
      where: {
        tenantId: user.tid,
        activityId,
        position: { in: [...COMPETITION_POSITIONS] },
      },
      include: {
        registration: {
          select: { id: true, studentId: true },
        },
      },
    });

    const awardResults = results.filter((r: { position: string }) =>
      this.isAwardPosition(r.position),
    );

    if (!awardResults.length) {
      return { issued: 0, results: [] };
    }

    const existingLinks =
      await this.db().departmentActivityCertificateLink.findMany({
        where: {
          tenantId: user.tid,
          activityId,
          registrationId: {
            in: awardResults.map(
              (r: { registration: { id: string } }) => r.registration.id,
            ),
          },
        },
        select: { registrationId: true, certificateType: true },
      });

    const linkedKeys = new Set(
      existingLinks.map(
        (l: { registrationId: string; certificateType: string }) =>
          `${l.registrationId}:${l.certificateType}`,
      ),
    );

    const pending = awardResults.filter(
      (r: { registration: { id: string }; position: string }) => {
        const certType = positionCertificateType(r.position);
        return !linkedKeys.has(`${r.registration.id}:${certType}`);
      },
    );

    if (!pending.length) {
      return { issued: 0, results: [] };
    }

    const existingAwardCount =
      await this.db().departmentActivityCertificateLink.count({
        where: {
          tenantId: user.tid,
          activityId,
          certificateType: { not: 'PARTICIPATION' },
        },
      });

    const issued = [];
    for (let i = 0; i < pending.length; i++) {
      const row = pending[i];
      issued.push(
        await this.issueSingleAwardCertificate(
          user,
          activity,
          row.registration,
          row.position,
          existingAwardCount + i + 1,
        ),
      );
    }

    return { issued: issued.length, results: issued };
  }

  async submitPresentation(
    user: JwtUser,
    activityId: string,
    dto: SubmitPresentationDto,
  ) {
    const studentId = await this.activities.resolveStudentIdForUser(user);

    const registration =
      await this.db().departmentActivityRegistration.findFirst({
        where: {
          tenantId: user.tid,
          activityId,
          studentId,
          status: ACTIVE_REGISTRATION,
        },
      });
    if (!registration) {
      throw new BadRequestException(
        'You must be registered for this activity to submit a presentation.',
      );
    }

    return this.db().departmentActivityPresentation.upsert({
      where: { registrationId: registration.id },
      create: {
        tenantId: user.tid,
        activityId,
        registrationId: registration.id,
        topicTitle: dto.topicTitle.trim(),
        abstractText: dto.abstractText?.trim() ?? '',
        fileUrl: dto.fileUrl ?? null,
        supervisor: dto.supervisor?.trim() ?? '',
        keywords: dto.keywords?.trim() ?? '',
        status: 'SUBMITTED',
      },
      update: {
        topicTitle: dto.topicTitle.trim(),
        abstractText: dto.abstractText?.trim() ?? '',
        fileUrl: dto.fileUrl ?? null,
        supervisor: dto.supervisor?.trim() ?? '',
        keywords: dto.keywords?.trim() ?? '',
        status: 'SUBMITTED',
        reviewedById: null,
        reviewedAt: null,
        reviewNote: '',
      },
    });
  }

  async listPresentations(user: JwtUser, activityId: string) {
    await this.activities.getActivity(user, activityId);

    return this.db().departmentActivityPresentation.findMany({
      where: { tenantId: user.tid, activityId },
      include: {
        registration: {
          include: {
            student: {
              select: {
                id: true,
                enrollmentNumber: true,
                rollNumber: true,
                masterProfile: { select: { fullName: true } },
                user: { select: { displayName: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async reviewPresentation(
    user: JwtUser,
    presentationId: string,
    dto: ReviewPresentationDto,
  ) {
    this.requireManage(user);

    const presentation =
      await this.db().departmentActivityPresentation.findFirst({
        where: { id: presentationId, tenantId: user.tid },
      });
    if (!presentation) {
      throw new NotFoundException('Presentation not found.');
    }

    await this.activities.getActivity(user, presentation.activityId);

    return this.db().departmentActivityPresentation.update({
      where: { id: presentation.id },
      data: {
        status: dto.status,
        reviewNote: dto.reviewNote?.trim() ?? '',
        reviewedById: user.sub,
        reviewedAt: new Date(),
      },
    });
  }

  async listMedia(user: JwtUser, activityId: string) {
    await this.activities.getActivity(user, activityId);

    return this.db().departmentActivityMedia.findMany({
      where: { tenantId: user.tid, activityId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addMedia(user: JwtUser, activityId: string, dto: AddMediaDto) {
    this.requireManage(user);
    await this.activities.getActivity(user, activityId);

    return this.db().departmentActivityMedia.create({
      data: {
        tenantId: user.tid,
        activityId,
        mediaType: dto.mediaType,
        title: dto.title?.trim() ?? '',
        url: dto.url.trim(),
        uploadedById: user.sub,
      },
    });
  }

  async removeMedia(user: JwtUser, mediaId: string) {
    this.requireManage(user);

    const media = await this.db().departmentActivityMedia.findFirst({
      where: { id: mediaId, tenantId: user.tid, deletedAt: null },
    });
    if (!media) throw new NotFoundException('Media not found.');

    await this.activities.getActivity(user, media.activityId);

    return this.db().departmentActivityMedia.update({
      where: { id: media.id },
      data: { deletedAt: new Date() },
    });
  }

  async updateReport(
    user: JwtUser,
    activityId: string,
    dto: UpsertActivityReportDto,
  ) {
    this.requireManage(user);
    const activity = await this.activities.getActivity(user, activityId);

    const data: Record<string, string> = {};
    if (dto.reportText !== undefined) data.reportText = dto.reportText;
    if (dto.outcomesSummary !== undefined) {
      data.outcomesSummary = dto.outcomesSummary;
    }
    if (dto.feedbackSummary !== undefined) {
      data.feedbackSummary = dto.feedbackSummary;
    }

    return this.db().departmentActivity.update({
      where: { id: activity.id },
      data,
      include: {
        department: { select: { id: true, name: true, code: true } },
      },
    });
  }

  async onActivityOpened(
    user: JwtUser,
    activity: {
      id: string;
      tenantId: string;
      title: string;
      eventDate: Date;
      venue: string;
      calendarPublishedAt: Date | null;
      department?: { name: string };
    },
  ) {
    let updated = activity;

    if (!activity.calendarPublishedAt) {
      updated = await this.db().departmentActivity.update({
        where: { id: activity.id },
        data: { calendarPublishedAt: new Date() },
        include: {
          department: { select: { id: true, name: true, code: true } },
        },
      });
    }

    void this.notifyActivityOpened(user.tid, updated).catch(() => undefined);

    return updated;
  }

  private async notifyActivityOpened(tenantId: string, activity: any) {
    if (!this.communication) return;

    const registrations =
      await this.db().departmentActivityRegistration.findMany({
        where: {
          tenantId,
          activityId: activity.id,
          status: ACTIVE_REGISTRATION,
        },
        include: {
          student: {
            select: {
              id: true,
              userId: true,
              user: { select: { email: true, displayName: true } },
              masterProfile: { select: { fullName: true, email: true } },
            },
          },
        },
      });

    if (!registrations.length) return;

    const institutionName =
      await this.communication.getInstitutionName(tenantId);
    const eventDate = this.formatEventDate(activity.eventDate);
    const departmentName = activity.department?.name ?? '';

    for (const reg of registrations) {
      const student = reg.student;
      if (!student?.userId) continue;

      try {
        await this.communication.trigger({
          tenantId,
          templateCode: 'DEPARTMENT_ACTIVITY_OPEN',
          triggerKey: 'DEPARTMENT_ACTIVITY_OPEN',
          entityType: 'DEPARTMENT_ACTIVITY',
          entityId: activity.id,
          recipient: {
            recipientType: 'STUDENT',
            userId: String(student.userId),
            studentId: reg.studentId,
            displayName:
              student.masterProfile?.fullName ??
              student.user?.displayName ??
              student.user?.email,
            email: student.masterProfile?.email ?? student.user?.email,
          },
          variables: {
            institution_name: institutionName,
            student_name:
              student.masterProfile?.fullName ??
              student.user?.displayName ??
              'Student',
            activity_title: activity.title,
            department_name: departmentName,
            event_date: eventDate,
            venue: activity.venue ?? '',
            login_url: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
          },
          channels: ['EMAIL', 'IN_APP', 'PUSH'],
        });
      } catch {
        /* notification failures must not block status transition */
      }
    }
  }

  async onActivityCompleted(
    user: JwtUser,
    activity: {
      id: string;
      tenantId: string;
      title: string;
      activityType: string;
      eventDate: Date;
      departmentId: string;
      naacEvidenceTaggedAt: Date | null;
    },
  ) {
    if (activity.naacEvidenceTaggedAt) {
      return activity;
    }

    const eventDate = new Date(activity.eventDate);
    const academicYear = academicYearLabel(eventDate);
    const metricCode = isCompetitionActivityType(activity.activityType)
      ? '5.3.1'
      : '5.1.3';

    const evidencePayload = {
      sourceType: 'department_activity',
      sourceId: activity.id,
      criterion: 5,
      metricCode,
      academicYear,
      departmentId: activity.departmentId,
      activityTitle: activity.title,
      eventTitle: activity.title,
      evidenceNotes: `Department activity completed: ${activity.title}`,
    };

    if (this.naacEvidence) {
      await this.naacEvidence.create(user, evidencePayload);
    } else {
      await this.db().naacEvidenceTag.create({
        data: {
          tenantId: user.tid,
          ...evidencePayload,
          createdById: user.sub,
        },
      });
    }

    return this.db().departmentActivity.update({
      where: { id: activity.id },
      data: { naacEvidenceTaggedAt: new Date() },
      include: {
        department: { select: { id: true, name: true, code: true } },
      },
    });
  }

  async reportsSummary(
    user: JwtUser,
    query: { departmentId?: string; from?: string; to?: string } = {},
  ) {
    if (query.departmentId) {
      const scoped = await this.activities.resolveStaffDepartmentIds(user);
      if (scoped !== null && !scoped.includes(query.departmentId)) {
        throw new ForbiddenException('Department not in your scope.');
      }
    } else {
      const scoped = await this.activities.resolveStaffDepartmentIds(user);
      if (scoped !== null && scoped.length === 0) {
        return {
          byStatus: {},
          byActivityType: {},
          participants: 0,
          certificates: 0,
          winners: 0,
        };
      }
      if (scoped !== null && scoped.length) {
        query = { ...query, departmentId: undefined };
      }
    }

    const where = this.buildReportWhere(user, query);
    const scoped = await this.activities.resolveStaffDepartmentIds(user);
    if (scoped !== null && scoped.length && !query.departmentId) {
      where.departmentId = { in: scoped };
    }

    const activities = await this.db().departmentActivity.findMany({
      where,
      select: { id: true, status: true, activityType: true },
    });

    const activityIds = activities.map((a: { id: string }) => a.id);

    const byStatus: Record<string, number> = {};
    const byActivityType: Record<string, number> = {};
    for (const a of activities) {
      byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
      byActivityType[a.activityType] =
        (byActivityType[a.activityType] ?? 0) + 1;
    }

    const [participants, certificates, winners] = activityIds.length
      ? await Promise.all([
          this.db().departmentActivityRegistration.count({
            where: {
              tenantId: user.tid,
              activityId: { in: activityIds },
              status: ACTIVE_REGISTRATION,
            },
          }),
          this.db().departmentActivityCertificateLink.count({
            where: {
              tenantId: user.tid,
              activityId: { in: activityIds },
            },
          }),
          this.db().departmentActivityResult.count({
            where: {
              tenantId: user.tid,
              activityId: { in: activityIds },
              position: {
                in: [
                  'WINNER',
                  'RUNNER_UP',
                  'SECOND_RUNNER_UP',
                ] as CompetitionPosition[],
              },
            },
          }),
        ])
      : [0, 0, 0];

    return {
      byStatus,
      byActivityType,
      participants,
      certificates,
      winners,
    };
  }

  async reportsCsv(
    user: JwtUser,
    query: { departmentId?: string; from?: string; to?: string } = {},
  ) {
    const scoped = await this.activities.resolveStaffDepartmentIds(user);
    if (
      query.departmentId &&
      scoped !== null &&
      !scoped.includes(query.departmentId)
    ) {
      throw new ForbiddenException('Department not in your scope.');
    }

    const where = this.buildReportWhere(user, query);
    if (scoped !== null && scoped.length && !query.departmentId) {
      where.departmentId = { in: scoped };
    } else if (scoped !== null && scoped.length === 0) {
      return 'id,title,department,activityType,eventDate,status,participantCount,attendanceCount,winnerCount\n';
    }

    const activities = await this.db().departmentActivity.findMany({
      where,
      include: {
        department: { select: { name: true } },
        _count: {
          select: {
            registrations: { where: { status: ACTIVE_REGISTRATION } },
            results: {
              where: {
                position: {
                  in: [
                    'WINNER',
                    'RUNNER_UP',
                    'SECOND_RUNNER_UP',
                  ] as CompetitionPosition[],
                },
              },
            },
          },
        },
      },
      orderBy: [{ eventDate: 'desc' }, { title: 'asc' }],
    });

    const activityIds = activities.map((a: { id: string }) => a.id);
    const attendanceCounts = new Map<string, number>();

    if (activityIds.length) {
      const attendanceGroups =
        await this.db().departmentActivityAttendance.groupBy({
          by: ['registrationId'],
          where: {
            tenantId: user.tid,
            registration: {
              activityId: { in: activityIds },
              status: ACTIVE_REGISTRATION,
            },
          },
          _count: { _all: true },
        });

      const registrations =
        await this.db().departmentActivityRegistration.findMany({
          where: {
            tenantId: user.tid,
            activityId: { in: activityIds },
            id: {
              in: attendanceGroups.map(
                (g: { registrationId: string }) => g.registrationId,
              ),
            },
          },
          select: { id: true, activityId: true },
        });

      for (const reg of registrations) {
        attendanceCounts.set(
          reg.activityId,
          (attendanceCounts.get(reg.activityId) ?? 0) + 1,
        );
      }
    }

    const header =
      'id,title,department,activityType,eventDate,status,participantCount,attendanceCount,winnerCount';
    const rows = activities.map(
      (a: {
        id: string;
        title: string;
        department: { name: string };
        activityType: string;
        eventDate: Date;
        status: string;
        _count: { registrations: number; results: number };
      }) =>
        [
          a.id,
          a.title,
          a.department.name,
          a.activityType,
          this.formatEventDate(a.eventDate),
          a.status,
          String(a._count.registrations),
          String(attendanceCounts.get(a.id) ?? 0),
          String(a._count.results),
        ]
          .map((v) => this.csvEscape(String(v)))
          .join(','),
    );

    return [header, ...rows].join('\n');
  }

  async calendarEvents(tenantId: string, from: Date, to: Date) {
    return this.db().departmentActivity.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: [...CALENDAR_STATUSES] },
        eventDate: { gte: from, lte: to },
      },
      select: {
        id: true,
        eventDate: true,
        title: true,
        status: true,
        department: { select: { name: true } },
      },
      orderBy: { eventDate: 'asc' },
    });
  }
}
