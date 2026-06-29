import { Module } from '@nestjs/common';
import { QueueModule } from '../../shared/queue/queue.module';
import { AttendanceProcessingOrchestratorService } from './attendance-processing-orchestrator.service';
import { AttendanceAnalyticsService } from './attendance-analytics.service';
import { AttendanceExportService } from './attendance-export.service';
import { AttendancePolicyEngineService } from './attendance-policy-engine.service';
import { AttendanceSettingsController } from './attendance-settings.controller';
import { AttendanceSettingsService } from './attendance-settings.service';
import { BiometricDevicesController } from './biometric-devices.controller';
import { BiometricMappingController } from './biometric-mapping.controller';
import { DirectTcpBiometricConnector } from './connectors/direct-tcp-biometric.connector';
import { DirectZkBiometricConnector } from './connectors/direct-zk-biometric.connector';
import { ETimeTrackLiteWebConnector } from './connectors/etime-track-lite-web.connector';
import { MiddlewareBiometricConnector } from './connectors/middleware-biometric.connector';
import { DeviceHealthService } from './device-health.service';
import { DeviceHealthMonitorService } from './device-health-monitor.service';
import { StaffAttendanceController } from './staff-attendance.controller';
import { StaffAttendanceEngineService } from './staff-attendance-engine.service';
import { StaffAttendanceProcessor } from './staff-attendance.processor';
import { StaffAttendanceService } from './staff-attendance.service';

@Module({
  imports: [QueueModule],
  controllers: [
    StaffAttendanceController,
    AttendanceSettingsController,
    BiometricDevicesController,
    BiometricMappingController,
  ],
  providers: [
    StaffAttendanceService,
    StaffAttendanceEngineService,
    AttendancePolicyEngineService,
    AttendanceAnalyticsService,
    AttendanceExportService,
    AttendanceProcessingOrchestratorService,
    AttendanceSettingsService,
    DeviceHealthService,
    DeviceHealthMonitorService,
    StaffAttendanceProcessor,
    MiddlewareBiometricConnector,
    DirectTcpBiometricConnector,
    DirectZkBiometricConnector,
    ETimeTrackLiteWebConnector,
  ],
  exports: [
    StaffAttendanceService,
    StaffAttendanceEngineService,
    AttendancePolicyEngineService,
    AttendanceSettingsService,
    StaffAttendanceProcessor,
  ],
})
export class StaffAttendanceModule {}
