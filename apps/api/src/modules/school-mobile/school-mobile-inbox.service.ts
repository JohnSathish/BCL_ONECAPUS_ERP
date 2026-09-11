import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { FcmPushService } from '../communication/services/fcm-push.service';
import { SchoolSisService } from '../school-sis/school-sis.service';
import { SchoolMobileAccessService } from './school-mobile-access.service';
import {
  SCHOOL_MOBILE_ANDROID_CHANNEL,
  SCHOOL_MOBILE_PERMISSION_MANAGE,
  type SchoolMobileAudience,
} from './school-mobile.constants';
import type {
  PatchSchoolMobileInboxDto,
  SchoolMobileBroadcastDto,
} from './dto/school-mobile.dto';

@Injectable()
export class SchoolMobileInboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: SchoolMobileAccessService,
    private readonly sis: SchoolSisService,
    private readonly fcm: FcmPushService,
  ) {}

  async list(user: JwtUser) {
    this.access.assertAccess(user);
    const rows = await this.prisma.schoolMobileInbox.findMany({
      where: {
        tenantId: user.tid,
        userId: user.sub,
        archivedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: 80,
    });
    const unreadCount = rows.filter((row) => !row.readAt).length;
    return { unreadCount, items: rows };
  }

  async patch(user: JwtUser, id: string, dto: PatchSchoolMobileInboxDto) {
    this.access.assertAccess(user);
    const row = await this.prisma.schoolMobileInbox.findFirst({
      where: { id, tenantId: user.tid, userId: user.sub },
    });
    if (!row) throw new NotFoundException('Notification not found');
    return this.prisma.schoolMobileInbox.update({
      where: { id: row.id },
      data: {
        ...(dto.read === true ? { readAt: new Date() } : {}),
        ...(dto.read === false ? { readAt: null } : {}),
        ...(dto.archived === true ? { archivedAt: new Date() } : {}),
        ...(dto.archived === false ? { archivedAt: null } : {}),
      },
    });
  }

  async markAllRead(user: JwtUser) {
    this.access.assertAccess(user);
    await this.prisma.schoolMobileInbox.updateMany({
      where: { tenantId: user.tid, userId: user.sub, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async listBroadcasts(tenantId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    return this.prisma.schoolMobileBroadcast.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
  }

  async broadcast(user: JwtUser, dto: SchoolMobileBroadcastDto) {
    if (!user.permissions?.includes(SCHOOL_MOBILE_PERMISSION_MANAGE)) {
      this.access.assertAccess(user);
    }
    await this.sis.assertSecondarySisTenant(user.tid);
    const userIds = await this.audienceUserIds(
      user.tid,
      dto.audience,
      dto.audienceFilter ?? {},
    );
    const type = dto.type?.trim() || 'announcement';
    const deepLink = dto.deepLink?.trim() || null;
    for (const userId of userIds) {
      await this.prisma.schoolMobileInbox.create({
        data: {
          id: randomUUID(),
          tenantId: user.tid,
          userId,
          title: dto.title.trim(),
          body: dto.body.trim(),
          imageUrl: dto.imageUrl?.trim() || null,
          type,
          deepLink,
          relatedId: dto.audienceFilter?.relatedId ?? null,
          audience: dto.audience,
        },
      });
    }
    const devices = await this.prisma.schoolMobileDevice.findMany({
      where: {
        tenantId: user.tid,
        userId: { in: userIds },
        revokedAt: null,
        pushToken: { not: null },
      },
    });
    const tokens = devices
      .map((row) => row.pushToken)
      .filter((token): token is string => Boolean(token));
    const push = tokens.length
      ? await this.fcm.sendToTokens(tokens, {
          title: dto.title.trim(),
          body: dto.body.trim(),
          imageUrl: dto.imageUrl?.trim(),
          androidChannelId: SCHOOL_MOBILE_ANDROID_CHANNEL,
          data: {
            type,
            deepLink: deepLink ?? '',
            relatedId: dto.audienceFilter?.relatedId ?? '',
          },
        })
      : {
          ok: true,
          successCount: 0,
          failureCount: 0,
          invalidTokens: [] as string[],
        };
    if ('invalidTokens' in push && push.invalidTokens?.length) {
      await this.prisma.schoolMobileDevice.updateMany({
        where: { tenantId: user.tid, pushToken: { in: push.invalidTokens } },
        data: { pushToken: null },
      });
    }
    return this.prisma.schoolMobileBroadcast.create({
      data: {
        id: randomUUID(),
        tenantId: user.tid,
        createdByUserId: user.sub,
        title: dto.title.trim(),
        body: dto.body.trim(),
        imageUrl: dto.imageUrl?.trim() || null,
        type,
        deepLink,
        audience: dto.audience,
        audienceFilter: dto.audienceFilter ?? {},
        successCount: push.successCount ?? 0,
        failureCount: push.failureCount ?? 0,
        status: push.ok === false ? 'FAILED' : 'SENT',
      },
    });
  }

  private async audienceUserIds(
    tenantId: string,
    audience: SchoolMobileAudience,
    filter: Record<string, string>,
  ): Promise<string[]> {
    if (audience === 'user' && filter.userId) return [filter.userId];
    const devices = await this.prisma.schoolMobileDevice.findMany({
      where: {
        tenantId,
        revokedAt: null,
        ...(audience === 'students' ? { persona: 'student' } : {}),
        ...(audience === 'parents' ? { persona: 'parent' } : {}),
        ...(audience === 'teachers' ? { persona: 'teacher' } : {}),
        ...(audience === 'admins' ? { persona: 'admin' } : {}),
      },
      select: { userId: true },
    });
    const ids = new Set(devices.map((row) => row.userId));
    if (audience === 'section' && filter.sectionId) {
      const year = await this.sis.currentYear(tenantId);
      const enrollments = await this.prisma.schoolEnrollment.findMany({
        where: {
          tenantId,
          sectionId: filter.sectionId,
          academicYearId: year.id,
          status: 'ACTIVE',
          deletedAt: null,
        },
        select: { studentId: true },
      });
      const accounts = await this.prisma.schoolPersonAccount.findMany({
        where: {
          tenantId,
          studentId: { in: enrollments.map((row) => row.studentId) },
        },
        select: { userId: true },
      });
      return [...new Set(accounts.map((row) => row.userId))];
    }
    if (audience === 'class' && filter.gradeId) {
      const year = await this.sis.currentYear(tenantId);
      const sections = await this.prisma.schoolSection.findMany({
        where: {
          tenantId,
          gradeId: filter.gradeId,
          academicYearId: year.id,
          deletedAt: null,
        },
        select: { id: true },
      });
      const enrollments = await this.prisma.schoolEnrollment.findMany({
        where: {
          tenantId,
          sectionId: { in: sections.map((row) => row.id) },
          academicYearId: year.id,
          status: 'ACTIVE',
          deletedAt: null,
        },
        select: { studentId: true },
      });
      const accounts = await this.prisma.schoolPersonAccount.findMany({
        where: {
          tenantId,
          studentId: { in: enrollments.map((row) => row.studentId) },
        },
        select: { userId: true },
      });
      return [...new Set(accounts.map((row) => row.userId))];
    }
    return [...ids];
  }
}
