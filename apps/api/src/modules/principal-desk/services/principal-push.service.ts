import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import {
  CommunicationAudienceService,
  type AudienceFilter,
} from '../../communication/services/communication-audience.service';
import { CommunicationCampaignsService } from '../../communication/services/communication-campaigns.service';
import { FcmPushService } from '../../communication/services/fcm-push.service';
import type { PrincipalPushDto } from '../dto/principal-push.dto';

const SOURCE = 'principal-push';

@Injectable()
export class PrincipalPushService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaigns: CommunicationCampaignsService,
    private readonly audience: CommunicationAudienceService,
    private readonly fcm: FcmPushService,
  ) {}

  async options(tenantId: string) {
    const [departments, standings, sections] = await Promise.all([
      this.prisma.department.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
        take: 200,
      }),
      this.prisma.studentAcademicStanding.findMany({
        where: { tenantId },
        distinct: ['currentSemesterSequence'],
        select: { currentSemesterSequence: true },
        orderBy: { currentSemesterSequence: 'asc' },
      }),
      this.prisma.offeringSection.findMany({
        where: { tenantId, deletedAt: null, status: 'active' },
        select: {
          id: true,
          sectionCode: true,
          courseOffering: {
            select: {
              semesterSequence: true,
              course: { select: { code: true, title: true } },
            },
          },
        },
        take: 250,
        orderBy: { sectionCode: 'asc' },
      }),
    ]);
    return {
      fcmConfigured: this.fcm.isConfigured(),
      fcmDemoMode: this.fcm.isDemoMode(),
      audiences: [
        { id: 'STUDENTS_AND_STAFF', label: 'All students and staff' },
        { id: 'STUDENTS', label: 'Students only' },
        { id: 'STAFF', label: 'Staff only' },
      ],
      departments,
      semesters: standings.map((row) => row.currentSemesterSequence),
      sections: sections.map((row) => ({
        id: row.id,
        sectionCode: row.sectionCode,
        semesterNo: row.courseOffering?.semesterSequence ?? null,
        courseCode: row.courseOffering?.course?.code ?? '',
        courseTitle: row.courseOffering?.course?.title ?? '',
      })),
    };
  }

  async searchPeople(tenantId: string, q: string) {
    const term = q.trim();
    if (term.length < 2) return { students: [], staff: [] };
    const [students, staff] = await Promise.all([
      this.prisma.student.findMany({
        where: {
          tenantId,
          deletedAt: null,
          OR: [
            { rollNumber: { contains: term, mode: 'insensitive' } },
            { enrollmentNumber: { contains: term, mode: 'insensitive' } },
            {
              masterProfile: {
                fullName: { contains: term, mode: 'insensitive' },
              },
            },
          ],
        },
        select: {
          id: true,
          rollNumber: true,
          masterProfile: { select: { fullName: true } },
        },
        take: 8,
      }),
      this.prisma.staffProfile.findMany({
        where: {
          tenantId,
          deletedAt: null,
          OR: [
            { fullName: { contains: term, mode: 'insensitive' } },
            { employeeCode: { contains: term, mode: 'insensitive' } },
          ],
        },
        select: { id: true, fullName: true, employeeCode: true },
        take: 8,
      }),
    ]);
    return {
      students: students.map((row) => ({
        id: row.id,
        name: row.masterProfile?.fullName || row.rollNumber || 'Student',
        rollNumber: row.rollNumber,
      })),
      staff: staff.map((row) => ({
        id: row.id,
        name: row.fullName,
        employeeCode: row.employeeCode,
      })),
    };
  }

  preview(tenantId: string, dto: PrincipalPushDto) {
    const target = this.target(dto);
    return this.audience.count(tenantId, target.audienceType, target.filter);
  }

  async send(user: JwtUser, dto: PrincipalPushDto) {
    if (!this.fcm.isConfigured()) {
      throw new BadRequestException(
        'Push notifications are not configured on the server (FCM).',
      );
    }
    const title = dto.title.trim();
    const message = dto.message.trim();
    const noticeLink = dto.noticeLink?.trim() || '';
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('Choose a valid schedule time.');
    }
    if (scheduledAt && scheduledAt.getTime() <= Date.now() + 60_000) {
      throw new BadRequestException(
        'Schedule the notification at least a minute from now, or send it now.',
      );
    }

    const target = this.target(dto);
    const count = await this.audience.count(
      user.tid,
      target.audienceType,
      target.filter,
    );
    if (!count.total) {
      throw new BadRequestException(
        'No students or staff match this recipient selection.',
      );
    }

    const duplicate = await this.prisma.communicationCampaign.findFirst({
      where: {
        tenantId: user.tid,
        createdById: user.sub,
        subject: title,
        createdAt: { gte: new Date(Date.now() - 2 * 60 * 1000) },
        status: { not: 'CANCELLED' },
        metadata: { path: ['source'], equals: SOURCE },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException(
        'This notification was just sent. Wait a moment before sending it again.',
      );
    }

    const campaign = await this.campaigns.create(user, {
      name: title,
      subject: title,
      bodyText: message,
      audienceType: target.audienceType,
      audienceFilter: target.filter,
      channels: ['IN_APP', 'PUSH'],
      scheduledAt: scheduledAt ? scheduledAt.toISOString() : undefined,
      metadata: {
        source: SOURCE,
        messageType: 'push',
        pushCategory: 'circulars',
        audienceLabel: target.label,
        noticeLink: noticeLink || null,
        estimatedRecipients: count.total,
        estimatedPush: count.withPush,
      },
    });

    if (!scheduledAt) {
      await this.campaigns.send(user, campaign.id);
    }

    return {
      id: campaign.id,
      status: scheduledAt ? 'SCHEDULED' : 'SENDING',
      scheduledAt: scheduledAt?.toISOString() ?? null,
      recipients: count.total,
      devices: count.withPush,
      audienceLabel: target.label,
    };
  }

  async history(tenantId: string) {
    const rows = await this.prisma.communicationCampaign.findMany({
      where: {
        tenantId,
        metadata: { path: ['source'], equals: SOURCE },
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: {
        createdBy: { select: { displayName: true, email: true } },
      },
    });
    const ids = rows.map((row) => row.id);
    const stats = ids.length
      ? await this.prisma.communicationDeliveryLog.groupBy({
          by: ['campaignId', 'status'],
          where: { tenantId, channel: 'PUSH', campaignId: { in: ids } },
          _count: true,
        })
      : [];
    return rows.map((row) => {
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      const push = stats.filter((item) => item.campaignId === row.id);
      const countOf = (status: string) =>
        push.find((item) => item.status === status)?._count ?? 0;
      return {
        id: row.id,
        title: row.subject,
        message: row.bodyText ?? '',
        audienceLabel: String(meta.audienceLabel ?? row.audienceType),
        status: row.status,
        scheduledAt: row.scheduledAt,
        sentAt: row.sentAt,
        createdAt: row.createdAt,
        sender:
          row.createdBy?.displayName || row.createdBy?.email || 'Principal',
        acceptedByFcm: countOf('SENT'),
        failed: countOf('FAILED'),
        skipped: countOf('SKIPPED'),
        estimatedRecipients:
          typeof meta.estimatedRecipients === 'number'
            ? meta.estimatedRecipients
            : null,
        estimatedPush:
          typeof meta.estimatedPush === 'number' ? meta.estimatedPush : null,
      };
    });
  }

  async detail(tenantId: string, id: string) {
    const row = await this.prisma.communicationCampaign.findFirst({
      where: {
        id,
        tenantId,
        metadata: { path: ['source'], equals: SOURCE },
      },
      include: {
        createdBy: { select: { displayName: true, email: true } },
      },
    });
    if (!row) throw new NotFoundException('Push notification not found');
    const failures = await this.prisma.communicationDeliveryLog.findMany({
      where: {
        tenantId,
        campaignId: id,
        channel: 'PUSH',
        status: 'FAILED',
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { recipient: { select: { displayName: true } } },
    });
    const history = await this.history(tenantId);
    const summary = history.find((item) => item.id === id);
    return {
      ...summary,
      noticeLink:
        ((row.metadata ?? {}) as Record<string, unknown>).noticeLink ?? null,
      failures: failures.map((log) => ({
        name: log.recipient?.displayName ?? 'Recipient',
        error: log.errorMessage ?? 'FCM rejected the device',
        at: log.createdAt,
      })),
    };
  }

  private target(dto: PrincipalPushDto) {
    const individuals =
      (dto.audience !== 'STAFF' && (dto.studentIds?.length ?? 0) > 0) ||
      (dto.audience !== 'STUDENTS' && (dto.staffProfileIds?.length ?? 0) > 0);
    if (individuals) {
      const filter: AudienceFilter = {};
      if (dto.audience !== 'STAFF' && dto.studentIds?.length) {
        filter.studentIds = dto.studentIds;
      }
      if (dto.audience !== 'STUDENTS' && dto.staffProfileIds?.length) {
        filter.staffProfileIds = dto.staffProfileIds;
      }
      return {
        audienceType: 'INDIVIDUAL' as const,
        filter,
        label: 'Selected people',
      };
    }
    const filter: AudienceFilter = {};
    if (dto.departmentIds?.length) filter.departmentIds = dto.departmentIds;
    if (dto.audience !== 'STAFF' && dto.semesterSequences?.length) {
      filter.semesterSequences = dto.semesterSequences;
    }
    if (dto.audience !== 'STAFF' && dto.sectionIds?.length) {
      filter.sectionIds = dto.sectionIds;
    }
    if (dto.audience === 'STUDENTS') {
      return { audienceType: 'STUDENTS', filter, label: 'Students' };
    }
    if (dto.audience === 'STAFF') {
      return { audienceType: 'FACULTY', filter, label: 'Staff' };
    }
    return {
      audienceType: 'STUDENTS_AND_STAFF',
      filter,
      label: 'Students and staff',
    };
  }
}
