import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import {
  DEPARTMENT_ACTIVITY_TYPES,
  positionLabel,
} from '../domain/activity-types';
import { DepartmentActivitiesService } from './department-activities.service';

export type TranscriptQuery = {
  activityType?: string;
  academicYear?: string;
  hasCertificate?: boolean;
};

@Injectable()
export class DepartmentActivitiesTranscriptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activities: DepartmentActivitiesService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  private activityTypeLabel(code: string) {
    return (
      DEPARTMENT_ACTIVITY_TYPES.find((t) => t.code === code)?.label ?? code
    );
  }

  private webOrigin() {
    return (
      process.env.WEB_PUBLIC_URL ??
      process.env.WEB_ORIGIN ??
      'http://localhost:3000'
    );
  }

  async getMyTranscript(user: JwtUser, query: TranscriptQuery = {}) {
    const studentId = await this.activities.resolveStudentIdForUser(user);
    return this.buildTranscript(user.tid, studentId, query);
  }

  async getStudentTranscript(
    user: JwtUser,
    studentId: string,
    query: TranscriptQuery = {},
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId: user.tid, deletedAt: null },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student not found');
    return this.buildTranscript(user.tid, studentId, query);
  }

  private async buildTranscript(
    tenantId: string,
    studentId: string,
    query: TranscriptQuery,
  ) {
    const yearNum = query.academicYear ? Number(query.academicYear) : NaN;
    const hasYearFilter = Number.isFinite(yearNum) && yearNum > 1900;

    const registrations =
      await this.db().departmentActivityRegistration.findMany({
        where: {
          tenantId,
          studentId,
          status: { in: ['REGISTERED', 'WITHDRAWN'] },
          ...(query.activityType
            ? {
                activity: { activityType: query.activityType, deletedAt: null },
              }
            : { activity: { deletedAt: null } }),
        },
        include: {
          activity: {
            include: {
              department: { select: { id: true, name: true, code: true } },
            },
          },
          attendance: true,
          result: true,
          presentation: {
            select: {
              id: true,
              topicTitle: true,
              status: true,
              reviewedAt: true,
            },
          },
        },
        orderBy: { registeredAt: 'desc' },
      });

    const registrationIds = registrations.map((r: { id: string }) => r.id);
    const links =
      registrationIds.length === 0
        ? []
        : await this.db().departmentActivityCertificateLink.findMany({
            where: {
              tenantId,
              registrationId: { in: registrationIds },
            },
          });

    const issueIds = [
      ...new Set(
        links.map((l: { certificateIssueId: string }) => l.certificateIssueId),
      ),
    ];
    const issues =
      issueIds.length === 0
        ? []
        : await this.db().certificateIssue.findMany({
            where: { id: { in: issueIds }, tenantId },
            select: {
              id: true,
              certificateNo: true,
              status: true,
              verificationToken: true,
              issuedAt: true,
              contentHash: true,
            },
          });
    const issueById = new Map(
      issues.map((i: { id: string }) => [i.id, i] as const),
    );

    const linksByRegistration = new Map<string, typeof links>();
    for (const link of links) {
      const list = linksByRegistration.get(link.registrationId) ?? [];
      list.push(link);
      linksByRegistration.set(link.registrationId, list);
    }

    let entries = registrations.map(
      (reg: {
        id: string;
        status: string;
        registeredAt: Date;
        activity: {
          id: string;
          title: string;
          activityType: string;
          eventDate: Date;
          venue: string;
          academicYearId: string | null;
          status: string;
          department: { id: string; name: string; code: string };
        };
        attendance: { markedAt: Date; method: string } | null;
        result: { position: string; remarks: string } | null;
        presentation: {
          id: string;
          topicTitle: string;
          status: string;
          reviewedAt: Date | null;
        } | null;
      }) => {
        const certLinks = (linksByRegistration.get(reg.id) ?? []).map(
          (link: {
            id: string;
            certificateType: string;
            certificateIssueId: string;
          }) => {
            const issue = issueById.get(link.certificateIssueId) as
              | {
                  id: string;
                  certificateNo: string;
                  status: string;
                  verificationToken: string;
                  issuedAt: Date;
                  contentHash: string | null;
                }
              | undefined;
            return {
              certificateLinkId: link.id,
              certificateType: link.certificateType,
              certificateNo: issue?.certificateNo ?? null,
              status: issue?.status ?? null,
              verificationToken: issue?.verificationToken ?? null,
              verifyUrl: issue?.verificationToken
                ? `${this.webOrigin()}/verify/certificates/${issue.verificationToken}`
                : null,
              issuedAt: issue?.issuedAt ?? null,
              hasIntegritySeal: Boolean(issue?.contentHash),
            };
          },
        );

        return {
          registrationId: reg.id,
          registrationStatus: reg.status,
          registeredAt: reg.registeredAt,
          attended: Boolean(reg.attendance),
          attendanceMarkedAt: reg.attendance?.markedAt ?? null,
          attendanceMethod: reg.attendance?.method ?? null,
          activity: {
            id: reg.activity.id,
            title: reg.activity.title,
            activityType: reg.activity.activityType,
            activityTypeLabel: this.activityTypeLabel(
              reg.activity.activityType,
            ),
            eventDate: reg.activity.eventDate,
            venue: reg.activity.venue,
            status: reg.activity.status,
            academicYearId: reg.activity.academicYearId,
            department: reg.activity.department,
          },
          result: reg.result
            ? {
                position: reg.result.position,
                positionLabel: positionLabel(reg.result.position),
                remarks: reg.result.remarks,
              }
            : null,
          presentation: reg.presentation,
          certificates: certLinks,
        };
      },
    );

    if (hasYearFilter) {
      entries = entries.filter((e: { activity: { eventDate: Date } }) => {
        return new Date(e.activity.eventDate).getFullYear() === yearNum;
      });
    }

    if (query.hasCertificate === true) {
      entries = entries.filter(
        (e: { certificates: unknown[] }) => e.certificates.length > 0,
      );
    } else if (query.hasCertificate === false) {
      entries = entries.filter(
        (e: { certificates: unknown[] }) => e.certificates.length === 0,
      );
    }

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
      select: {
        id: true,
        enrollmentNumber: true,
        rollNumber: true,
        masterProfile: { select: { fullName: true } },
        user: { select: { displayName: true } },
      },
    });

    return {
      student: student
        ? {
            id: student.id,
            name:
              student.masterProfile?.fullName ??
              student.user?.displayName ??
              null,
            enrollmentNumber: student.enrollmentNumber,
            rollNumber: student.rollNumber,
          }
        : { id: studentId, name: null },
      summary: {
        total: entries.length,
        attended: entries.filter((e: { attended: boolean }) => e.attended)
          .length,
        withCertificates: entries.filter(
          (e: { certificates: unknown[] }) => e.certificates.length > 0,
        ).length,
        awards: entries.filter(
          (e: { result: { position: string } | null }) => e.result != null,
        ).length,
      },
      entries,
    };
  }

  async createAchievementShare(user: JwtUser, certificateLinkId: string) {
    const studentId = await this.activities.resolveStudentIdForUser(user);

    const link = await this.db().departmentActivityCertificateLink.findFirst({
      where: { id: certificateLinkId, tenantId: user.tid },
    });
    if (!link) throw new NotFoundException('Certificate link not found');

    const registration =
      await this.db().departmentActivityRegistration.findFirst({
        where: {
          id: link.registrationId,
          tenantId: user.tid,
          studentId,
        },
      });
    if (!registration) {
      throw new BadRequestException(
        'You can only share your own achievement certificates.',
      );
    }

    const existing =
      await this.db().departmentActivityAchievementShare.findFirst({
        where: {
          tenantId: user.tid,
          studentId,
          certificateLinkId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: { createdAt: 'desc' },
      });

    const share =
      existing ??
      (await this.db().departmentActivityAchievementShare.create({
        data: {
          tenantId: user.tid,
          studentId,
          certificateLinkId,
          shareToken: randomUUID().replace(/-/g, ''),
          visibility: 'UNLISTED',
        },
      }));

    const shareUrl = `${this.webOrigin()}/share/achievements/${share.shareToken}`;
    return {
      shareToken: share.shareToken,
      shareUrl,
      visibility: share.visibility,
      createdAt: share.createdAt,
    };
  }

  async getPublicAchievement(shareToken: string) {
    const share = await this.db().departmentActivityAchievementShare.findFirst({
      where: { shareToken },
    });
    if (!share) throw new NotFoundException('Achievement not found');
    if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
      throw new NotFoundException('Achievement share has expired');
    }

    const link = await this.db().departmentActivityCertificateLink.findFirst({
      where: { id: share.certificateLinkId, tenantId: share.tenantId },
      include: {
        activity: {
          include: {
            department: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });
    if (!link) throw new NotFoundException('Achievement not found');

    const [issue, student, result] = await Promise.all([
      this.db().certificateIssue.findFirst({
        where: { id: link.certificateIssueId, tenantId: share.tenantId },
        select: {
          certificateNo: true,
          status: true,
          verificationToken: true,
          issuedAt: true,
          variableSnapshot: true,
          contentHash: true,
          integritySignature: true,
        },
      }),
      this.prisma.student.findFirst({
        where: { id: share.studentId, tenantId: share.tenantId },
        select: {
          masterProfile: { select: { fullName: true } },
          user: { select: { displayName: true } },
        },
      }),
      this.db().departmentActivityResult.findFirst({
        where: {
          tenantId: share.tenantId,
          registrationId: link.registrationId,
        },
        select: { position: true },
      }),
    ]);

    const snapshot = (issue?.variableSnapshot ?? {}) as Record<string, string>;
    const studentName =
      snapshot.student_name ||
      student?.masterProfile?.fullName ||
      student?.user?.displayName ||
      'Student';
    const revoked = issue?.status === 'REVOKED';
    const achievementLabel =
      link.certificateType === 'PARTICIPATION'
        ? 'Participation'
        : positionLabel(result?.position ?? link.certificateType);

    return {
      shareToken,
      studentName,
      activityTitle: link.activity.title,
      activityType: link.activity.activityType,
      activityTypeLabel: this.activityTypeLabel(link.activity.activityType),
      achievementLabel,
      certificateType: link.certificateType,
      departmentName: link.activity.department?.name ?? null,
      eventDate: link.activity.eventDate,
      collegeName: snapshot.college_name ?? null,
      certificateNo: issue?.certificateNo ?? null,
      issuedAt: issue?.issuedAt ?? null,
      revoked,
      verifyUrl: issue?.verificationToken
        ? `${this.webOrigin()}/verify/certificates/${issue.verificationToken}`
        : null,
      hasIntegritySeal: Boolean(
        issue?.contentHash && issue?.integritySignature,
      ),
    };
  }
}
