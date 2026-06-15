import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { paginate } from '../constants/governance.constants';
import type {
  ListQueryDto,
  MarkAttendanceDto,
  OtpAttendanceDto,
  QrAttendanceDto,
} from '../dto/governance.dto';
import { GovernanceMeetingService } from './governance-meeting.service';
import { GovernanceSettingsService } from './governance-settings.service';
import { governanceDb } from './governance-prisma.util';

@Injectable()
export class GovernanceAttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly meetings: GovernanceMeetingService,
    private readonly settings: GovernanceSettingsService,
  ) {}

  private db() {
    return governanceDb(this.prisma);
  }

  async list(tenantId: string, query: ListQueryDto) {
    const { skip, take, page, limit } = paginate(query.page, query.limit);
    const where: Record<string, unknown> = { tenantId };
    if (query.committeeId) {
      where.meeting = { committeeId: query.committeeId };
    }

    const [items, total] = await Promise.all([
      this.db().governanceMeetingAttendance.findMany({
        where,
        skip,
        take,
        orderBy: { markedAt: 'desc' },
        include: {
          meeting: {
            select: {
              title: true,
              meetingDate: true,
              committee: { select: { name: true } },
            },
          },
          member: { select: { displayName: true, role: true } },
        },
      }),
      this.db().governanceMeetingAttendance.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async listForMeeting(tenantId: string, meetingId: string) {
    await this.meetings.getById(tenantId, meetingId);
    return this.db().governanceMeetingAttendance.findMany({
      where: { tenantId, meetingId },
      include: {
        member: { select: { displayName: true, role: true, email: true } },
      },
      orderBy: { displayName: 'asc' },
    });
  }

  async markManual(user: JwtUser, dto: MarkAttendanceDto) {
    const meeting = await this.meetings.getById(user.tid, dto.meetingId);
    if (meeting.status === 'CANCELLED') {
      throw new BadRequestException(
        'Cannot mark attendance for cancelled meeting',
      );
    }

    const existing = await this.db().governanceMeetingAttendance.findFirst({
      where: {
        tenantId: user.tid,
        meetingId: dto.meetingId,
        memberId: dto.memberId ?? undefined,
        userId: dto.userId ?? undefined,
      },
    });

    const data = {
      status: dto.status,
      method: 'MANUAL',
      markedAt: new Date(),
      displayName: dto.displayName,
      memberId: dto.memberId,
      userId: dto.userId,
    };

    if (existing) {
      return this.db().governanceMeetingAttendance.update({
        where: { id: existing.id },
        data,
      });
    }

    return this.db().governanceMeetingAttendance.create({
      data: { tenantId: user.tid, meetingId: dto.meetingId, ...data },
    });
  }

  async markByQr(user: JwtUser, dto: QrAttendanceDto) {
    const cfg = await this.settings.get(user.tid);
    if (!cfg.qrAttendanceEnabled) {
      throw new BadRequestException('QR attendance is disabled');
    }

    const meeting = await this.db().governanceMeeting.findFirst({
      where: { tenantId: user.tid, qrToken: dto.token },
    });
    if (!meeting) throw new NotFoundException('Invalid QR token');

    return this.upsertSelfAttendance(user, meeting.id, dto.memberId, 'QR');
  }

  async markByOtp(user: JwtUser, dto: OtpAttendanceDto) {
    const meeting = await this.meetings.getById(user.tid, dto.meetingId);
    if (!meeting.otpCodeHash) {
      throw new BadRequestException('No OTP configured for this meeting');
    }

    const valid = await bcrypt.compare(dto.otp, meeting.otpCodeHash);
    if (!valid) throw new BadRequestException('Invalid OTP');

    return this.upsertSelfAttendance(user, dto.meetingId, dto.memberId, 'OTP');
  }

  async generateOtp(user: JwtUser, meetingId: string) {
    await this.meetings.getById(user.tid, meetingId);
    const otp = String(randomInt(100000, 999999));
    const otpCodeHash = await bcrypt.hash(otp, 8);
    await this.db().governanceMeeting.update({
      where: { id: meetingId },
      data: { otpCodeHash },
    });
    return { meetingId, otp, expiresInMinutes: 30 };
  }

  private async upsertSelfAttendance(
    user: JwtUser,
    meetingId: string,
    memberId: string | undefined,
    method: string,
  ) {
    let resolvedMemberId = memberId;
    if (!resolvedMemberId) {
      const membership = await this.db().governanceCommitteeMember.findFirst({
        where: {
          tenantId: user.tid,
          userId: user.sub,
          committee: { meetings: { some: { id: meetingId } } },
          status: 'ACTIVE',
        },
      });
      resolvedMemberId = membership?.id;
    }

    const existing = await this.db().governanceMeetingAttendance.findFirst({
      where: {
        tenantId: user.tid,
        meetingId,
        OR: [
          { userId: user.sub },
          ...(resolvedMemberId ? [{ memberId: resolvedMemberId }] : []),
        ],
      },
    });

    const data = {
      status: 'PRESENT',
      method,
      markedAt: new Date(),
      userId: user.sub,
      memberId: resolvedMemberId,
      displayName: user.email,
    };

    if (existing) {
      return this.db().governanceMeetingAttendance.update({
        where: { id: existing.id },
        data,
      });
    }

    return this.db().governanceMeetingAttendance.create({
      data: { tenantId: user.tid, meetingId, ...data },
    });
  }
}
