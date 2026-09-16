import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { createReadStream } from 'fs';
import type { Request, Response } from 'express';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import { extractClientIp } from '../../common/utils/request-host';
import { SkipSchoolLicense } from './school-sis-license.decorators';
import {
  SIS_OPS_AUDIT,
  SIS_OPS_BACKUP_CREATE,
  SIS_OPS_BACKUP_DELETE,
  SIS_OPS_BACKUP_RESTORE,
  SIS_OPS_BACKUP_VIEW,
  SIS_OPS_CACHE,
  SIS_OPS_CACHE_CLEAR,
  SIS_OPS_CONFIG,
  SIS_OPS_JOBS,
  SIS_OPS_JOBS_RETRY,
  SIS_OPS_LICENSE,
  SIS_OPS_LOGS,
  SIS_OPS_LOGS_EXPORT,
  SIS_OPS_MAINT,
  SIS_OPS_STATUS,
  SIS_OPS_STORAGE,
  SIS_OPS_VIEW,
} from './school-sis-ops.perms';
import { SchoolSisOpsService } from './school-sis-ops.service';

@ApiBearerAuth()
@ApiTags('school-sis-ops')
@SkipSchoolLicense()
@Controller({ path: 'school-sis/ops', version: '1' })
export class SchoolSisOpsController {
  constructor(private readonly ops: SchoolSisOpsService) {}

  private meta(req: Request) {
    return {
      ip: extractClientIp(req),
      ua: String(req.headers['user-agent'] ?? ''),
      requestId: String(req.headers['x-request-id'] ?? ''),
    };
  }

  @Get('dashboard')
  @RequireAnyPermission(...SIS_OPS_VIEW)
  dashboard(@CurrentUser() user: JwtUser) {
    return this.ops.dashboard(user.tid);
  }

  @Get('status')
  @RequireAnyPermission(...SIS_OPS_STATUS)
  status(@CurrentUser() user: JwtUser) {
    return this.ops.status(user.tid);
  }

  @Get('cache')
  @RequireAnyPermission(...SIS_OPS_CACHE, ...SIS_OPS_VIEW)
  cache() {
    return this.ops.cacheStatus();
  }

  @Post('cache/clear')
  @RequireAnyPermission(...SIS_OPS_CACHE_CLEAR)
  clearCache(
    @CurrentUser() user: JwtUser,
    @Body() body: { scope?: string; confirm?: boolean },
    @Req() req: Request,
  ) {
    if (!body.confirm) return { ok: false, message: 'Confirmation required' };
    return this.ops.clearCache(
      user.tid,
      user,
      String(body.scope || 'application'),
      this.meta(req),
    );
  }

  @Get('backups')
  @RequireAnyPermission(...SIS_OPS_BACKUP_VIEW)
  backups(@CurrentUser() user: JwtUser) {
    return this.ops.backups(user.tid);
  }

  @Post('backups')
  @RequireAnyPermission(...SIS_OPS_BACKUP_CREATE)
  createBackup(
    @CurrentUser() user: JwtUser,
    @Body() body: { kind?: string },
    @Req() req: Request,
  ) {
    return this.ops.createBackup(
      user.tid,
      user,
      String(body.kind || 'DATABASE'),
      this.meta(req),
    );
  }

  @Patch('backups/schedule')
  @RequireAnyPermission(...SIS_OPS_BACKUP_CREATE)
  schedule(
    @CurrentUser() user: JwtUser,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.ops.saveSchedule(user.tid, user, body, this.meta(req));
  }

  @Post('backups/:id/verify')
  @RequireAnyPermission(...SIS_OPS_BACKUP_VIEW)
  verify(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.ops.verifyBackup(user.tid, id, user, this.meta(req));
  }

  @Get('backups/:id/download')
  @RequireAnyPermission(...SIS_OPS_BACKUP_VIEW)
  async download(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.ops.backupFile(user.tid, id);
    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
    return new StreamableFile(createReadStream(file.path));
  }

  @Post('backups/:id/restore')
  @RequireAnyPermission(...SIS_OPS_BACKUP_RESTORE, 'school-sis:manage')
  restore(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { confirm?: boolean },
    @Req() req: Request,
  ) {
    return this.ops.restoreBackup(
      user.tid,
      id,
      user,
      Boolean(body.confirm),
      this.meta(req),
    );
  }

  @Delete('backups/:id')
  @RequireAnyPermission(...SIS_OPS_BACKUP_DELETE)
  remove(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.ops.deleteBackup(user.tid, id, user, this.meta(req));
  }

  @Get('logs')
  @RequireAnyPermission(...SIS_OPS_LOGS)
  logs(
    @CurrentUser() user: JwtUser,
    @Query('level') level?: string,
    @Query('module') module?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('requestId') requestId?: string,
    @Query('userId') userId?: string,
    @Query('ip') ip?: string,
    @Query('page') page?: string,
  ) {
    return this.ops.logs(user.tid, {
      level,
      module,
      search,
      from,
      to,
      requestId,
      userId,
      ip,
      page: page ? Number(page) : 1,
    });
  }

  @Get('logs/export')
  @RequireAnyPermission(...SIS_OPS_LOGS_EXPORT)
  exportLogs(@CurrentUser() user: JwtUser, @Req() req: Request) {
    return this.ops.exportLogs(user.tid, user, this.meta(req));
  }

  @Post('logs/purge')
  @RequireAnyPermission(...SIS_OPS_LOGS_EXPORT)
  purge(@CurrentUser() user: JwtUser, @Req() req: Request) {
    return this.ops.purgeLogs(user.tid, user, this.meta(req));
  }

  @Get('audit')
  @RequireAnyPermission(...SIS_OPS_AUDIT)
  audit(@CurrentUser() user: JwtUser, @Query('page') page?: string) {
    return this.ops.auditList(user.tid, page ? Number(page) : 1);
  }

  @Get('maintenance')
  @RequireAnyPermission(...SIS_OPS_MAINT, ...SIS_OPS_VIEW)
  maintenance(@CurrentUser() user: JwtUser) {
    return this.ops.maintenanceGet(user.tid);
  }

  @Post('maintenance')
  @RequireAnyPermission(...SIS_OPS_MAINT)
  setMaintenance(
    @CurrentUser() user: JwtUser,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.ops.maintenanceSet(user.tid, user, body, this.meta(req));
  }

  @Get('config')
  @RequireAnyPermission(...SIS_OPS_CONFIG, ...SIS_OPS_VIEW)
  config(@CurrentUser() user: JwtUser) {
    return this.ops.configGet(user.tid);
  }

  @Patch('config')
  @RequireAnyPermission(...SIS_OPS_CONFIG)
  saveConfig(
    @CurrentUser() user: JwtUser,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.ops.configSave(user.tid, user, body, this.meta(req));
  }

  @Post('diagnostics/:channel')
  @RequireAnyPermission(...SIS_OPS_CONFIG, ...SIS_OPS_MAINT)
  test(
    @CurrentUser() user: JwtUser,
    @Param('channel') channel: string,
    @Req() req: Request,
  ) {
    return this.ops.testChannel(user.tid, user, channel, this.meta(req));
  }

  @Get('storage')
  @RequireAnyPermission(...SIS_OPS_STORAGE, ...SIS_OPS_VIEW)
  storage(@CurrentUser() user: JwtUser) {
    return this.ops.status(user.tid).then((s) => s.storage);
  }

  @Get('jobs')
  @RequireAnyPermission(...SIS_OPS_JOBS)
  jobs() {
    return this.ops.jobs();
  }

  @Post('jobs/:queue/:id/retry')
  @RequireAnyPermission(...SIS_OPS_JOBS_RETRY)
  retry(
    @CurrentUser() user: JwtUser,
    @Param('queue') queue: string,
    @Param('id') id: string,
  ) {
    return this.ops.retryJob(user, queue, id);
  }

  @Post('jobs/:queue/:id/cancel')
  @RequireAnyPermission(...SIS_OPS_JOBS_RETRY)
  cancel(
    @CurrentUser() user: JwtUser,
    @Param('queue') queue: string,
    @Param('id') id: string,
  ) {
    return this.ops.cancelJob(user, queue, id);
  }

  @Get('about')
  @RequireAnyPermission(...SIS_OPS_LICENSE, ...SIS_OPS_VIEW)
  about(@CurrentUser() user: JwtUser) {
    return this.ops.about(user.tid);
  }
}
