import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import {
  DEFAULT_POINT_RULES,
  MEET_TYPES,
  categoriesForMeetType,
} from '../domain/competition.constants';
import type {
  AssignBibsDto,
  CreateTeamDto,
  GenerateFixturesDto,
  RegisterEntryDto,
  TransitionMeetStatusDto,
  UpsertEventDto,
  UpsertMeetDto,
  UpsertPointRulesDto,
} from '../dto/campus-competitions.dto';
import { CompetitionHousesService } from './competition-houses.service';
import { CompetitionRealtimePublisher } from './competition-realtime.publisher';

@Injectable()
export class CompetitionMeetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly houses: CompetitionHousesService,
    private readonly realtime: CompetitionRealtimePublisher,
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

  listMeetTypes() {
    return MEET_TYPES;
  }

  listMeets(user: JwtUser, status?: string) {
    return this.db().competitionMeet.findMany({
      where: {
        tenantId: user.tid,
        deletedAt: null,
        ...(status ? { status } : {}),
      },
      include: {
        pointRuleSet: true,
        _count: { select: { events: true } },
      },
      orderBy: { startsAt: 'desc' },
    });
  }

  async getMeet(user: JwtUser, meetId: string) {
    const meet = await this.db().competitionMeet.findFirst({
      where: { id: meetId, tenantId: user.tid, deletedAt: null },
      include: {
        pointRuleSet: true,
        events: {
          where: { deletedAt: null },
          include: { category: true, _count: { select: { entries: true } } },
          orderBy: { scheduledAt: 'asc' },
        },
      },
    });
    if (!meet) throw new NotFoundException('Meet not found');
    return meet;
  }

  async createMeet(user: JwtUser, dto: UpsertMeetDto) {
    this.requireManage(user);
    const meet = await this.db().competitionMeet.create({
      data: {
        tenantId: user.tid,
        name: dto.name.trim(),
        meetType: dto.meetType,
        academicYearId: dto.academicYearId ?? null,
        venue: dto.venue?.trim() ?? '',
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        theme: dto.theme?.trim() ?? '',
        description: dto.description?.trim() ?? '',
        status: 'DRAFT',
        displayToken: randomUUID().replace(/-/g, ''),
        requireResultApproval: true,
        createdById: user.sub,
      },
    });

    await this.db().competitionPointRuleSet.create({
      data: {
        tenantId: user.tid,
        meetId: meet.id,
        ...DEFAULT_POINT_RULES,
      },
    });

    const categories = categoriesForMeetType(dto.meetType);
    for (const cat of categories) {
      await this.db().competitionEventCategory.create({
        data: {
          tenantId: user.tid,
          meetId: meet.id,
          code: cat.code,
          label: cat.label,
          groupCode: cat.groupCode,
          sortOrder: cat.sortOrder,
        },
      });
    }

    return this.getMeet(user, meet.id);
  }

  async updateMeet(user: JwtUser, meetId: string, dto: UpsertMeetDto) {
    this.requireManage(user);
    await this.getMeet(user, meetId);
    await this.db().competitionMeet.update({
      where: { id: meetId },
      data: {
        name: dto.name.trim(),
        meetType: dto.meetType,
        academicYearId: dto.academicYearId ?? null,
        venue: dto.venue?.trim() ?? '',
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        theme: dto.theme?.trim() ?? '',
        description: dto.description?.trim() ?? '',
      },
    });
    return this.getMeet(user, meetId);
  }

  async transitionMeet(
    user: JwtUser,
    meetId: string,
    dto: TransitionMeetStatusDto,
  ) {
    this.requireManage(user);
    await this.getMeet(user, meetId);
    await this.db().competitionMeet.update({
      where: { id: meetId },
      data: { status: dto.status },
    });
    return this.getMeet(user, meetId);
  }

  async updatePointRules(
    user: JwtUser,
    meetId: string,
    dto: UpsertPointRulesDto,
  ) {
    this.requireManage(user);
    await this.getMeet(user, meetId);
    const existing = await this.db().competitionPointRuleSet.findFirst({
      where: { meetId, tenantId: user.tid },
    });
    if (!existing) throw new NotFoundException('Point rules not found');
    return this.db().competitionPointRuleSet.update({
      where: { id: existing.id },
      data: {
        firstPoints: dto.firstPoints ?? existing.firstPoints,
        secondPoints: dto.secondPoints ?? existing.secondPoints,
        thirdPoints: dto.thirdPoints ?? existing.thirdPoints,
        participationPoints:
          dto.participationPoints ?? existing.participationPoints,
      },
    });
  }

  listCategories(user: JwtUser, meetId: string) {
    return this.db().competitionEventCategory.findMany({
      where: { tenantId: user.tid, meetId },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
  }

  async createEvent(user: JwtUser, meetId: string, dto: UpsertEventDto) {
    this.requireManage(user);
    await this.getMeet(user, meetId);
    return this.db().competitionEvent.create({
      data: {
        tenantId: user.tid,
        meetId,
        categoryId: dto.categoryId ?? null,
        name: dto.name.trim(),
        gender: dto.gender ?? 'OPEN',
        ageGroup: dto.ageGroup ?? 'OPEN',
        entryMode: dto.entryMode ?? 'INDIVIDUAL',
        maxParticipants: dto.maxParticipants ?? null,
        maxTeamSize: dto.maxTeamSize ?? null,
        venue: dto.venue?.trim() ?? '',
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        judgeStaffId: dto.judgeStaffId ?? null,
      },
      include: { category: true },
    });
  }

  async updateEvent(user: JwtUser, eventId: string, dto: UpsertEventDto) {
    this.requireManage(user);
    const event = await this.db().competitionEvent.findFirst({
      where: { id: eventId, tenantId: user.tid, deletedAt: null },
    });
    if (!event) throw new NotFoundException('Event not found');
    return this.db().competitionEvent.update({
      where: { id: eventId },
      data: {
        categoryId: dto.categoryId ?? event.categoryId,
        name: dto.name.trim(),
        gender: dto.gender ?? event.gender,
        ageGroup: dto.ageGroup ?? event.ageGroup,
        entryMode: dto.entryMode ?? event.entryMode,
        maxParticipants: dto.maxParticipants ?? event.maxParticipants,
        maxTeamSize: dto.maxTeamSize ?? event.maxTeamSize,
        venue: dto.venue?.trim() ?? event.venue,
        scheduledAt: dto.scheduledAt
          ? new Date(dto.scheduledAt)
          : event.scheduledAt,
        judgeStaffId: dto.judgeStaffId ?? event.judgeStaffId,
      },
      include: { category: true },
    });
  }

  async getEvent(user: JwtUser, eventId: string) {
    const event = await this.db().competitionEvent.findFirst({
      where: { id: eventId, tenantId: user.tid, deletedAt: null },
      include: {
        category: true,
        meet: true,
        entries: true,
        teams: { include: { members: true } },
        fixtures: { orderBy: [{ heatNumber: 'asc' }, { bracketSlot: 'asc' }] },
      },
    });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async registerEntry(user: JwtUser, dto: RegisterEntryDto) {
    const event = await this.getEvent(user, dto.eventId);
    const meet = event.meet;
    if (!['OPEN', 'LIVE'].includes(meet.status)) {
      throw new BadRequestException('Registration is closed for this meet');
    }

    let studentId = dto.studentId;
    let houseId = dto.houseId;

    const isSelf =
      this.hasPermission(user, 'campus-competitions:self') &&
      !this.hasPermission(user, 'campus-competitions:manage');

    if (isSelf || !studentId) {
      studentId = await this.houses.resolveStudentId(user);
    }

    if (!houseId) {
      const membership = await this.houses.activeMembershipForStudent(
        user.tid,
        studentId!,
      );
      if (!membership) {
        throw new BadRequestException(
          'Student must be allocated to a house before registering',
        );
      }
      houseId = membership.houseId;
    }

    if (event.entryMode === 'TEAM') {
      throw new BadRequestException('This event requires team registration');
    }

    if (event.maxParticipants != null) {
      const count = await this.db().competitionEntry.count({
        where: {
          tenantId: user.tid,
          eventId: event.id,
          status: 'REGISTERED',
        },
      });
      if (count >= event.maxParticipants) {
        throw new BadRequestException('Event is full');
      }
    }

    const existing = await this.db().competitionEntry.findFirst({
      where: {
        tenantId: user.tid,
        eventId: event.id,
        studentId,
        status: 'REGISTERED',
      },
    });
    if (existing) {
      if (!existing.qrPassToken) {
        return this.db().competitionEntry.update({
          where: { id: existing.id },
          data: { qrPassToken: `CC:${randomUUID().replace(/-/g, '')}` },
        });
      }
      return existing;
    }

    return this.db().competitionEntry.create({
      data: {
        tenantId: user.tid,
        eventId: event.id,
        houseId,
        studentId,
        entryType: 'INDIVIDUAL',
        nominatedById: isSelf ? null : user.sub,
        qrPassToken: `CC:${randomUUID().replace(/-/g, '')}`,
      },
    });
  }

  async createTeam(user: JwtUser, dto: CreateTeamDto) {
    this.requireManage(user);
    const event = await this.getEvent(user, dto.eventId);
    if (event.entryMode !== 'TEAM') {
      throw new BadRequestException('Event is not a team event');
    }
    await this.houses.getHouse(user, dto.houseId);

    let members = dto.members ?? [];
    if (!members.length && dto.memberKeys?.length) {
      members = [];
      for (let i = 0; i < dto.memberKeys.length; i++) {
        const key = dto.memberKeys[i].trim();
        if (!key) continue;
        const student = await this.prisma.student.findFirst({
          where: {
            tenantId: user.tid,
            deletedAt: null,
            OR: [
              { enrollmentNumber: { equals: key, mode: 'insensitive' } },
              { admissionNumber: { equals: key, mode: 'insensitive' } },
              { rollNumber: { equals: key, mode: 'insensitive' } },
            ],
          },
          select: { id: true },
        });
        if (!student) {
          throw new BadRequestException(`Student not found: ${key}`);
        }
        members.push({
          studentId: student.id,
          role: i === 0 ? 'CAPTAIN' : 'MEMBER',
          sequence: i + 1,
        });
      }
    }
    if (!members.length) {
      throw new BadRequestException('members or memberKeys required');
    }

    const team = await this.db().competitionTeam.create({
      data: {
        tenantId: user.tid,
        eventId: dto.eventId,
        houseId: dto.houseId,
        name: dto.name.trim(),
      },
    });

    for (const member of members) {
      await this.db().competitionTeamMember.create({
        data: {
          tenantId: user.tid,
          teamId: team.id,
          studentId: member.studentId,
          role: member.role ?? 'MEMBER',
          sequence: member.sequence ?? 1,
        },
      });
    }

    const entry = await this.db().competitionEntry.create({
      data: {
        tenantId: user.tid,
        eventId: dto.eventId,
        houseId: dto.houseId,
        teamId: team.id,
        entryType: 'TEAM',
        nominatedById: user.sub,
        qrPassToken: `CC:${randomUUID().replace(/-/g, '')}`,
      },
    });

    return {
      team: await this.db().competitionTeam.findFirst({
        where: { id: team.id },
        include: { members: true },
      }),
      entry,
    };
  }

  listEntries(user: JwtUser, eventId: string) {
    return this.db().competitionEntry.findMany({
      where: { tenantId: user.tid, eventId },
      include: {
        house: { select: { id: true, name: true, code: true, color: true } },
        team: { include: { members: true } },
      },
      orderBy: { registeredAt: 'asc' },
    });
  }

  listFixtures(user: JwtUser, eventId: string) {
    return this.db().competitionFixture.findMany({
      where: { tenantId: user.tid, eventId },
      orderBy: [
        { heatNumber: 'asc' },
        { bracketSlot: 'asc' },
        { createdAt: 'asc' },
      ],
    });
  }

  async assignBibs(user: JwtUser, eventId: string, dto: AssignBibsDto) {
    this.requireManage(user);
    await this.getEvent(user, eventId);
    const entries = await this.db().competitionEntry.findMany({
      where: { tenantId: user.tid, eventId, status: 'REGISTERED' },
      orderBy: { registeredAt: 'asc' },
    });
    let next = dto.startFrom ?? 1;
    const updated = [];
    for (const entry of entries) {
      if (entry.bibNumber && !dto.force) {
        updated.push(entry);
        continue;
      }
      const bib = String(next);
      next += 1;
      updated.push(
        await this.db().competitionEntry.update({
          where: { id: entry.id },
          data: { bibNumber: bib },
        }),
      );
    }
    return { assigned: updated.length, entries: updated };
  }

  async generateFixtures(
    user: JwtUser,
    eventId: string,
    dto: GenerateFixturesDto,
  ) {
    this.requireManage(user);
    const event = await this.getEvent(user, eventId);
    const entries = await this.db().competitionEntry.findMany({
      where: { tenantId: user.tid, eventId, status: 'REGISTERED' },
      orderBy: { registeredAt: 'asc' },
    });
    if (!entries.length) {
      throw new BadRequestException('No entries to schedule');
    }

    await this.db().competitionFixture.deleteMany({
      where: { tenantId: user.tid, eventId },
    });

    const mode =
      dto.mode ?? (event.entryMode === 'TEAM' ? 'KNOCKOUT' : 'HEATS');
    const fixtures = [];

    if (mode === 'HEATS') {
      const heatSize = dto.heatSize ?? 8;
      let heat = 1;
      for (let i = 0; i < entries.length; i += heatSize) {
        const chunk = entries.slice(i, i + heatSize);
        for (let lane = 0; lane < chunk.length; lane++) {
          await this.db().competitionEntry.update({
            where: { id: chunk[lane].id },
            data: { lane: lane + 1 },
          });
        }
        fixtures.push(
          await this.db().competitionFixture.create({
            data: {
              tenantId: user.tid,
              eventId,
              round: 'HEAT',
              heatNumber: heat,
              scheduledAt: event.scheduledAt,
              entryIds: chunk.map((e: { id: string }) => e.id),
            },
          }),
        );
        heat += 1;
      }
    } else if (mode === 'ROUND_ROBIN') {
      let slot = 1;
      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          fixtures.push(
            await this.db().competitionFixture.create({
              data: {
                tenantId: user.tid,
                eventId,
                round: 'ROUND_ROBIN',
                bracketSlot: slot,
                scheduledAt: event.scheduledAt,
                entryIds: [entries[i].id, entries[j].id],
              },
            }),
          );
          slot += 1;
        }
      }
    } else {
      // Knockout — pad to next power of 2 conceptually via bye placeholders
      let slot = 1;
      for (let i = 0; i < entries.length; i += 2) {
        const pair = entries.slice(i, i + 2).map((e: { id: string }) => e.id);
        fixtures.push(
          await this.db().competitionFixture.create({
            data: {
              tenantId: user.tid,
              eventId,
              round: 'QUARTER',
              bracketSlot: slot,
              scheduledAt: event.scheduledAt,
              entryIds: pair,
            },
          }),
        );
        slot += 1;
      }
    }

    return fixtures;
  }

  openMeetsForStudents(user: JwtUser) {
    return this.db().competitionMeet.findMany({
      where: {
        tenantId: user.tid,
        deletedAt: null,
        status: { in: ['OPEN', 'LIVE'] },
      },
      include: {
        _count: { select: { events: true } },
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  async myEntries(user: JwtUser) {
    const studentId = await this.houses.resolveStudentId(user);
    const rows = await this.db().competitionEntry.findMany({
      where: { tenantId: user.tid, studentId },
      include: {
        house: { select: { id: true, name: true, code: true, color: true } },
        checkIns: true,
        event: {
          select: {
            id: true,
            name: true,
            entryMode: true,
            status: true,
            scheduledAt: true,
            meet: {
              select: {
                id: true,
                name: true,
                meetType: true,
                status: true,
                startsAt: true,
                endsAt: true,
              },
            },
          },
        },
        results: {
          where: { status: { in: ['PUBLISHED', 'PENDING_APPROVAL', 'DRAFT'] } },
          select: {
            id: true,
            position: true,
            status: true,
            metricValue: true,
            publishedAt: true,
          },
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { registeredAt: 'desc' },
      take: 100,
    });

    for (const row of rows) {
      if (!row.qrPassToken) {
        row.qrPassToken = `CC:${randomUUID().replace(/-/g, '')}`;
        await this.db().competitionEntry.update({
          where: { id: row.id },
          data: { qrPassToken: row.qrPassToken },
        });
      }
    }
    return rows;
  }

  async ensureDisplayToken(user: JwtUser, meetId: string) {
    this.requireManage(user);
    const meet = await this.getMeet(user, meetId);
    if (meet.displayToken) return meet;
    return this.db().competitionMeet.update({
      where: { id: meetId },
      data: { displayToken: randomUUID().replace(/-/g, '') },
    });
  }

  async setLiveEvent(
    user: JwtUser,
    meetId: string,
    liveEventId: string | null,
  ) {
    this.requireManage(user);
    await this.getMeet(user, meetId);
    if (liveEventId) {
      const event = await this.db().competitionEvent.findFirst({
        where: { id: liveEventId, meetId, tenantId: user.tid, deletedAt: null },
      });
      if (!event) throw new NotFoundException('Event not found for this meet');
    }
    const meet = await this.db().competitionMeet.update({
      where: { id: meetId },
      data: { liveEventId },
    });
    this.realtime.publish(user.tid, 'competition:live-event', {
      meetId,
      liveEventId,
      leaderboardVersion: meet.leaderboardVersion,
    });
    return meet;
  }

  async createAnnouncement(
    user: JwtUser,
    meetId: string,
    message: string,
    severity = 'INFO',
  ) {
    if (
      !this.hasPermission(user, 'campus-competitions:manage') &&
      !this.hasPermission(user, 'campus-competitions:score')
    ) {
      throw new ForbiddenException('Permission required');
    }
    await this.getMeet(user, meetId);
    const row = await this.db().competitionAnnouncement.create({
      data: {
        tenantId: user.tid,
        meetId,
        message: message.trim(),
        severity,
        createdById: user.sub,
      },
    });
    this.realtime.publish(user.tid, 'competition:announcement', {
      meetId,
      id: row.id,
      message: row.message,
      severity: row.severity,
      createdAt: row.createdAt,
    });
    return row;
  }

  listAnnouncements(user: JwtUser, meetId: string) {
    return this.db().competitionAnnouncement.findMany({
      where: { tenantId: user.tid, meetId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
