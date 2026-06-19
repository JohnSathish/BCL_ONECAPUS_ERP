import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import {
  RequirePermissions,
  RequireAnyPermission,
} from '../../common/decorators/require-permissions.decorator';
import { RequireStepUp } from '../../common/decorators/require-step-up.decorator';
import { isSuperAdmin } from '../../common/permissions/permission-registry';
import { extractClientIp } from '../../common/utils/request-host';
import { AdminAuditHelper } from '../administration/admin-audit.helper';
import {
  ListBackupLogsQueryDto,
  ListBackupRunsQueryDto,
  RestoreBackupDto,
  TenantExportDto,
  TriggerBackupRunDto,
  UpdateBackupScheduleDto,
  UpdateCloudTargetDto,
  UpdateRetentionPolicyDto,
} from './dto/backup.dto';
import { BackupAuditService } from './services/backup-audit.service';
import { BackupOrchestratorService } from './services/backup-orchestrator.service';
import { BackupRestoreService } from './services/backup-restore.service';

function requireSuperAdmin(user: JwtUser) {
  if (!isSuperAdmin(user.roles ?? [])) {
    throw new ForbiddenException('Super-admin access required');
  }
}

@ApiBearerAuth()
@ApiTags('admin-backups')
@Controller({ path: 'admin/backups', version: '1' })
export class BackupEngineController {
  constructor(
    private readonly orchestrator: BackupOrchestratorService,
    private readonly restore: BackupRestoreService,
    private readonly audit: BackupAuditService,
    private readonly adminAudit: AdminAuditHelper,
  ) {}

  @Get('dashboard')
  @RequirePermissions('backup:read')
  dashboard() {
    return this.orchestrator.getDashboard();
  }

  @Get('schedule')
  @RequirePermissions('backup:read')
  getSchedule() {
    return this.orchestrator.getSchedule();
  }

  @Put('schedule')
  @RequirePermissions('backup:manage')
  updateSchedule(@Body() dto: UpdateBackupScheduleDto) {
    return this.orchestrator.updateSchedule(dto);
  }

  @Get('retention')
  @RequirePermissions('backup:read')
  getRetention() {
    return this.orchestrator.getRetentionPolicy();
  }

  @Put('retention')
  @RequirePermissions('backup:manage')
  updateRetention(@Body() dto: UpdateRetentionPolicyDto) {
    return this.orchestrator.updateRetentionPolicy(dto);
  }

  @Get('cloud-targets')
  @RequirePermissions('backup:read')
  listCloudTargets() {
    return this.orchestrator.listCloudTargets();
  }

  @Put('cloud-targets')
  @RequirePermissions('backup:manage')
  updateCloudTarget(@Body() dto: UpdateCloudTargetDto) {
    return this.orchestrator.upsertCloudTarget(dto);
  }

  @Post('run')
  @RequirePermissions('backup:manage')
  triggerRun(@CurrentUser() user: JwtUser, @Body() dto: TriggerBackupRunDto) {
    return this.orchestrator.triggerRun({
      type: dto.type,
      tenantId: dto.tenantId,
      userId: user.sub,
    });
  }

  @Get('runs')
  @RequirePermissions('backup:read')
  listRuns(@Query() query: ListBackupRunsQueryDto) {
    return this.orchestrator.listRuns({
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 20,
      status: query.status,
    });
  }

  @Get('runs/:id')
  @RequirePermissions('backup:read')
  getRun(@Param('id') id: string) {
    return this.orchestrator.getRun(id);
  }

  @Get('runs/:id/download/:artifactId')
  @RequirePermissions('backup:download')
  @RequireStepUp()
  async download(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('artifactId') artifactId: string,
    @Req() req: Request,
  ): Promise<StreamableFile> {
    requireSuperAdmin(user);
    const file = await this.orchestrator.downloadArtifact(id, artifactId);
    const ip = extractClientIp(req);
    await this.audit.log({
      action: 'DOWNLOAD',
      actorId: user.sub,
      ipAddress: ip,
      runId: id,
      metadata: { artifactId },
    });
    await this.adminAudit.log({
      tenantId: user.tid,
      userId: user.sub,
      module: 'backup',
      action: 'backup.download',
      entityType: 'backup_artifact',
      entityId: artifactId,
      metadata: { runId: id, ipAddress: ip },
    });
    return file;
  }

  @Post('runs/:id/verify')
  @RequirePermissions('backup:manage')
  verify(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.orchestrator.verifyRun(id, user.sub);
  }

  @Delete('runs/:id')
  @RequirePermissions('backup:manage')
  deleteRun(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.orchestrator.deleteRun(id, user.sub);
  }

  @Post('restore')
  @RequirePermissions('backup:restore')
  restoreBackup(
    @CurrentUser() user: JwtUser,
    @Body() dto: RestoreBackupDto,
    @Req() req: Request,
  ) {
    requireSuperAdmin(user);
    return this.restore.initiateRestore({
      runId: dto.runId,
      mode: dto.mode,
      confirmText: dto.confirmText,
      userId: user.sub,
      ipAddress: extractClientIp(req),
    });
  }

  @Get('logs')
  @RequirePermissions('backup:read')
  logs(@Query() query: ListBackupLogsQueryDto) {
    return this.audit.list({
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 30,
      action: query.action,
    });
  }

  @Post('tenant-export')
  @RequirePermissions('backup:manage')
  tenantExport(@CurrentUser() user: JwtUser, @Body() dto: TenantExportDto) {
    return this.orchestrator.triggerRun({
      type: 'TENANT_EXPORT',
      tenantId: dto.tenantId,
      userId: user.sub,
    });
  }
}
