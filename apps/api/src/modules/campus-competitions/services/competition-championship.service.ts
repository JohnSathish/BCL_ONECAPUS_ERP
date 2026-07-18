import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { CompetitionScoringService } from './competition-scoring.service';

@Injectable()
export class CompetitionChampionshipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: CompetitionScoringService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  private hasPermission(user: JwtUser, slug: string) {
    return user.permissions?.includes(slug) ?? false;
  }

  private requireManage(user: JwtUser) {
    if (!this.hasPermission(user, 'campus-competitions:manage')) {
      throw new ForbiddenException('Manage permission required');
    }
  }

  private requireRead(user: JwtUser) {
    if (
      !this.hasPermission(user, 'campus-competitions:read') &&
      !this.hasPermission(user, 'campus-competitions:manage') &&
      !this.hasPermission(user, 'campus-competitions:self') &&
      !this.hasPermission(user, 'student:portal:self')
    ) {
      throw new ForbiddenException('Read permission required');
    }
  }

  async yearStandings(user: JwtUser, academicYearId: string) {
    this.requireRead(user);
    const meets = await this.db().competitionMeet.findMany({
      where: {
        tenantId: user.tid,
        academicYearId,
        deletedAt: null,
        status: { not: 'DRAFT' },
      },
      select: { id: true, name: true, status: true, meetType: true },
    });
    const meetIds = meets.map((m: { id: string }) => m.id);
    const houses = await this.db().competitionHouse.findMany({
      where: { tenantId: user.tid, status: 'ACTIVE', deletedAt: null },
      select: { id: true, name: true, code: true, color: true },
    });

    const board = [];
    for (const house of houses) {
      let points = 0;
      if (meetIds.length) {
        const sum = await this.db().housePointLedger.aggregate({
          where: {
            tenantId: user.tid,
            houseId: house.id,
            meetId: { in: meetIds },
          },
          _sum: { delta: true },
        });
        points = sum._sum?.delta ?? 0;
      }
      const medals = { gold: 0, silver: 0, bronze: 0 };
      if (meetIds.length) {
        const medalRows = await this.db().competitionMedal.groupBy({
          by: ['metal'],
          where: {
            tenantId: user.tid,
            houseId: house.id,
            meetId: { in: meetIds },
          },
          _count: true,
        });
        for (const row of medalRows) {
          if (row.metal === 'GOLD') medals.gold = row._count;
          if (row.metal === 'SILVER') medals.silver = row._count;
          if (row.metal === 'BRONZE') medals.bronze = row._count;
        }
      }
      board.push({ ...house, points, medals });
    }
    board.sort(
      (a, b) =>
        b.points - a.points ||
        b.medals.gold - a.medals.gold ||
        b.medals.silver - a.medals.silver,
    );
    const ranked = board.map((r, i) => ({ ...r, rank: i + 1 }));
    const houseOfYear = ranked[0]?.points > 0 ? ranked[0] : null;

    const awards = await this.db().competitionTrophyAward.findMany({
      where: {
        tenantId: user.tid,
        academicYearId,
        returnedAt: null,
      },
      include: {
        trophy: true,
        house: { select: { id: true, name: true, code: true, color: true } },
      },
      orderBy: { awardedAt: 'desc' },
    });

    return {
      academicYearId,
      meetCount: meets.length,
      meets,
      standings: ranked,
      houseOfYear,
      awards,
    };
  }

  listTrophies(user: JwtUser, status?: string) {
    this.requireRead(user);
    return this.db().competitionTrophy.findMany({
      where: {
        tenantId: user.tid,
        deletedAt: null,
        ...(status ? { status } : {}),
      },
      include: {
        awards: {
          where: { returnedAt: null },
          take: 1,
          orderBy: { awardedAt: 'desc' },
          include: {
            house: { select: { name: true, code: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createTrophy(
    user: JwtUser,
    dto: {
      name: string;
      code: string;
      trophyType?: string;
      description?: string;
    },
  ) {
    this.requireManage(user);
    return this.db().competitionTrophy.create({
      data: {
        tenantId: user.tid,
        name: dto.name.trim(),
        code: dto.code.trim().toUpperCase(),
        trophyType: dto.trophyType ?? 'CUP',
        description: dto.description?.trim() ?? '',
        status: 'AVAILABLE',
      },
    });
  }

  async updateTrophy(
    user: JwtUser,
    id: string,
    dto: {
      name?: string;
      trophyType?: string;
      description?: string;
      status?: string;
    },
  ) {
    this.requireManage(user);
    const existing = await this.db().competitionTrophy.findFirst({
      where: { id, tenantId: user.tid, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Trophy not found');
    return this.db().competitionTrophy.update({
      where: { id },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.trophyType != null ? { trophyType: dto.trophyType } : {}),
        ...(dto.description != null
          ? { description: dto.description.trim() }
          : {}),
        ...(dto.status != null ? { status: dto.status } : {}),
      },
    });
  }

  async awardTrophy(
    user: JwtUser,
    dto: {
      trophyId: string;
      academicYearId: string;
      awardType: string;
      houseId?: string;
      studentId?: string;
      meetId?: string;
      title?: string;
      notes?: string;
    },
  ) {
    this.requireManage(user);
    const trophy = await this.db().competitionTrophy.findFirst({
      where: { id: dto.trophyId, tenantId: user.tid, deletedAt: null },
    });
    if (!trophy) throw new NotFoundException('Trophy not found');
    if (trophy.status === 'RETIRED') {
      throw new BadRequestException('Trophy is retired');
    }

    const open = await this.db().competitionTrophyAward.findFirst({
      where: {
        tenantId: user.tid,
        trophyId: dto.trophyId,
        returnedAt: null,
      },
    });
    if (open) {
      throw new BadRequestException(
        'Trophy is already awarded; return it before re-awarding',
      );
    }

    const award = await this.db().competitionTrophyAward.create({
      data: {
        tenantId: user.tid,
        trophyId: dto.trophyId,
        academicYearId: dto.academicYearId,
        meetId: dto.meetId ?? null,
        houseId: dto.houseId ?? null,
        studentId: dto.studentId ?? null,
        awardType: dto.awardType,
        title: dto.title?.trim() ?? '',
        notes: dto.notes?.trim() ?? '',
        awardedById: user.sub,
      },
      include: {
        trophy: true,
        house: { select: { id: true, name: true, code: true, color: true } },
      },
    });

    await this.db().competitionTrophy.update({
      where: { id: dto.trophyId },
      data: { status: 'AWARDED' },
    });

    return award;
  }

  async returnTrophy(user: JwtUser, awardId: string) {
    this.requireManage(user);
    const award = await this.db().competitionTrophyAward.findFirst({
      where: { id: awardId, tenantId: user.tid, returnedAt: null },
    });
    if (!award) throw new NotFoundException('Open award not found');

    const updated = await this.db().competitionTrophyAward.update({
      where: { id: awardId },
      data: { returnedAt: new Date() },
    });
    await this.db().competitionTrophy.update({
      where: { id: award.trophyId },
      data: { status: 'AVAILABLE' },
    });
    return updated;
  }

  async declareHouseOfYear(
    user: JwtUser,
    academicYearId: string,
    dto: {
      houseId?: string;
      trophyId?: string;
      meetId?: string;
      studentRecipientIds?: string[];
    },
  ) {
    this.requireManage(user);
    const standings = await this.yearStandings(user, academicYearId);
    const winner =
      (dto.houseId
        ? standings.standings.find((h: { id: string }) => h.id === dto.houseId)
        : standings.houseOfYear) ?? null;
    if (!winner) {
      throw new BadRequestException('No house standings to declare a winner');
    }

    const meetId =
      dto.meetId ??
      standings.meets.find((m: { status: string }) => m.status === 'COMPLETED')
        ?.id ??
      standings.meets[0]?.id ??
      null;

    if (meetId) {
      const existingMedal = await this.db().competitionMedal.findFirst({
        where: {
          tenantId: user.tid,
          meetId,
          houseId: winner.id,
          awardType: 'HOUSE_CHAMPION',
        },
      });
      if (!existingMedal) {
        await this.db().competitionMedal.create({
          data: {
            tenantId: user.tid,
            meetId,
            houseId: winner.id,
            metal: 'GOLD',
            awardType: 'HOUSE_CHAMPION',
          },
        });
      }
    }

    let trophyAward = null;
    if (dto.trophyId) {
      trophyAward = await this.awardTrophy(user, {
        trophyId: dto.trophyId,
        academicYearId,
        awardType: 'HOUSE_CHAMPION',
        houseId: winner.id,
        meetId: meetId ?? undefined,
        title: `House of the Year — ${winner.name}`,
      });
    }

    let certificatesIssued = 0;
    const recipients = dto.studentRecipientIds ?? [];
    if (recipients.length && meetId) {
      const meet = await this.db().competitionMeet.findFirst({
        where: { id: meetId, tenantId: user.tid },
      });
      if (meet) {
        for (const studentId of recipients) {
          try {
            await this.scoring.issueChampionHouseCertificate(user, {
              meet,
              houseId: winner.id,
              houseName: winner.name,
              studentId,
              academicYearId,
            });
            certificatesIssued += 1;
          } catch {
            /* skip individual failures */
          }
        }
      }
    }

    await this.db().competitionAuditLog.create({
      data: {
        tenantId: user.tid,
        meetId,
        houseId: winner.id,
        actorId: user.sub,
        entityType: 'championship',
        entityId: academicYearId,
        action: 'house_of_year.declared',
        after: {
          houseId: winner.id,
          points: winner.points,
          trophyAwardId: trophyAward?.id ?? null,
          certificatesIssued,
        },
      },
    });

    return {
      house: winner,
      trophyAward,
      certificatesIssued,
      standings: standings.standings,
    };
  }
}
