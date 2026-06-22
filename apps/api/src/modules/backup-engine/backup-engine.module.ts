import { Module } from '@nestjs/common';
import { CommunicationModule } from '../communication/communication.module';
import { AdministrationModule } from '../administration/administration.module';
import { BackupEngineController } from './backup-engine.controller';
import {
  BackupCloudProcessor,
  BackupRestoreProcessor,
  BackupRunProcessor,
} from './processors/backup-run.processor';
import { BackupAuditService } from './services/backup-audit.service';
import { BackupCloudSyncService } from './services/backup-cloud-sync.service';
import { BackupCryptoService } from './services/backup-crypto.service';
import { BackupDatabaseService } from './services/backup-database.service';
import { BackupFilesService } from './services/backup-files.service';
import { BackupHealthService } from './services/backup-health.service';
import { BackupNotificationService } from './services/backup-notification.service';
import { BackupOrchestratorService } from './services/backup-orchestrator.service';
import { BackupRetentionService } from './services/backup-retention.service';
import { BackupRestoreService } from './services/backup-restore.service';
import { BackupRunExecutorService } from './services/backup-run-executor.service';
import { BackupSchedulerService } from './services/backup-scheduler.service';
import { BackupSettingsExportService } from './services/backup-settings-export.service';
import { BackupVerifyService } from './services/backup-verify.service';
import { SystemMaintenanceService } from './services/system-maintenance.service';
import { TenantBackupExportService } from './services/tenant-backup-export.service';

/** API must not consume backup queue jobs when the worker container handles them. */
const API_RUNS_BACKUP_JOBS = process.env.PROCESS_BACKGROUND_JOBS !== 'worker';

const backupQueueProcessors = API_RUNS_BACKUP_JOBS
  ? [BackupRunProcessor, BackupRestoreProcessor, BackupCloudProcessor]
  : [];

@Module({
  imports: [CommunicationModule, AdministrationModule],
  controllers: [BackupEngineController],
  providers: [
    BackupAuditService,
    BackupCryptoService,
    BackupDatabaseService,
    BackupFilesService,
    BackupSettingsExportService,
    TenantBackupExportService,
    BackupVerifyService,
    BackupCloudSyncService,
    BackupRetentionService,
    BackupRestoreService,
    BackupRunExecutorService,
    BackupNotificationService,
    BackupHealthService,
    BackupOrchestratorService,
    BackupSchedulerService,
    SystemMaintenanceService,
    ...backupQueueProcessors,
  ],
  exports: [SystemMaintenanceService, BackupOrchestratorService],
})
export class BackupEngineModule {}
