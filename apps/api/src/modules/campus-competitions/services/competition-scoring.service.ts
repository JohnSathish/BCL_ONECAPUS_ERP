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
import { CertificateIntegrityService } from '../../certificates/certificate-integrity.service';
import { CertificateVariableService } from '../../certificates/certificate-variable.service';
import { CommunicationTriggerService } from '../../communication/services/communication-trigger.service';
import {
  metalForPosition,
  pointsForPosition,
} from '../domain/competition.constants';
import type { UpsertResultsDto } from '../dto/campus-competitions.dto';
import { CompetitionHousesService } from './competition-houses.service';
import { CompetitionMeetsService } from './competition-meets.service';
import { CompetitionRealtimePublisher } from './competition-realtime.publisher';

@Injectable()
export class CompetitionScoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly meets: CompetitionMeetsService,
    private readonly houses: CompetitionHousesService,
    private readonly variables: CertificateVariableService,
    private readonly documents: CertificateDocumentService,
    private readonly integrity: CertificateIntegrityService,
    private readonly realtime: CompetitionRealtimePublisher,
    @Optional() private readonly communication?: CommunicationTriggerService,
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

  private requireCertificates(user: JwtUser) {
    if (
      !this.hasPermission(user, 'campus-competitions:certificates') &&
      !this.hasPermission(user, 'campus-competitions:manage')
    ) {
      throw new ForbiddenException('Certificates permission required');
    }
  }

  private requireApprove(user: JwtUser) {
    if (
      !this.hasPermission(user, 'campus-competitions:approve') &&
      !this.hasPermission(user, 'campus-competitions:manage')
    ) {
      throw new ForbiddenException('Approve permission required');
    }
  }

  async houseBalance(tenantId: string, meetId: string, houseId: string) {
    const last = await this.db().housePointLedger.findFirst({
      where: { tenantId, meetId, houseId },
      orderBy: { createdAt: 'desc' },
    });
    return last?.balanceAfter ?? 0;
  }

  async leaderboard(user: JwtUser, meetId: string) {
    await this.meets.getMeet(user, meetId);
    const houses = await this.db().competitionHouse.findMany({
      where: { tenantId: user.tid, status: 'ACTIVE', deletedAt: null },
      select: { id: true, name: true, code: true, color: true },
    });
    const rows = [];
    for (const house of houses) {
      const points = await this.houseBalance(user.tid, meetId, house.id);
      const medals = await this.db().competitionMedal.groupBy({
        by: ['metal'],
        where: { tenantId: user.tid, meetId, houseId: house.id },
        _count: true,
      });
      const tally = { gold: 0, silver: 0, bronze: 0 };
      for (const m of medals) {
        if (m.metal === 'GOLD') tally.gold = m._count;
        if (m.metal === 'SILVER') tally.silver = m._count;
        if (m.metal === 'BRONZE') tally.bronze = m._count;
      }
      rows.push({ ...house, points, medals: tally });
    }
    rows.sort((a, b) => b.points - a.points || b.medals.gold - a.medals.gold);
    return rows.map((r, i) => ({ ...r, rank: i + 1 }));
  }

  async medalTally(user: JwtUser, meetId: string) {
    return this.leaderboard(user, meetId);
  }

  async myMedals(user: JwtUser, meetId?: string) {
    const studentId = await this.houses.resolveStudentId(user);
    return this.db().competitionMedal.findMany({
      where: {
        tenantId: user.tid,
        studentId,
        ...(meetId ? { meetId } : {}),
      },
      include: {
        house: { select: { id: true, name: true, code: true, color: true } },
        meet: {
          select: { id: true, name: true, meetType: true, status: true },
        },
        event: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  listResults(user: JwtUser, eventId: string) {
    return this.db().competitionResult.findMany({
      where: { tenantId: user.tid, eventId },
      include: {
        entry: {
          include: {
            house: {
              select: { id: true, name: true, code: true, color: true },
            },
          },
        },
        team: true,
      },
      orderBy: { position: 'asc' },
    });
  }

  async upsertResults(user: JwtUser, eventId: string, dto: UpsertResultsDto) {
    this.requireScore(user);
    const event = await this.meets.getEvent(user, eventId);
    const created = [];

    for (const item of dto.results) {
      if (!item.entryId && !item.teamId) {
        throw new BadRequestException('entryId or teamId required');
      }
      const existing = await this.db().competitionResult.findFirst({
        where: {
          tenantId: user.tid,
          eventId,
          ...(item.entryId
            ? { entryId: item.entryId }
            : { teamId: item.teamId }),
          status: { in: ['DRAFT', 'PENDING_APPROVAL'] },
        },
      });
      if (existing) {
        created.push(
          await this.db().competitionResult.update({
            where: { id: existing.id },
            data: {
              position: item.position,
              metricValue: item.metricValue ?? null,
              metricUnit: item.metricUnit ?? null,
              remarks: item.remarks?.trim() ?? '',
              status: 'DRAFT',
              recordedById: user.sub,
            },
          }),
        );
      } else {
        created.push(
          await this.db().competitionResult.create({
            data: {
              tenantId: user.tid,
              eventId,
              entryId: item.entryId ?? null,
              teamId: item.teamId ?? null,
              position: item.position,
              metricValue: item.metricValue ?? null,
              metricUnit: item.metricUnit ?? null,
              remarks: item.remarks?.trim() ?? '',
              status: 'DRAFT',
              recordedById: user.sub,
            },
          }),
        );
      }
    }

    if (dto.publish) {
      const meet = await this.db().competitionMeet.findFirst({
        where: { id: event.meetId, tenantId: user.tid },
      });
      if (meet?.requireResultApproval) {
        return this.submitResultsForApproval(user, eventId);
      }
      return this.publishEventResults(user, eventId);
    }
    return { results: created, published: false, meetId: event.meetId };
  }

  async submitResultsForApproval(user: JwtUser, eventId: string) {
    this.requireScore(user);
    const event = await this.meets.getEvent(user, eventId);
    const drafts = await this.db().competitionResult.updateMany({
      where: { tenantId: user.tid, eventId, status: 'DRAFT' },
      data: { status: 'PENDING_APPROVAL' },
    });
    if (!drafts.count) {
      throw new BadRequestException('No draft results to submit');
    }
    await this.db().competitionAuditLog.create({
      data: {
        tenantId: user.tid,
        meetId: event.meetId,
        actorId: user.sub,
        entityType: 'event',
        entityId: eventId,
        action: 'results.submitted',
        after: { count: drafts.count },
      },
    });
    this.realtime.publish(user.tid, 'competition:result', {
      meetId: event.meetId,
      eventId,
      status: 'PENDING_APPROVAL',
    });
    return { submitted: drafts.count, published: false };
  }

  async approveAndPublishResults(user: JwtUser, eventId: string) {
    this.requireApprove(user);
    return this.publishEventResults(user, eventId, {
      fromStatuses: ['PENDING_APPROVAL', 'DRAFT'],
      skipScoreCheck: true,
    });
  }

  async liveBoard(user: JwtUser, meetId: string) {
    const meet = await this.meets.getMeet(user, meetId);
    return this.buildLiveBoard(user.tid, meet);
  }

  async publicLiveBoard(displayToken: string) {
    const meet = await this.db().competitionMeet.findFirst({
      where: { displayToken, deletedAt: null },
      include: {
        events: {
          where: { deletedAt: null },
          orderBy: { scheduledAt: 'asc' },
          select: {
            id: true,
            name: true,
            status: true,
            scheduledAt: true,
            entryMode: true,
          },
        },
      },
    });
    if (!meet) throw new NotFoundException('Display board not found');
    return this.buildLiveBoard(meet.tenantId, meet);
  }

  private async buildLiveBoard(
    tenantId: string,
    meet: {
      id: string;
      name: string;
      meetType: string;
      status: string;
      venue: string;
      theme: string;
      leaderboardVersion: number;
      liveEventId?: string | null;
      displayToken?: string | null;
      events?: Array<{
        id: string;
        name: string;
        status: string;
        scheduledAt: Date | null;
        entryMode: string;
      }>;
    },
  ) {
    const houses = await this.db().competitionHouse.findMany({
      where: { tenantId, status: 'ACTIVE', deletedAt: null },
      select: { id: true, name: true, code: true, color: true },
    });
    const board = [];
    for (const house of houses) {
      const points = await this.houseBalance(tenantId, meet.id, house.id);
      const medals = await this.db().competitionMedal.groupBy({
        by: ['metal'],
        where: { tenantId, meetId: meet.id, houseId: house.id },
        _count: true,
      });
      const tally = { gold: 0, silver: 0, bronze: 0 };
      for (const m of medals) {
        if (m.metal === 'GOLD') tally.gold = m._count;
        if (m.metal === 'SILVER') tally.silver = m._count;
        if (m.metal === 'BRONZE') tally.bronze = m._count;
      }
      board.push({ ...house, points, medals: tally });
    }
    board.sort((a, b) => b.points - a.points || b.medals.gold - a.medals.gold);
    const ranked = board.map((r, i) => ({ ...r, rank: i + 1 }));

    let liveEvent =
      (meet.events ?? []).find((e) => e.id === meet.liveEventId) ?? null;
    if (!liveEvent && meet.liveEventId) {
      liveEvent = await this.db().competitionEvent.findFirst({
        where: { id: meet.liveEventId, tenantId, deletedAt: null },
        select: {
          id: true,
          name: true,
          status: true,
          scheduledAt: true,
          entryMode: true,
        },
      });
    }

    const recentResults = await this.db().competitionResult.findMany({
      where: {
        tenantId,
        status: 'PUBLISHED',
        event: { meetId: meet.id },
      },
      include: {
        event: { select: { id: true, name: true } },
        entry: {
          include: {
            house: { select: { name: true, code: true, color: true } },
          },
        },
      },
      orderBy: { publishedAt: 'desc' },
      take: 8,
    });

    const announcements = await this.db().competitionAnnouncement.findMany({
      where: { tenantId, meetId: meet.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const events = meet.events ?? [];
    const nextEvent =
      events.find(
        (e) =>
          e.id !== meet.liveEventId &&
          e.scheduledAt &&
          new Date(e.scheduledAt) > new Date(),
      ) ??
      events.find((e) => e.id !== meet.liveEventId) ??
      null;

    return {
      meet: {
        id: meet.id,
        name: meet.name,
        meetType: meet.meetType,
        status: meet.status,
        venue: meet.venue,
        theme: meet.theme,
        leaderboardVersion: meet.leaderboardVersion,
        displayToken: meet.displayToken ?? null,
      },
      liveEvent,
      nextEvent,
      leaderboard: ranked,
      recentResults: recentResults.map(
        (r: {
          position: number;
          metricValue: string | null;
          event: { id: string; name: string };
          entry: {
            house: { name: string; code: string; color: string } | null;
          } | null;
        }) => ({
          position: r.position,
          metricValue: r.metricValue,
          eventName: r.event.name,
          eventId: r.event.id,
          houseName: r.entry?.house?.name ?? null,
          houseCode: r.entry?.house?.code ?? null,
          houseColor: r.entry?.house?.color ?? null,
        }),
      ),
      announcements,
      refreshedAt: new Date().toISOString(),
    };
  }

  async publishEventResults(
    user: JwtUser,
    eventId: string,
    opts?: { fromStatuses?: string[]; skipScoreCheck?: boolean },
  ) {
    if (!opts?.skipScoreCheck) {
      this.requireScore(user);
    }
    const event = await this.meets.getEvent(user, eventId);
    const meetId = event.meetId;
    const fromStatuses = opts?.fromStatuses ?? ['DRAFT'];
    const rules = await this.db().competitionPointRuleSet.findFirst({
      where: { meetId, tenantId: user.tid },
    });
    if (!rules) throw new NotFoundException('Point rules missing');

    const drafts = await this.db().competitionResult.findMany({
      where: {
        tenantId: user.tid,
        eventId,
        status: { in: fromStatuses },
      },
      include: {
        entry: true,
        team: true,
      },
    });
    if (!drafts.length) {
      throw new BadRequestException('No results ready to publish');
    }

    // Reverse prior published ledger/medals for this event (compensating entries)
    const priorLedger = await this.db().housePointLedger.findMany({
      where: {
        tenantId: user.tid,
        meetId,
        eventId,
        reason: { startsWith: 'EVENT_' },
      },
    });
    for (const row of priorLedger) {
      const balance = await this.houseBalance(user.tid, meetId, row.houseId);
      await this.db().housePointLedger.create({
        data: {
          tenantId: user.tid,
          meetId,
          houseId: row.houseId,
          eventId,
          resultId: row.resultId,
          delta: -row.delta,
          reason: 'EVENT_REVERSAL',
          balanceAfter: balance - row.delta,
          metadata: { reversedLedgerId: row.id },
        },
      });
    }
    await this.db().competitionMedal.deleteMany({
      where: { tenantId: user.tid, meetId, eventId },
    });

    const published = [];
    for (const result of drafts) {
      const houseId = result.entry?.houseId ?? result.team?.houseId;
      if (!houseId) continue;

      const updated = await this.db().competitionResult.update({
        where: { id: result.id },
        data: { status: 'PUBLISHED', publishedAt: new Date() },
      });
      published.push(updated);

      const points = pointsForPosition(result.position, rules);
      const balance = await this.houseBalance(user.tid, meetId, houseId);
      await this.db().housePointLedger.create({
        data: {
          tenantId: user.tid,
          meetId,
          houseId,
          eventId,
          resultId: result.id,
          delta: points,
          reason: `EVENT_PLACE_${result.position}`,
          balanceAfter: balance + points,
        },
      });

      const metal = metalForPosition(result.position);
      if (metal) {
        await this.db().competitionMedal.create({
          data: {
            tenantId: user.tid,
            meetId,
            eventId,
            houseId,
            studentId: result.entry?.studentId ?? null,
            metal,
            awardType: 'PLACE',
            resultId: result.id,
          },
        });
      }
    }

    // Participation points for registered entries without place points already
    const entries = await this.db().competitionEntry.findMany({
      where: { tenantId: user.tid, eventId, status: 'REGISTERED' },
    });
    const placedEntryIds = new Set(
      drafts.map((d: { entryId: string | null }) => d.entryId).filter(Boolean),
    );
    for (const entry of entries) {
      if (placedEntryIds.has(entry.id)) continue;
      if (rules.participationPoints <= 0) continue;
      const balance = await this.houseBalance(user.tid, meetId, entry.houseId);
      await this.db().housePointLedger.create({
        data: {
          tenantId: user.tid,
          meetId,
          houseId: entry.houseId,
          eventId,
          delta: rules.participationPoints,
          reason: 'EVENT_PARTICIPATION',
          balanceAfter: balance + rules.participationPoints,
          metadata: { entryId: entry.id },
        },
      });
    }

    const meet = await this.db().competitionMeet.update({
      where: { id: meetId },
      data: { leaderboardVersion: { increment: 1 } },
    });

    const board = await this.leaderboard(user, meetId);
    this.realtime.publish(user.tid, 'competition:result', {
      meetId,
      eventId,
      leaderboardVersion: meet.leaderboardVersion,
    });
    this.realtime.publish(user.tid, 'competition:leaderboard', {
      meetId,
      leaderboardVersion: meet.leaderboardVersion,
      board,
    });
    this.realtime.publish(user.tid, 'competition:medals', {
      meetId,
      leaderboardVersion: meet.leaderboardVersion,
      board,
    });

    await this.db().competitionAuditLog.create({
      data: {
        tenantId: user.tid,
        meetId,
        actorId: user.sub,
        entityType: 'event',
        entityId: eventId,
        action: 'results.published',
        after: { count: published.length },
      },
    });

    void this.notifyResultsPublished(
      user.tid,
      meetId,
      eventId,
      event.name,
    ).catch(() => undefined);

    return {
      published: published.length,
      leaderboardVersion: meet.leaderboardVersion,
      leaderboard: board,
    };
  }

  private async notifyResultsPublished(
    tenantId: string,
    meetId: string,
    eventId: string,
    eventName: string,
  ) {
    if (!this.communication) return;

    const entries = await this.db().competitionEntry.findMany({
      where: { tenantId, eventId, status: 'REGISTERED' },
      select: { studentId: true },
    });
    const studentIds = [
      ...new Set(
        entries
          .map((e: { studentId: string | null }) => e.studentId)
          .filter(Boolean),
      ),
    ] as string[];
    if (!studentIds.length) return;

    const students = await this.prisma.student.findMany({
      where: { tenantId, id: { in: studentIds }, deletedAt: null },
      include: {
        user: {
          select: { id: true, email: true, displayName: true, isActive: true },
        },
        masterProfile: { select: { fullName: true, email: true } },
      },
    });

    const meet = await this.db().competitionMeet.findFirst({
      where: { id: meetId, tenantId },
      select: { name: true },
    });
    const institutionName =
      await this.communication.getInstitutionName(tenantId);

    await this.communication.triggerBulk({
      tenantId,
      templateCode: 'CAMPUS_COMPETITION_RESULTS_PUBLISHED',
      triggerKey: `campus.competition.results_published.${eventId}`,
      entityType: 'competition_event_student',
      channels: ['EMAIL', 'IN_APP', 'PUSH'],
      recipients: students
        .filter((s) => s.user?.isActive && s.userId)
        .map((s) => {
          const displayName =
            s.masterProfile?.fullName ?? s.user.displayName ?? s.user.email;
          return {
            entityId: s.id,
            recipient: {
              recipientType: 'STUDENT' as const,
              userId: s.userId!,
              studentId: s.id,
              displayName,
              email: s.masterProfile?.email ?? s.user.email,
            },
            variables: {
              institution_name: institutionName,
              student_name: displayName ?? 'Student',
              meet_name: meet?.name ?? 'Campus Competition',
              event_name: eventName,
              login_url: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
            },
          };
        }),
    });
  }

  private async resolveParticipationCategory(tenantId: string) {
    let category = await this.db().certificateCategory.findFirst({
      where: {
        tenantId,
        code: { in: ['PARTICIPATION', 'SPORTS', 'GENERAL'] },
        deletedAt: null,
      },
    });
    if (!category) {
      category = await this.db().certificateCategory.findFirst({
        where: { tenantId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      });
    }
    if (!category) {
      throw new BadRequestException(
        'No certificate category configured for competitions',
      );
    }
    return category;
  }

  private placeCertType(position: number) {
    if (position === 1) return 'FIRST';
    if (position === 2) return 'SECOND';
    if (position === 3) return 'THIRD';
    return 'PARTICIPATION';
  }

  async issueParticipationCertificates(user: JwtUser, meetId: string) {
    this.requireCertificates(user);
    const meet = await this.meets.getMeet(user, meetId);
    const entries = await this.db().competitionEntry.findMany({
      where: {
        tenantId: user.tid,
        status: 'REGISTERED',
        event: { meetId, deletedAt: null },
        studentId: { not: null },
      },
      include: { event: true, house: true },
    });

    const category = await this.resolveParticipationCategory(user.tid);
    let issued = 0;
    for (const entry of entries) {
      const existing = await this.db().competitionCertificateLink.findFirst({
        where: {
          tenantId: user.tid,
          meetId,
          entryId: entry.id,
          certificateType: 'PARTICIPATION',
        },
      });
      if (existing) continue;
      await this.issueOneCertificate(user, {
        meet,
        categoryId: category.id,
        studentId: entry.studentId,
        eventName: entry.event.name,
        houseName: entry.house.name,
        certificateType: 'PARTICIPATION',
        title: 'CERTIFICATE OF PARTICIPATION',
        entryId: entry.id,
        eventId: entry.eventId,
      });
      issued += 1;
    }
    return { issued };
  }

  async issuePlaceCertificates(user: JwtUser, meetId: string) {
    this.requireCertificates(user);
    const meet = await this.meets.getMeet(user, meetId);
    const results = await this.db().competitionResult.findMany({
      where: {
        tenantId: user.tid,
        status: 'PUBLISHED',
        position: { in: [1, 2, 3] },
        event: { meetId },
        entry: { studentId: { not: null } },
      },
      include: {
        entry: { include: { house: true } },
        event: true,
      },
    });
    const category = await this.resolveParticipationCategory(user.tid);
    let issued = 0;
    for (const result of results) {
      const certType = this.placeCertType(result.position);
      const existing = await this.db().competitionCertificateLink.findFirst({
        where: {
          tenantId: user.tid,
          meetId,
          resultId: result.id,
          certificateType: certType,
        },
      });
      if (existing) continue;
      await this.issueOneCertificate(user, {
        meet,
        categoryId: category.id,
        studentId: result.entry.studentId,
        eventName: result.event.name,
        houseName: result.entry.house.name,
        certificateType: certType,
        title:
          result.position === 1
            ? 'CERTIFICATE OF MERIT — FIRST PLACE'
            : result.position === 2
              ? 'CERTIFICATE OF MERIT — SECOND PLACE'
              : 'CERTIFICATE OF MERIT — THIRD PLACE',
        entryId: result.entryId,
        eventId: result.eventId,
        resultId: result.id,
        position: result.position,
      });
      issued += 1;
    }
    return { issued };
  }

  private async issueOneCertificate(
    user: JwtUser,
    input: {
      meet: { id: string; name: string };
      categoryId: string;
      studentId: string;
      eventName: string;
      houseName: string;
      certificateType: string;
      title: string;
      entryId?: string | null;
      eventId?: string | null;
      resultId?: string | null;
      position?: number;
    },
  ) {
    const verificationToken = randomUUID();
    const certificateNo = `CC-${input.meet.id.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const variableSnapshot = await this.variables.buildStudentVariables(
      user.tid,
      input.studentId,
      {
        programme: input.meet.name,
        activity_title: input.eventName,
        meet_name: input.meet.name,
        house_name: input.houseName,
        certificate_number: certificateNo,
        position: input.position ? String(input.position) : '',
      },
      {
        verificationToken,
        certificateNo,
        categoryCode: 'PARTICIPATION',
      },
    );

    const html = this.variables.renderTemplate(
      `<html><body style="font-family:Georgia,serif;text-align:center;padding:48px">
        <h1>{{college_name}}</h1>
        <h2>${input.title}</h2>
        <p>This certifies that <strong>{{student_name}}</strong> of <strong>${input.houseName}</strong>
        participated in <strong>${input.eventName}</strong> during <strong>${input.meet.name}</strong>.</p>
        <p>Certificate No. ${certificateNo}</p>
        <p>{{qr_code}}</p>
      </body></html>`,
      variableSnapshot,
    );

    const issue = await this.db().certificateIssue.create({
      data: {
        tenantId: user.tid,
        categoryId: input.categoryId,
        studentId: input.studentId,
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
      await this.integrity.sealIssuedDocument({
        tenantId: user.tid,
        issueId: issue.id,
        certificateNo,
        verificationToken,
        publicPath: document.primaryPath,
        actorId: user.sub,
        writeAudit: true,
        metadata: {
          source: 'campus_competitions',
          meetId: input.meet.id,
          certificateType: input.certificateType,
        },
      });
    } catch {
      await this.integrity.sealIssuedDocument({
        tenantId: user.tid,
        issueId: issue.id,
        certificateNo,
        verificationToken,
        publicPath: null,
        actorId: user.sub,
        writeAudit: true,
        metadata: {
          source: 'campus_competitions',
          meetId: input.meet.id,
          pdfSkipped: true,
        },
      });
    }

    await this.db().competitionCertificateLink.create({
      data: {
        tenantId: user.tid,
        meetId: input.meet.id,
        eventId: input.eventId ?? null,
        entryId: input.entryId ?? null,
        resultId: input.resultId ?? null,
        certificateIssueId: issue.id,
        certificateType: input.certificateType,
      },
    });

    return issue;
  }

  async issueChampionHouseCertificate(
    user: JwtUser,
    input: {
      meet: { id: string; name: string };
      houseId: string;
      houseName: string;
      studentId: string;
      academicYearId: string;
    },
  ) {
    this.requireCertificates(user);
    const dup = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT ccl.id
      FROM academic.competition_certificate_links ccl
      INNER JOIN academic.certificate_issues ci ON ci.id = ccl.certificate_issue_id
      WHERE ccl.tenant_id = ${user.tid}::uuid
        AND ccl.meet_id = ${input.meet.id}::uuid
        AND ccl.certificate_type = 'CHAMPION_HOUSE'
        AND ci.student_id = ${input.studentId}::uuid
      LIMIT 1
    `;
    if (dup.length) return { skipped: true };

    const category = await this.resolveParticipationCategory(user.tid);
    return this.issueOneCertificate(user, {
      meet: input.meet,
      categoryId: category.id,
      studentId: input.studentId,
      eventName: 'House of the Year',
      houseName: input.houseName,
      certificateType: 'CHAMPION_HOUSE',
      title: 'HOUSE OF THE YEAR',
    });
  }

  async reportsSummary(user: JwtUser, meetId: string) {
    const meet = await this.meets.getMeet(user, meetId);
    const leaderboard = await this.leaderboard(user, meetId);
    const events = await this.db().competitionEvent.findMany({
      where: { tenantId: user.tid, meetId, deletedAt: null },
      select: { id: true },
    });
    const eventIds = events.map((e: { id: string }) => e.id);
    const participants = await this.db().competitionEntry.count({
      where: {
        tenantId: user.tid,
        status: 'REGISTERED',
        event: { meetId },
      },
    });
    const publishedResults = await this.db().competitionResult.count({
      where: {
        tenantId: user.tid,
        status: 'PUBLISHED',
        event: { meetId },
      },
    });
    const checkedIn = eventIds.length
      ? await this.db().competitionEntryCheckIn.count({
          where: { tenantId: user.tid, eventId: { in: eventIds } },
        })
      : 0;
    const volunteers = await this.db().competitionMeetVolunteer.count({
      where: { tenantId: user.tid, meetId },
    });
    const fixtures = eventIds.length
      ? await this.db().competitionFixture.count({
          where: { tenantId: user.tid, eventId: { in: eventIds } },
        })
      : 0;
    const medals = await this.db().competitionMedal.groupBy({
      by: ['metal'],
      where: { tenantId: user.tid, meetId },
      _count: { _all: true },
    });
    const medalCounts = { gold: 0, silver: 0, bronze: 0 };
    for (const row of medals as Array<{
      metal: string;
      _count: { _all: number };
    }>) {
      const key = row.metal?.toLowerCase?.() as 'gold' | 'silver' | 'bronze';
      if (key in medalCounts) medalCounts[key] = row._count._all;
    }

    return {
      meet: { id: meet.id, name: meet.name, status: meet.status },
      events: events.length,
      participants,
      publishedResults,
      checkedIn,
      checkInRate:
        participants > 0
          ? Math.round((checkedIn / participants) * 1000) / 10
          : 0,
      volunteers,
      fixtures,
      medals: medalCounts,
      leaderboardVersion: meet.leaderboardVersion,
      leaderboard,
    };
  }

  async reportsCsv(user: JwtUser, meetId: string) {
    const board = await this.leaderboard(user, meetId);
    const header = 'Rank,House,Code,Points,Gold,Silver,Bronze\n';
    const lines = board
      .map(
        (r) =>
          `${r.rank},"${r.name}",${r.code},${r.points},${r.medals.gold},${r.medals.silver},${r.medals.bronze}`,
      )
      .join('\n');
    return header + lines + '\n';
  }

  async heatSheets(user: JwtUser, meetId: string) {
    await this.meets.getMeet(user, meetId);
    const events = await this.db().competitionEvent.findMany({
      where: { tenantId: user.tid, meetId, deletedAt: null },
      orderBy: [{ scheduledAt: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        entryMode: true,
        scheduledAt: true,
        venue: true,
        status: true,
      },
    });
    const sheets = [];
    for (const event of events) {
      const [fixtures, entries] = await Promise.all([
        this.db().competitionFixture.findMany({
          where: { tenantId: user.tid, eventId: event.id },
          orderBy: [
            { heatNumber: 'asc' },
            { bracketSlot: 'asc' },
            { createdAt: 'asc' },
          ],
        }),
        this.db().competitionEntry.findMany({
          where: {
            tenantId: user.tid,
            eventId: event.id,
            status: 'REGISTERED',
          },
          include: {
            house: {
              select: { id: true, name: true, code: true, color: true },
            },
            team: { select: { id: true, name: true } },
          },
          orderBy: { registeredAt: 'asc' },
        }),
      ]);
      const byId = new Map(entries.map((e: { id: string }) => [e.id, e]));
      sheets.push({
        event,
        fixtures: fixtures.map(
          (fx: {
            id: string;
            round: string;
            heatNumber?: number | null;
            bracketSlot?: number | null;
            scheduledAt?: Date | null;
            status: string;
            entryIds: unknown;
          }) => {
            const ids = Array.isArray(fx.entryIds)
              ? (fx.entryIds as string[])
              : [];
            return {
              id: fx.id,
              round: fx.round,
              heatNumber: fx.heatNumber,
              bracketSlot: fx.bracketSlot,
              scheduledAt: fx.scheduledAt,
              status: fx.status,
              entries: ids.map((id, idx) => {
                const en = byId.get(id) as
                  | {
                      id: string;
                      bibNumber?: string | null;
                      lane?: number | null;
                      house?: { name: string; code: string } | null;
                      team?: { name: string } | null;
                    }
                  | undefined;
                return {
                  entryId: id,
                  lane: en?.lane ?? idx + 1,
                  bibNumber: en?.bibNumber ?? null,
                  label: en?.team?.name ?? en?.house?.name ?? id.slice(0, 8),
                  houseCode: en?.house?.code ?? null,
                };
              }),
            };
          },
        ),
      });
    }
    return { meetId, sheets };
  }

  async checkInReport(user: JwtUser, meetId: string) {
    await this.meets.getMeet(user, meetId);
    const events = await this.db().competitionEvent.findMany({
      where: { tenantId: user.tid, meetId, deletedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    const rows = [];
    let totalEntries = 0;
    let totalCheckedIn = 0;
    for (const event of events) {
      const entries = await this.db().competitionEntry.findMany({
        where: {
          tenantId: user.tid,
          eventId: event.id,
          status: 'REGISTERED',
        },
        include: {
          house: { select: { name: true, code: true } },
          team: { select: { name: true } },
          checkIns: true,
        },
        orderBy: { registeredAt: 'asc' },
      });
      const checkedIn = entries.filter(
        (e: { checkIns: unknown[] }) => (e.checkIns?.length ?? 0) > 0,
      ).length;
      totalEntries += entries.length;
      totalCheckedIn += checkedIn;
      rows.push({
        eventId: event.id,
        eventName: event.name,
        entries: entries.length,
        checkedIn,
        rate:
          entries.length > 0
            ? Math.round((checkedIn / entries.length) * 1000) / 10
            : 0,
        details: entries.map(
          (e: {
            id: string;
            bibNumber?: string | null;
            house?: { name: string; code: string } | null;
            team?: { name: string } | null;
            checkIns: Array<{ method: string; markedAt: Date }>;
          }) => ({
            entryId: e.id,
            bibNumber: e.bibNumber,
            label: e.team?.name ?? e.house?.name ?? e.id.slice(0, 8),
            houseCode: e.house?.code ?? null,
            checkedIn: (e.checkIns?.length ?? 0) > 0,
            method: e.checkIns?.[0]?.method ?? null,
            markedAt: e.checkIns?.[0]?.markedAt ?? null,
          }),
        ),
      });
    }
    return {
      meetId,
      totalEntries,
      totalCheckedIn,
      rate:
        totalEntries > 0
          ? Math.round((totalCheckedIn / totalEntries) * 1000) / 10
          : 0,
      events: rows,
    };
  }

  async checkInReportCsv(user: JwtUser, meetId: string) {
    const report = await this.checkInReport(user, meetId);
    const header =
      'Event,Entries,CheckedIn,Rate%,Bib,House,Label,CheckedIn,Method,MarkedAt\n';
    const lines: string[] = [];
    for (const ev of report.events) {
      if (!ev.details.length) {
        lines.push(
          `"${ev.eventName}",${ev.entries},${ev.checkedIn},${ev.rate},,,,,,`,
        );
        continue;
      }
      for (const d of ev.details) {
        lines.push(
          `"${ev.eventName}",${ev.entries},${ev.checkedIn},${ev.rate},${d.bibNumber ?? ''},${d.houseCode ?? ''},"${d.label}",${d.checkedIn ? 'YES' : 'NO'},${d.method ?? ''},${d.markedAt ? new Date(d.markedAt).toISOString() : ''}`,
        );
      }
    }
    return header + lines.join('\n') + '\n';
  }

  async volunteersReportCsv(user: JwtUser, meetId: string) {
    const volunteers = await this.meets.listVolunteers(user, meetId);
    const events = await this.db().competitionEvent.findMany({
      where: { tenantId: user.tid, meetId, deletedAt: null },
      select: { id: true, name: true },
    });
    const eventName = new Map(
      events.map((e: { id: string; name: string }) => [e.id, e.name]),
    );
    const header = 'Role,PersonType,Name,Code,Event,Notes\n';
    const lines = volunteers
      .map(
        (v: {
          role: string;
          personType: string;
          displayName: string;
          personCode?: string | null;
          eventId?: string | null;
          notes?: string;
        }) =>
          `${v.role},${v.personType},"${v.displayName}",${v.personCode ?? ''},"${v.eventId ? (eventName.get(v.eventId) ?? '') : 'All'}","${(v.notes ?? '').replace(/"/g, '""')}"`,
      )
      .join('\n');
    return header + lines + '\n';
  }

  async ledgerReportCsv(user: JwtUser, meetId: string) {
    await this.meets.getMeet(user, meetId);
    const rows = await this.db().housePointLedger.findMany({
      where: { tenantId: user.tid, meetId },
      include: {
        house: { select: { name: true, code: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    const events = await this.db().competitionEvent.findMany({
      where: { tenantId: user.tid, meetId, deletedAt: null },
      select: { id: true, name: true },
    });
    const eventName = new Map(
      events.map((e: { id: string; name: string }) => [e.id, e.name]),
    );
    const header = 'When,House,Code,Delta,BalanceAfter,Reason,Event\n';
    const lines = rows
      .map(
        (r: {
          createdAt: Date;
          house?: { name: string; code: string } | null;
          delta: number;
          balanceAfter: number;
          reason: string;
          eventId?: string | null;
        }) =>
          `${new Date(r.createdAt).toISOString()},"${r.house?.name ?? ''}",${r.house?.code ?? ''},${r.delta},${r.balanceAfter},"${(r.reason ?? '').replace(/"/g, '""')}","${r.eventId ? (eventName.get(r.eventId) ?? '') : ''}"`,
      )
      .join('\n');
    return header + lines + '\n';
  }
}
