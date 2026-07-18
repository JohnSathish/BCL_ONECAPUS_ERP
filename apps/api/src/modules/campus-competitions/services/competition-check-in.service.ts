import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { CompetitionMeetsService } from './competition-meets.service';
import { CompetitionRealtimePublisher } from './competition-realtime.publisher';

@Injectable()
export class CompetitionCheckInService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly meets: CompetitionMeetsService,
    private readonly realtime: CompetitionRealtimePublisher,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  private hasPermission(user: JwtUser, slug: string) {
    return user.permissions?.includes(slug) ?? false;
  }

  private requireScore(user: JwtUser) {
    if (
      !this.hasPermission(user, 'campus-competitions:score') &&
      !this.hasPermission(user, 'campus-competitions:manage')
    ) {
      throw new ForbiddenException('Score permission required');
    }
  }

  private normalizeScan(code: string) {
    return code.trim().replace(/\s+/g, '').toUpperCase();
  }

  ensureEntryQrToken(entry: { id: string; qrPassToken?: string | null }) {
    if (entry.qrPassToken) return entry.qrPassToken;
    const token = `CC:${randomUUID().replace(/-/g, '')}`;
    return this.db()
      .competitionEntry.update({
        where: { id: entry.id },
        data: { qrPassToken: token },
      })
      .then((row: { qrPassToken: string }) => row.qrPassToken);
  }

  async ensureEventCheckInToken(user: JwtUser, eventId: string) {
    this.requireScore(user);
    const event = await this.meets.getEvent(user, eventId);
    if (event.checkInToken) return event;
    return this.db().competitionEvent.update({
      where: { id: eventId },
      data: { checkInToken: randomUUID().replace(/-/g, '') },
    });
  }

  async listCheckIns(user: JwtUser, eventId: string) {
    await this.meets.getEvent(user, eventId);
    const entries = await this.db().competitionEntry.findMany({
      where: { tenantId: user.tid, eventId, status: 'REGISTERED' },
      include: {
        house: { select: { id: true, name: true, code: true, color: true } },
        checkIns: true,
      },
      orderBy: { registeredAt: 'asc' },
    });
    return entries.map(
      (e: {
        id: string;
        studentId: string | null;
        bibNumber: string | null;
        qrPassToken: string | null;
        house: unknown;
        checkIns: Array<{
          method: string;
          markedAt: Date;
          scanCode: string | null;
        }>;
      }) => ({
        entryId: e.id,
        studentId: e.studentId,
        bibNumber: e.bibNumber,
        qrPassToken: e.qrPassToken,
        house: e.house,
        checkedIn: (e.checkIns?.length ?? 0) > 0,
        checkIn: e.checkIns?.[0] ?? null,
      }),
    );
  }

  async checkIn(
    user: JwtUser | null,
    eventId: string,
    dto: {
      entryId?: string;
      qrPassToken?: string;
      scanCode?: string;
      rfidNumber?: string;
      method?: string;
    },
    opts?: { publicToken?: string },
  ) {
    const event = await this.resolveEventForCheckIn(
      eventId,
      user,
      opts?.publicToken,
    );
    const entry = await this.resolveEntry(event.tenantId, eventId, dto);
    if (!entry) {
      throw new NotFoundException('No registered entry matched this scan');
    }

    const existing = await this.db().competitionEntryCheckIn.findFirst({
      where: { tenantId: event.tenantId, entryId: entry.id },
    });
    if (existing) {
      return { alreadyCheckedIn: true, checkIn: existing, entry };
    }

    const method =
      dto.method ??
      (dto.qrPassToken || dto.scanCode?.toUpperCase().startsWith('CC:')
        ? 'QR'
        : dto.rfidNumber || dto.scanCode
          ? 'RFID'
          : 'MANUAL');

    const checkIn = await this.db().competitionEntryCheckIn.create({
      data: {
        tenantId: event.tenantId,
        entryId: entry.id,
        eventId,
        method,
        scanCode: (dto.scanCode ?? dto.qrPassToken ?? dto.rfidNumber ?? null)
          ?.toString()
          .slice(0, 120),
        markedById: user?.sub ?? null,
      },
    });

    this.realtime.publish(event.tenantId, 'competition:announcement', {
      meetId: event.meetId,
      eventId,
      message: `Check-in: ${entry.house?.name ?? 'athlete'} ready`,
      severity: 'INFO',
      kind: 'check_in',
      entryId: entry.id,
    });

    return { alreadyCheckedIn: false, checkIn, entry };
  }

  private async resolveEventForCheckIn(
    eventId: string,
    user: JwtUser | null,
    publicToken?: string,
  ) {
    if (user) {
      this.requireScore(user);
      return this.meets.getEvent(user, eventId);
    }
    if (!publicToken?.trim()) {
      throw new ForbiddenException('Check-in token required');
    }
    const event = await this.db().competitionEvent.findFirst({
      where: {
        id: eventId,
        checkInToken: publicToken.trim(),
        deletedAt: null,
      },
      include: { meet: true },
    });
    if (!event) throw new NotFoundException('Event check-in not found');
    return event;
  }

  private async resolveEntry(
    tenantId: string,
    eventId: string,
    dto: {
      entryId?: string;
      qrPassToken?: string;
      scanCode?: string;
      rfidNumber?: string;
    },
  ) {
    if (dto.entryId) {
      return this.db().competitionEntry.findFirst({
        where: {
          id: dto.entryId,
          tenantId,
          eventId,
          status: 'REGISTERED',
        },
        include: {
          house: { select: { id: true, name: true, code: true, color: true } },
        },
      });
    }

    const raw = (
      dto.qrPassToken ??
      dto.scanCode ??
      dto.rfidNumber ??
      ''
    ).trim();
    if (!raw) {
      throw new BadRequestException(
        'entryId, qrPassToken, scanCode, or rfidNumber required',
      );
    }

    if (raw.toUpperCase().startsWith('CC:') || dto.qrPassToken) {
      const token = dto.qrPassToken ?? raw;
      return this.db().competitionEntry.findFirst({
        where: {
          tenantId,
          eventId,
          qrPassToken: token,
          status: 'REGISTERED',
        },
        include: {
          house: { select: { id: true, name: true, code: true, color: true } },
        },
      });
    }

    const uid = this.normalizeScan(raw);
    const student = await this.prisma.student.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { rfidNumber: { equals: uid, mode: 'insensitive' } },
          { enrollmentNumber: { equals: uid, mode: 'insensitive' } },
          { rollNumber: { equals: uid, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    if (!student) return null;

    return this.db().competitionEntry.findFirst({
      where: {
        tenantId,
        eventId,
        studentId: student.id,
        status: 'REGISTERED',
      },
      include: {
        house: { select: { id: true, name: true, code: true, color: true } },
      },
    });
  }

  async publicCheckIn(
    eventId: string,
    token: string,
    dto: {
      entryId?: string;
      qrPassToken?: string;
      scanCode?: string;
      rfidNumber?: string;
    },
  ) {
    return this.checkIn(null, eventId, dto, { publicToken: token });
  }
}
