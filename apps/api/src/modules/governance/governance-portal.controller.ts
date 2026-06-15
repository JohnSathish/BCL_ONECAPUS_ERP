import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import { ListQueryDto, PortalAttendanceDto } from './dto/governance.dto';
import { GovernanceAttendanceService } from './services/governance-attendance.service';
import { GovernanceMeetingService } from './services/governance-meeting.service';
import { GovernanceNoticeService } from './services/governance-notice.service';
import { GovernanceTaskService } from './services/governance-task.service';
import { governanceDb } from './services/governance-prisma.util';
import { PrismaService } from '../../database/prisma.service';

@ApiBearerAuth()
@ApiTags('governance-portal')
@Controller({ path: 'governance/me', version: '1' })
export class GovernancePortalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly meetings: GovernanceMeetingService,
    private readonly attendance: GovernanceAttendanceService,
    private readonly tasks: GovernanceTaskService,
    private readonly notices: GovernanceNoticeService,
  ) {}

  private db() {
    return governanceDb(this.prisma);
  }

  @Get('committees')
  @RequireAnyPermission('governance:portal')
  myCommittees(@CurrentUser() user: JwtUser) {
    return this.db().governanceCommitteeMember.findMany({
      where: { tenantId: user.tid, userId: user.sub, status: 'ACTIVE' },
      include: {
        committee: {
          select: { id: true, name: true, shortCode: true, category: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('meetings')
  @RequireAnyPermission('governance:portal')
  async myMeetings(@CurrentUser() user: JwtUser, @Query() query: ListQueryDto) {
    const memberships = await this.db().governanceCommitteeMember.findMany({
      where: { tenantId: user.tid, userId: user.sub, status: 'ACTIVE' },
      select: { committeeId: true },
    });
    const committeeIds = memberships.map(
      (m: { committeeId: string }) => m.committeeId,
    );
    if (!committeeIds.length)
      return { items: [], total: 0, page: 1, limit: query.limit ?? 20 };

    const result = await this.meetings.list(user.tid, {
      ...query,
      committeeId: committeeIds[0],
    });
    if (committeeIds.length > 1) {
      const all = await this.db().governanceMeeting.findMany({
        where: { tenantId: user.tid, committeeId: { in: committeeIds } },
        include: { committee: { select: { name: true, shortCode: true } } },
        orderBy: { meetingDate: 'desc' },
        take: query.limit ?? 20,
      });
      return {
        items: all,
        total: all.length,
        page: 1,
        limit: query.limit ?? 20,
      };
    }
    return result;
  }

  @Get('meetings/:id')
  @RequireAnyPermission('governance:portal')
  getMeeting(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.meetings.getById(user.tid, id);
  }

  @Get('tasks')
  @RequireAnyPermission('governance:portal')
  async myTasks(@CurrentUser() user: JwtUser, @Query() query: ListQueryDto) {
    const db = this.db();
    const where = {
      tenantId: user.tid,
      OR: [{ assignedToId: user.sub }, { assignedName: user.email }],
      ...(query.status ? { status: query.status } : {}),
    };
    const items = await db.governanceTask.findMany({
      where,
      include: { committee: { select: { name: true, shortCode: true } } },
      orderBy: { dueDate: 'asc' },
      take: query.limit ?? 50,
    });
    return { items, total: items.length };
  }

  @Get('notices')
  @RequireAnyPermission('governance:portal')
  myNotices(@CurrentUser() user: JwtUser, @Query() query: ListQueryDto) {
    return this.notices.list(user.tid, { ...query, status: 'PUBLISHED' });
  }

  @Post('attendance')
  @RequireAnyPermission('governance:portal')
  markAttendance(
    @CurrentUser() user: JwtUser,
    @Body() dto: PortalAttendanceDto,
  ) {
    if (dto.token) {
      return this.attendance.markByQr(user, {
        token: dto.token,
        memberId: undefined,
      });
    }
    if (dto.otp) {
      return this.attendance.markByOtp(user, {
        meetingId: dto.meetingId,
        otp: dto.otp,
      });
    }
    return this.attendance.markManual(user, {
      meetingId: dto.meetingId,
      status: 'PRESENT',
      userId: user.sub,
      displayName: user.email,
    });
  }
}
