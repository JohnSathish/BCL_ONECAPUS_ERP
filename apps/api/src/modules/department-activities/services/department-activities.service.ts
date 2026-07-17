import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { CertificateDocumentService } from '../../certificates/certificate-document.service';
import { CertificateVariableService } from '../../certificates/certificate-variable.service';
import {
  ACTIVITY_STATUSES,
  DEPARTMENT_ACTIVITY_TYPES,
  isValidActivityType,
  type ActivityStatus,
} from '../domain/activity-types';
import type {
  MarkAttendanceDto,
  TransitionActivityStatusDto,
  UpsertDepartmentActivityDto,
} from '../dto/department-activities.dto';

const STATUS_FLOW: ActivityStatus[] = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'OPEN',
  'CLOSED',
  'COMPLETED',
];

const EDITABLE_STATUSES: ActivityStatus[] = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'OPEN',
];

const ACTIVE_REGISTRATION = 'REGISTERED';

@Injectable()
export class DepartmentActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly variables: CertificateVariableService,
    private readonly documents: CertificateDocumentService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  private hasPermission(user: JwtUser, slug: string) {
    return user.permissions?.includes(slug) ?? false;
  }

  listActivityTypes() {
    return DEPARTMENT_ACTIVITY_TYPES;
  }

  async resolveStaffDepartmentIds(user: JwtUser): Promise<string[] | null> {
    if (this.hasPermission(user, 'department-activities:approve')) {
      return null;
    }

    const staff = await this.prisma.staffProfile.findFirst({
      where: { tenantId: user.tid, portalUserId: user.sub, deletedAt: null },
      select: { departmentId: true },
    });

    if (staff?.departmentId) {
      return [staff.departmentId];
    }

    if (
      this.hasPermission(user, 'department-activities:manage') ||
      this.hasPermission(user, 'department-activities:approve')
    ) {
      return null;
    }

    return [];
  }

  private async assertDepartmentScope(user: JwtUser, departmentId: string) {
    const scoped = await this.resolveStaffDepartmentIds(user);
    if (scoped !== null && !scoped.includes(departmentId)) {
      throw new ForbiddenException('Department not in your scope.');
    }
  }

  private buildActivityWhere(
    user: JwtUser,
    scopedDeptIds: string[] | null,
    query: { departmentId?: string; status?: string; upcoming?: boolean } = {},
  ) {
    const where: Record<string, unknown> = {
      tenantId: user.tid,
      deletedAt: null,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.upcoming) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      where.eventDate = { gte: today };
      where.status = query.status ?? { in: ['APPROVED', 'OPEN'] };
    }

    if (query.departmentId) {
      where.departmentId = query.departmentId;
    } else if (scopedDeptIds !== null) {
      if (scopedDeptIds.length === 0) {
        where.departmentId = { in: [] };
      } else {
        where.departmentId = { in: scopedDeptIds };
      }
    }

    return where;
  }

  async dashboard(user: JwtUser) {
    const scopedDeptIds = await this.resolveStaffDepartmentIds(user);
    const baseWhere = this.buildActivityWhere(user, scopedDeptIds);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const registrationWhere: Record<string, unknown> = {
      tenantId: user.tid,
      status: ACTIVE_REGISTRATION,
    };
    if (scopedDeptIds !== null && scopedDeptIds.length) {
      registrationWhere.activity = { departmentId: { in: scopedDeptIds } };
    } else if (scopedDeptIds !== null && scopedDeptIds.length === 0) {
      registrationWhere.activity = { departmentId: { in: [] } };
    }

    const certWhere: Record<string, unknown> = { tenantId: user.tid };
    if (scopedDeptIds !== null && scopedDeptIds.length) {
      certWhere.activity = { departmentId: { in: scopedDeptIds } };
    } else if (scopedDeptIds !== null && scopedDeptIds.length === 0) {
      certWhere.activity = { departmentId: { in: [] } };
    }

    const [upcoming, completed, participants, certificates, pendingApproval] =
      await Promise.all([
        this.db().departmentActivity.count({
          where: {
            ...baseWhere,
            eventDate: { gte: today },
            status: { in: ['APPROVED', 'OPEN'] },
          },
        }),
        this.db().departmentActivity.count({
          where: { ...baseWhere, status: 'COMPLETED' },
        }),
        this.db().departmentActivityRegistration.count({
          where: registrationWhere,
        }),
        this.db().departmentActivityCertificateLink.count({
          where: certWhere,
        }),
        this.db().departmentActivity.count({
          where: { ...baseWhere, status: 'PENDING_APPROVAL' },
        }),
      ]);

    return {
      upcoming,
      completed,
      participants,
      certificates,
      pendingApproval,
    };
  }

  async listActivities(
    user: JwtUser,
    query: { departmentId?: string; status?: string; upcoming?: boolean } = {},
  ) {
    if (query.departmentId) {
      await this.assertDepartmentScope(user, query.departmentId);
    }

    const scopedDeptIds = await this.resolveStaffDepartmentIds(user);
    return this.db().departmentActivity.findMany({
      where: this.buildActivityWhere(user, scopedDeptIds, query),
      include: {
        department: { select: { id: true, name: true, code: true } },
        _count: {
          select: {
            registrations: { where: { status: ACTIVE_REGISTRATION } },
            certificateLinks: true,
          },
        },
      },
      orderBy: [{ eventDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getActivity(user: JwtUser, id: string) {
    const activity = await this.db().departmentActivity.findFirst({
      where: { id, tenantId: user.tid, deletedAt: null },
      include: {
        department: { select: { id: true, name: true, code: true } },
        _count: {
          select: {
            registrations: { where: { status: ACTIVE_REGISTRATION } },
          },
        },
      },
    });
    if (!activity) throw new NotFoundException('Activity not found');

    await this.assertDepartmentScope(user, activity.departmentId);

    const attendanceCount = await this.db().departmentActivityAttendance.count({
      where: {
        tenantId: user.tid,
        registration: { activityId: id, status: ACTIVE_REGISTRATION },
      },
    });

    return {
      ...activity,
      registrationCount: activity._count.registrations,
      attendanceCount,
    };
  }

  private mapActivityDto(dto: UpsertDepartmentActivityDto) {
    return {
      title: dto.title.trim(),
      departmentId: dto.departmentId,
      activityType: dto.activityType,
      academicYearId: dto.academicYearId ?? null,
      semesterSequence: dto.semesterSequence ?? null,
      venue: dto.venue?.trim() ?? '',
      eventDate: new Date(dto.eventDate),
      startTime: dto.startTime ?? null,
      endTime: dto.endTime ?? null,
      registrationStartsAt: dto.registrationStartsAt
        ? new Date(dto.registrationStartsAt)
        : null,
      registrationEndsAt: dto.registrationEndsAt
        ? new Date(dto.registrationEndsAt)
        : null,
      coordinatorStaffId: dto.coordinatorStaffId ?? null,
      hodStaffId: dto.hodStaffId ?? null,
      guestSpeaker: dto.guestSpeaker?.trim() ?? '',
      chiefGuest: dto.chiefGuest?.trim() ?? '',
      theme: dto.theme?.trim() ?? '',
      objectives: dto.objectives?.trim() ?? '',
      learningOutcomes: dto.learningOutcomes?.trim() ?? '',
      description: dto.description?.trim() ?? '',
      posterUrl: dto.posterUrl ?? null,
      bannerUrl: dto.bannerUrl ?? null,
      brochureUrl: dto.brochureUrl ?? null,
      maxParticipants: dto.maxParticipants ?? null,
    };
  }

  async createActivity(user: JwtUser, dto: UpsertDepartmentActivityDto) {
    if (!isValidActivityType(dto.activityType)) {
      throw new BadRequestException('Invalid activity type.');
    }

    await this.assertDepartmentScope(user, dto.departmentId);

    const department = await this.prisma.department.findFirst({
      where: {
        id: dto.departmentId,
        tenantId: user.tid,
        deletedAt: null,
      },
    });
    if (!department) throw new BadRequestException('Department not found.');

    return this.db().departmentActivity.create({
      data: {
        tenantId: user.tid,
        ...this.mapActivityDto(dto),
        status: 'DRAFT',
        createdById: user.sub,
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
      },
    });
  }

  async updateActivity(
    user: JwtUser,
    id: string,
    dto: UpsertDepartmentActivityDto,
  ) {
    const activity = await this.getActivity(user, id);

    if (!EDITABLE_STATUSES.includes(activity.status as ActivityStatus)) {
      throw new BadRequestException(
        'Activity cannot be edited in its current status.',
      );
    }

    if (!isValidActivityType(dto.activityType)) {
      throw new BadRequestException('Invalid activity type.');
    }

    if (dto.departmentId !== activity.departmentId) {
      await this.assertDepartmentScope(user, dto.departmentId);
    }

    return this.db().departmentActivity.update({
      where: { id: activity.id },
      data: this.mapActivityDto(dto),
      include: {
        department: { select: { id: true, name: true, code: true } },
      },
    });
  }

  private canTransition(from: string, to: string): boolean {
    if (to === 'CANCELLED') {
      return from !== 'COMPLETED' && from !== 'CANCELLED';
    }
    const fromIdx = STATUS_FLOW.indexOf(from as ActivityStatus);
    const toIdx = STATUS_FLOW.indexOf(to as ActivityStatus);
    if (fromIdx < 0 || toIdx < 0) return false;
    return toIdx === fromIdx + 1;
  }

  async transitionStatus(
    user: JwtUser,
    id: string,
    dto: TransitionActivityStatusDto,
  ) {
    const activity = await this.getActivity(user, id);
    const nextStatus = dto.status;

    if (!ACTIVITY_STATUSES.includes(nextStatus as ActivityStatus)) {
      throw new BadRequestException('Invalid status.');
    }

    if (!this.canTransition(activity.status, nextStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${activity.status} to ${nextStatus}.`,
      );
    }

    if (nextStatus === 'APPROVED') {
      if (!this.hasPermission(user, 'department-activities:approve')) {
        throw new ForbiddenException('Approval permission required.');
      }
    } else if (!this.hasPermission(user, 'department-activities:manage')) {
      throw new ForbiddenException('Manage permission required.');
    }

    const data: Record<string, unknown> = { status: nextStatus };

    if (nextStatus === 'APPROVED') {
      data.approvedById = user.sub;
      data.approvedAt = new Date();
    }

    return this.db().departmentActivity.update({
      where: { id: activity.id },
      data,
      include: {
        department: { select: { id: true, name: true, code: true } },
      },
    });
  }

  private isRegistrationWindowOpen(activity: {
    status: string;
    registrationStartsAt: Date | null;
    registrationEndsAt: Date | null;
  }) {
    if (activity.status !== 'OPEN') return false;
    const now = new Date();
    if (activity.registrationStartsAt && now < activity.registrationStartsAt) {
      return false;
    }
    if (activity.registrationEndsAt && now > activity.registrationEndsAt) {
      return false;
    }
    return true;
  }

  async resolveStudentIdForUser(user: JwtUser) {
    const student = await this.db().student.findFirst({
      where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
      select: { id: true },
    });
    if (!student) {
      throw new BadRequestException(
        'No student profile linked to this account.',
      );
    }
    return student.id;
  }

  async registerStudent(user: JwtUser, activityId: string) {
    const studentId = await this.resolveStudentIdForUser(user);

    const activity = await this.db().departmentActivity.findFirst({
      where: { id: activityId, tenantId: user.tid, deletedAt: null },
    });
    if (!activity) throw new NotFoundException('Activity not found');

    if (!this.isRegistrationWindowOpen(activity)) {
      throw new BadRequestException(
        'Registration is not open for this activity.',
      );
    }

    const existing = await this.db().departmentActivityRegistration.findUnique({
      where: {
        activityId_studentId: { activityId, studentId },
      },
    });
    if (existing?.status === ACTIVE_REGISTRATION) {
      throw new BadRequestException('Already registered for this activity.');
    }

    if (activity.maxParticipants != null) {
      const count = await this.db().departmentActivityRegistration.count({
        where: {
          activityId,
          tenantId: user.tid,
          status: ACTIVE_REGISTRATION,
        },
      });
      if (count >= activity.maxParticipants) {
        throw new BadRequestException('Activity has reached capacity.');
      }
    }

    const qrPassToken = `DA:${randomUUID()}`;

    if (existing) {
      return this.db().departmentActivityRegistration.update({
        where: { id: existing.id },
        data: {
          status: ACTIVE_REGISTRATION,
          qrPassToken,
          registeredAt: new Date(),
          withdrawnAt: null,
        },
      });
    }

    return this.db().departmentActivityRegistration.create({
      data: {
        tenantId: user.tid,
        activityId,
        studentId,
        status: ACTIVE_REGISTRATION,
        qrPassToken,
      },
    });
  }

  async withdrawRegistration(user: JwtUser, activityId: string) {
    const studentId = await this.resolveStudentIdForUser(user);

    const registration =
      await this.db().departmentActivityRegistration.findUnique({
        where: {
          activityId_studentId: { activityId, studentId },
        },
      });
    if (!registration || registration.status !== ACTIVE_REGISTRATION) {
      throw new NotFoundException('Active registration not found.');
    }

    return this.db().departmentActivityRegistration.update({
      where: { id: registration.id },
      data: {
        status: 'WITHDRAWN',
        withdrawnAt: new Date(),
      },
    });
  }

  async myRegistrations(user: JwtUser) {
    const studentId = await this.resolveStudentIdForUser(user);

    return this.db().departmentActivityRegistration.findMany({
      where: {
        tenantId: user.tid,
        studentId,
        status: ACTIVE_REGISTRATION,
      },
      include: {
        activity: {
          include: {
            department: { select: { id: true, name: true, code: true } },
          },
        },
        attendance: true,
      },
      orderBy: { registeredAt: 'desc' },
    });
  }

  async listRegistrations(user: JwtUser, activityId: string) {
    await this.getActivity(user, activityId);

    return this.db().departmentActivityRegistration.findMany({
      where: { tenantId: user.tid, activityId },
      include: {
        student: {
          select: {
            id: true,
            enrollmentNumber: true,
            rollNumber: true,
            admissionNumber: true,
            masterProfile: { select: { fullName: true } },
            user: { select: { displayName: true, email: true } },
          },
        },
        attendance: true,
      },
      orderBy: { registeredAt: 'asc' },
    });
  }

  async markAttendance(
    user: JwtUser,
    activityId: string,
    dto: MarkAttendanceDto,
  ) {
    if (!dto.registrationId && !dto.qrPassToken) {
      throw new BadRequestException(
        'registrationId or qrPassToken is required.',
      );
    }

    const activity = await this.getActivity(user, activityId);

    if (!['OPEN', 'CLOSED', 'COMPLETED'].includes(activity.status)) {
      throw new BadRequestException(
        'Attendance can only be marked for open or completed activities.',
      );
    }

    const registration = dto.registrationId
      ? await this.db().departmentActivityRegistration.findFirst({
          where: {
            id: dto.registrationId,
            activityId,
            tenantId: user.tid,
            status: ACTIVE_REGISTRATION,
          },
        })
      : await this.db().departmentActivityRegistration.findFirst({
          where: {
            qrPassToken: dto.qrPassToken,
            activityId,
            tenantId: user.tid,
            status: ACTIVE_REGISTRATION,
          },
        });

    if (!registration) {
      throw new NotFoundException('Registration not found.');
    }

    const existing = await this.db().departmentActivityAttendance.findUnique({
      where: { registrationId: registration.id },
    });
    if (existing) {
      return existing;
    }

    return this.db().departmentActivityAttendance.create({
      data: {
        tenantId: user.tid,
        registrationId: registration.id,
        method: dto.method ?? (dto.qrPassToken ? 'QR' : 'MANUAL'),
        markedById: user.sub,
      },
    });
  }

  async finalizeAttendance(user: JwtUser, activityId: string) {
    const activity = await this.getActivity(user, activityId);

    if (activity.attendanceFinalized) {
      throw new BadRequestException('Attendance is already finalized.');
    }

    return this.db().departmentActivity.update({
      where: { id: activity.id },
      data: {
        attendanceFinalized: true,
        attendanceFinalizedAt: new Date(),
      },
    });
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

  private participationCertificateHtml() {
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
  <h2>CERTIFICATE OF PARTICIPATION</h2>
  <div class="meta"><div>No. {{certificate_number}}</div><div>Verification: {{verification_id}}</div><div>{{date_of_issue}}</div></div>
  <div class="body">
    <p>This is to certify that <strong>{{student_title}} {{student_name}}</strong> has participated in
    <strong>{{activity_title}}</strong> organized by the <strong>{{department_name}}</strong> department
    on <strong>{{event_date}}</strong> at {{college_name}}.</p>
    <p>Activity type: <strong>{{activity_type_label}}</strong>. Venue: <strong>{{venue}}</strong>.</p>
  </div>
  <div class="footer">
    <div>{{registrar_block}}</div>
    <div class="qr">{{qr_code}}<div>{{verification_portal}}</div></div>
    <div>{{principal_signature_block}}</div>
  </div>
</div></body></html>`;
  }

  private formatEventDate(date: Date) {
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  private activityTypeLabel(code: string) {
    return (
      DEPARTMENT_ACTIVITY_TYPES.find((t) => t.code === code)?.label ?? code
    );
  }

  private async issueSingleParticipationCertificate(
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
    sequenceNo: number,
  ) {
    const category = await this.resolveCertificateCategory(
      user.tid,
      activity.activityType,
    );
    const year = new Date(activity.eventDate).getFullYear();
    const deptCode = activity.department.code.toUpperCase();
    const certificateNo = `DBC-${deptCode}-${year}-SEM-${String(sequenceNo).padStart(4, '0')}`;
    const verificationToken = randomUUID();

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
      },
      {
        verificationToken,
        certificateNo,
        categoryCode: category.code,
      },
    );

    const html = this.variables.renderTemplate(
      this.participationCertificateHtml(),
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
        certificateType: 'PARTICIPATION',
      },
    });

    return { issue, link };
  }

  async issueParticipationCertificates(user: JwtUser, activityId: string) {
    const activity = await this.db().departmentActivity.findFirst({
      where: { id: activityId, tenantId: user.tid, deletedAt: null },
      include: {
        department: { select: { id: true, name: true, code: true } },
      },
    });
    if (!activity) throw new NotFoundException('Activity not found');

    await this.assertDepartmentScope(user, activity.departmentId);

    if (!activity.attendanceFinalized) {
      throw new BadRequestException(
        'Attendance must be finalized before issuing certificates.',
      );
    }

    const attended = await this.db().departmentActivityRegistration.findMany({
      where: {
        tenantId: user.tid,
        activityId,
        status: ACTIVE_REGISTRATION,
        attendance: { isNot: null },
      },
      select: { id: true, studentId: true },
    });

    if (!attended.length) {
      return { issued: 0, results: [] };
    }

    const existingLinks =
      await this.db().departmentActivityCertificateLink.findMany({
        where: {
          tenantId: user.tid,
          activityId,
          certificateType: 'PARTICIPATION',
          registrationId: { in: attended.map((a: { id: string }) => a.id) },
        },
        select: { registrationId: true },
      });
    const linkedRegistrationIds = new Set(
      existingLinks.map((l: { registrationId: string }) => l.registrationId),
    );
    const pendingIssue = attended.filter(
      (a: { id: string }) => !linkedRegistrationIds.has(a.id),
    );

    if (!pendingIssue.length) {
      return { issued: 0, results: [] };
    }

    const existingCertCount =
      await this.db().departmentActivityCertificateLink.count({
        where: {
          tenantId: user.tid,
          activityId,
          certificateType: 'PARTICIPATION',
        },
      });

    const results = [];
    for (let i = 0; i < pendingIssue.length; i++) {
      results.push(
        await this.issueSingleParticipationCertificate(
          user,
          activity,
          pendingIssue[i],
          existingCertCount + i + 1,
        ),
      );
    }

    return { issued: results.length, results };
  }

  async openForStudents(user: JwtUser) {
    const now = new Date();

    const activities = await this.db().departmentActivity.findMany({
      where: {
        tenantId: user.tid,
        deletedAt: null,
        status: 'OPEN',
        OR: [
          {
            registrationStartsAt: null,
            registrationEndsAt: null,
          },
          {
            registrationStartsAt: { lte: now },
            registrationEndsAt: null,
          },
          {
            registrationStartsAt: null,
            registrationEndsAt: { gte: now },
          },
          {
            registrationStartsAt: { lte: now },
            registrationEndsAt: { gte: now },
          },
        ],
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
        _count: {
          select: {
            registrations: { where: { status: ACTIVE_REGISTRATION } },
          },
        },
      },
      orderBy: { eventDate: 'asc' },
    });

    return activities.filter(
      (a: {
        maxParticipants: number | null;
        _count: { registrations: number };
      }) => {
        if (a.maxParticipants == null) return true;
        return a._count.registrations < a.maxParticipants;
      },
    );
  }
}
