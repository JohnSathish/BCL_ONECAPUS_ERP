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
import { CertificateIntegrityService } from '../../certificates/certificate-integrity.service';
import { CertificateVariableService } from '../../certificates/certificate-variable.service';
import {
  metalForPosition,
  pointsForPosition,
} from '../domain/competition.constants';
import type { UpsertResultsDto } from '../dto/campus-competitions.dto';
import { CompetitionMeetsService } from './competition-meets.service';
import { CompetitionRealtimePublisher } from './competition-realtime.publisher';

@Injectable()
export class CompetitionScoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly meets: CompetitionMeetsService,
    private readonly variables: CertificateVariableService,
    private readonly documents: CertificateDocumentService,
    private readonly integrity: CertificateIntegrityService,
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

  private requireCertificates(user: JwtUser) {
    if (
      !this.hasPermission(user, 'campus-competitions:certificates') &&
      !this.hasPermission(user, 'campus-competitions:manage')
    ) {
      throw new ForbiddenException('Certificates permission required');
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
          status: 'DRAFT',
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
      return this.publishEventResults(user, eventId);
    }
    return { results: created, published: false, meetId: event.meetId };
  }

  async publishEventResults(user: JwtUser, eventId: string) {
    this.requireScore(user);
    const event = await this.meets.getEvent(user, eventId);
    const meetId = event.meetId;
    const rules = await this.db().competitionPointRuleSet.findFirst({
      where: { meetId, tenantId: user.tid },
    });
    if (!rules) throw new NotFoundException('Point rules missing');

    const drafts = await this.db().competitionResult.findMany({
      where: { tenantId: user.tid, eventId, status: 'DRAFT' },
      include: {
        entry: true,
        team: true,
      },
    });
    if (!drafts.length) {
      throw new BadRequestException('No draft results to publish');
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

    return {
      published: published.length,
      leaderboardVersion: meet.leaderboardVersion,
      leaderboard: board,
    };
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

  async reportsSummary(user: JwtUser, meetId: string) {
    const meet = await this.meets.getMeet(user, meetId);
    const leaderboard = await this.leaderboard(user, meetId);
    const events = await this.db().competitionEvent.count({
      where: { tenantId: user.tid, meetId, deletedAt: null },
    });
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
    return {
      meet: { id: meet.id, name: meet.name, status: meet.status },
      events,
      participants,
      publishedResults,
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
}
