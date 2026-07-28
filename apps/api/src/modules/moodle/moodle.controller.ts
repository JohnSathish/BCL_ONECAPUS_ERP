import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PrismaService } from '../../database/prisma.service';
import {
  MoodleLaunchQueryDto,
  MoodleSsoVerifyDto,
  MoodleSyncRequestDto,
  UpdateMoodleSettingsDto,
} from './dto/moodle.dto';
import { MoodleApiService } from './moodle-api.service';
import { MoodleAuthService } from './moodle-auth.service';
import { MoodleCalendarService } from './moodle-calendar.service';
import { MoodleEventsService } from './moodle-events.service';
import { MoodleHookService } from './moodle-hook.service';
import { MoodleSettingsService } from './moodle-settings.service';
import { MoodleSyncService } from './moodle-sync.service';
import { MoodleSyncQueueService } from './moodle-sync-queue.service';

@ApiTags('moodle')
@Controller({ path: 'moodle', version: '1' })
export class MoodleController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: MoodleSettingsService,
    private readonly api: MoodleApiService,
    private readonly auth: MoodleAuthService,
    private readonly sync: MoodleSyncService,
    private readonly hooks: MoodleHookService,
    private readonly events: MoodleEventsService,
    private readonly calendar: MoodleCalendarService,
    private readonly syncQueue: MoodleSyncQueueService,
  ) {}

  @Get('settings')
  @ApiBearerAuth()
  @RequirePermissions('moodle:settings', 'moodle:manage')
  getSettings(@CurrentUser() user: JwtUser) {
    return this.settings.getOrCreate(user.tid);
  }

  @Post('settings')
  @ApiBearerAuth()
  @RequirePermissions('moodle:settings', 'moodle:manage')
  updateSettings(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateMoodleSettingsDto,
  ) {
    return this.settings.update(user.tid, dto);
  }

  @Post('test-connection')
  @ApiBearerAuth()
  @RequirePermissions('moodle:settings', 'moodle:manage')
  async testConnection(@CurrentUser() user: JwtUser) {
    try {
      return await this.api.testConnection(user.tid);
    } catch (err) {
      await this.settings.markConnection(
        user.tid,
        'FAILED',
        err instanceof Error ? err.message : String(err),
      );
      throw err;
    }
  }

  @Get('sync/dashboard')
  @ApiBearerAuth()
  @RequirePermissions('moodle:read', 'moodle:sync', 'moodle:manage')
  syncDashboard(@CurrentUser() user: JwtUser) {
    return this.sync.syncDashboard(user.tid);
  }

  @Post('sync/run')
  @ApiBearerAuth()
  @RequirePermissions('moodle:sync', 'moodle:manage')
  runSync(@CurrentUser() user: JwtUser, @Body() dto: MoodleSyncRequestDto) {
    return this.hooks.enqueueManualSync(user.tid, dto.syncType ?? 'ALL');
  }

  @Post('sync/retry/:logId')
  @ApiBearerAuth()
  @RequirePermissions('moodle:sync', 'moodle:manage')
  retrySync(@CurrentUser() user: JwtUser, @Param('logId') _logId: string) {
    return this.hooks.enqueueManualSync(user.tid, 'ALL', 'retry');
  }

  @Get('sync/logs')
  @ApiBearerAuth()
  @RequirePermissions('moodle:read', 'moodle:sync', 'moodle:manage')
  syncLogs(@CurrentUser() user: JwtUser) {
    return this.sync.listSyncLogs(user.tid);
  }

  @Get('sync/failed-jobs')
  @ApiBearerAuth()
  @RequirePermissions('moodle:read', 'moodle:sync', 'moodle:manage')
  failedJobs(@CurrentUser() user: JwtUser) {
    return this.syncQueue.listFailedJobs(user.tid);
  }

  @Post('sync/failed-jobs/requeue-all')
  @ApiBearerAuth()
  @RequirePermissions('moodle:sync', 'moodle:manage')
  requeueAllFailedJobs(@CurrentUser() user: JwtUser) {
    return this.syncQueue.requeueAllFailedJobs(user.tid);
  }

  @Post('sync/failed-jobs/:jobId/requeue')
  @ApiBearerAuth()
  @RequirePermissions('moodle:sync', 'moodle:manage')
  requeueFailedJob(
    @CurrentUser() user: JwtUser,
    @Param('jobId') jobId: string,
  ) {
    return this.syncQueue.requeueFailedJob(user.tid, jobId);
  }

  @Get('api/logs')
  @ApiBearerAuth()
  @RequirePermissions('moodle:read', 'moodle:manage')
  apiLogs(@CurrentUser() user: JwtUser) {
    return this.sync.listApiLogs(user.tid);
  }

  @Get('events/pending')
  @ApiBearerAuth()
  @RequirePermissions('moodle:read', 'moodle:manage')
  pendingEvents(@CurrentUser() user: JwtUser) {
    return this.events.listPending(user.tid);
  }

  @Get('events/ai-context')
  @ApiBearerAuth()
  @RequirePermissions('moodle:read', 'moodle:manage')
  async aiContext(@CurrentUser() user: JwtUser) {
    const [pending, recentLogs] = await Promise.all([
      this.events.listPending(user.tid, 100),
      this.sync.listSyncLogs(user.tid, 10),
    ]);
    return {
      extensionPoints: [
        'MoodleSyncEvent',
        'MoodleGrade',
        'MoodleAssignment',
        'MoodleQuiz',
        'MoodleAttendance',
      ],
      pendingEvents: pending,
      recentSyncLogs: recentLogs,
      note: 'AI pipelines can subscribe to pending sync events; no ML is executed in ERP.',
    };
  }

  @Get('calendar/student')
  @ApiBearerAuth()
  @RequirePermissions('lms:read', 'student:portal:self')
  async studentCalendar(
    @CurrentUser() user: JwtUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const student = await this.prisma.student.findFirst({
      where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
      select: { id: true },
    });
    if (!student) return { events: [] };
    const fromDate = from ? new Date(from) : new Date();
    const toDate = to
      ? new Date(to)
      : new Date(fromDate.getTime() + 30 * 86400000);
    const events = await this.calendar.listEventsForStudent(
      user.tid,
      student.id,
      fromDate,
      toDate,
    );
    return { events };
  }

  @Get('reports/export')
  @ApiBearerAuth()
  @RequirePermissions('moodle:read', 'moodle:manage')
  async exportReports(@CurrentUser() user: JwtUser, @Res() res: Response) {
    const dashboard = await this.sync.syncDashboard(user.tid);
    const rows = [
      ['Metric', 'Value'],
      ['Courses synced', String(dashboard.counts.courses)],
      ['Users synced', String(dashboard.counts.users)],
      ['Active enrollments', String(dashboard.counts.enrollments)],
      ['Pending AI/sync events', String(dashboard.pendingEvents)],
      ['Last sync', dashboard.settings.lastSyncAt?.toISOString() ?? '—'],
      ['Connection status', dashboard.settings.connectionStatus ?? 'UNKNOWN'],
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))
      .join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="moodle-sync-report.csv"',
    );
    res.send(csv);
  }

  @Get('launch')
  @ApiBearerAuth()
  @RequirePermissions('lms:read', 'moodle:read')
  async launch(
    @CurrentUser() user: JwtUser,
    @Query() query: MoodleLaunchQueryDto,
  ) {
    let moodleCourseId = query.moodleCourseId;
    if (query.workspaceId && !moodleCourseId) {
      const ws = await this.prisma.lmsWorkspace.findFirst({
        where: { id: query.workspaceId, tenantId: user.tid },
      });
      moodleCourseId = ws?.moodleCourseId ?? undefined;
    }
    const url = await this.auth.buildLaunchUrl({
      tenantId: user.tid,
      userId: user.sub,
      moodleCourseId,
      workspaceId: query.workspaceId,
    });
    return { url };
  }

  @Post('sso/verify')
  @Public()
  verifySso(@Body() dto: MoodleSsoVerifyDto) {
    return this.auth.verifyLaunchToken(dto.token);
  }
}
