import { Injectable, NotFoundException } from '@nestjs/common';
import * as net from 'net';
import { PrismaService } from '../../database/prisma.service';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { DirectZkBiometricConnector } from './connectors/direct-zk-biometric.connector';
import { MiddlewareBiometricConnector } from './connectors/middleware-biometric.connector';
import type {
  DiagnosticStep,
  DeviceHealth,
} from './connectors/biometric-connector';
import { StaffAttendanceService } from './staff-attendance.service';

@Injectable()
export class DeviceHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly directZk: DirectZkBiometricConnector,
    private readonly middleware: MiddlewareBiometricConnector,
    private readonly attendance: StaffAttendanceService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async runDiagnostic(user: JwtUser, deviceId: string, test: string) {
    const device = await this.device(user.tid, deviceId);
    const steps: DiagnosticStep[] = [];

    if (test === 'network' || test === 'full') {
      steps.push(await this.networkStep(device));
    }
    if (test === 'port' || test === 'full') {
      steps.push(await this.portStep(device));
    }
    let health: DeviceHealth | null = null;
    if (
      [
        'authentication',
        'device-info',
        'attendance-pull',
        'staff-upload',
        'time-sync',
        'full',
      ].includes(test)
    ) {
      health = await this.connector(device).testConnection(device);
      steps.push({
        key: 'authentication',
        label: 'Authentication / Handshake',
        status:
          health.authenticationStatus === 'AUTH_SUCCESS' ? 'PASS' : 'FAIL',
        message:
          health.failureReason ??
          health.signalHealth ??
          health.authenticationStatus ??
          'Authentication checked',
        latencyMs: health.latencyMs,
        details: health.diagnostics,
      });
    }
    if ((test === 'device-info' || test === 'full') && health?.deviceInfo) {
      steps.push({
        key: 'device-info',
        label: 'Device Identity',
        status: 'PASS',
        message: 'Device info fetched',
        details: health.deviceInfo as Record<string, unknown>,
      });
    }
    if (test === 'attendance-pull' || test === 'full') {
      try {
        const logs = await this.connector(device).pullPunchLogs(device);
        steps.push({
          key: 'attendance-pull',
          label: 'Attendance Pull',
          status: 'PASS',
          message: `Fetched ${logs.length} sample logs`,
          details: { count: logs.length },
        });
      } catch (error) {
        steps.push({
          key: 'attendance-pull',
          label: 'Attendance Pull',
          status: 'FAIL',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    if (test === 'device-users' || test === 'full') {
      try {
        const users = await this.connector(device).pullUsers(device);
        steps.push({
          key: 'device-users',
          label: 'Device Users',
          status: 'PASS',
          message: `Fetched ${users.length} enrolled device users`,
          details: {
            count: users.length,
            sample: users.slice(0, 10),
          },
        });
      } catch (error) {
        steps.push({
          key: 'device-users',
          label: 'Device Users',
          status: 'FAIL',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    if (test === 'staff-upload') {
      steps.push({
        key: 'staff-upload',
        label: 'Staff Upload',
        status:
          health?.authenticationStatus === 'AUTH_SUCCESS' ? 'PASS' : 'SKIPPED',
        message:
          health?.authenticationStatus === 'AUTH_SUCCESS'
            ? 'Device is authenticated and ready for queued staff upload'
            : 'Staff upload requires a successful authentication check first',
      });
    }
    if (test === 'time-sync') {
      const time = await this.connector(device).syncTime(device);
      steps.push({
        key: 'time-sync',
        label: 'Time Sync',
        status: time.synced ? 'PASS' : 'WARN',
        message: time.synced
          ? 'Device time read successfully'
          : 'Device time read not available',
        details: time as unknown as Record<string, unknown>,
      });
    }

    const finalHealth = health ?? this.healthFromSteps(steps);
    await this.persistHealth(device.id, finalHealth, steps);
    return {
      deviceId,
      status: this.attendance.deriveLegacyStatus(finalHealth),
      networkStatus: finalHealth.networkStatus,
      authenticationStatus: finalHealth.authenticationStatus,
      syncHealthStatus: finalHealth.syncHealthStatus,
      failureReason: finalHealth.failureReason,
      steps,
    };
  }

  async monitorDevice(tenantId: string, deviceId: string) {
    const device = await this.device(tenantId, deviceId);
    const health = await this.connector(device).testConnection(device);
    await this.persistHealth(device.id, health, []);
    return health;
  }

  async monitorAll(tenantId: string) {
    const devices = await this.db().staffBiometricDevice.findMany({
      where: {
        tenantId,
        deletedAt: null,
        registrationStatus: { not: 'DISABLED' },
      },
    });
    const results = [];
    for (const device of devices) {
      results.push(await this.monitorDevice(tenantId, device.id));
    }
    return { checked: results.length, results };
  }

  private connector(device: Record<string, unknown>) {
    return ['TCP_IP', 'DIRECT_TCP'].includes(
      String(device.connectionType ?? ''),
    )
      ? this.directZk
      : this.middleware;
  }

  private async device(tenantId: string, deviceId: string) {
    const device = await this.db().staffBiometricDevice.findFirst({
      where: { id: deviceId, tenantId, deletedAt: null },
    });
    if (!device) throw new NotFoundException('Biometric device not found');
    return device;
  }

  private async networkStep(
    device: Record<string, unknown>,
  ): Promise<DiagnosticStep> {
    const ip = String(device.ipAddress ?? '');
    if (!ip) {
      return {
        key: 'network',
        label: 'Network Reachability',
        status: 'FAIL',
        message: 'Device IP address is missing',
      };
    }
    const validIp = net.isIP(ip) > 0 || /^[a-z0-9.-]+$/i.test(ip);
    return {
      key: 'network',
      label: 'Network Reachability',
      status: validIp ? 'PASS' : 'FAIL',
      message: validIp
        ? 'IP/DNS format is valid; port test performs the real reachability check'
        : 'Invalid IP/DNS format',
      details: { ip },
    };
  }

  private portStep(device: Record<string, unknown>) {
    return new Promise<DiagnosticStep>((resolve) => {
      const ip = String(device.ipAddress ?? '');
      const port = Number(device.port ?? 4370);
      const timeout = Number(device.timeoutSec ?? 5) * 1000;
      const started = Date.now();
      const socket = net.createConnection({ host: ip, port, timeout });
      let done = false;
      const finish = (
        status: DiagnosticStep['status'],
        message: string,
        details?: Record<string, unknown>,
      ) => {
        if (done) return;
        done = true;
        socket.destroy();
        resolve({
          key: 'port',
          label: 'TCP Port',
          status,
          message,
          latencyMs: Date.now() - started,
          details,
        });
      };
      socket.on('connect', () =>
        finish('PASS', `TCP port ${port} is reachable`, { ip, port }),
      );
      socket.on('timeout', () =>
        finish('FAIL', `Connection timed out after ${timeout}ms`, { ip, port }),
      );
      socket.on('error', (error: NodeJS.ErrnoException) => {
        const message =
          error.code === 'ECONNREFUSED'
            ? `Port ${port} is closed/refused`
            : error.code === 'ENOTFOUND'
              ? 'DNS lookup failed'
              : error.message;
        finish('FAIL', message, { ip, port, code: error.code });
      });
    });
  }

  private healthFromSteps(steps: DiagnosticStep[]): DeviceHealth {
    const failed = steps.find((step) => step.status === 'FAIL');
    return {
      status: failed ? 'DISCONNECTED' : 'SYNC_PENDING',
      registrationStatus: 'CONFIGURED',
      networkStatus: failed ? 'OFFLINE' : 'UNKNOWN',
      authenticationStatus: 'NOT_TESTED',
      syncHealthStatus: 'NEVER_SYNCED',
      failureReason: failed?.message,
      diagnostics: { steps },
    };
  }

  private async persistHealth(
    deviceId: string,
    health: DeviceHealth,
    steps: DiagnosticStep[],
  ) {
    await this.db().staffBiometricDevice.update({
      where: { id: deviceId },
      data: {
        status: this.attendance.deriveLegacyStatus(health),
        registrationStatus: health.registrationStatus ?? 'CONFIGURED',
        networkStatus: health.networkStatus ?? 'UNKNOWN',
        authenticationStatus: health.authenticationStatus ?? 'NOT_TESTED',
        syncHealthStatus: health.syncHealthStatus ?? 'NEVER_SYNCED',
        signalHealth: health.signalHealth,
        diagnostics: health.diagnostics ?? { steps },
        lastSeenAt: health.lastSeenAt,
        lastHeartbeatAt:
          health.networkStatus === 'ONLINE' ? new Date() : undefined,
        lastOnlineAt: health.lastOnlineAt,
        lastOfflineAt:
          health.lastOfflineAt ??
          (health.networkStatus !== 'ONLINE' ? new Date() : undefined),
        failureReason: health.failureReason,
        lastDiagnosticAt: new Date(),
        lastDiagnosticPayload: {
          health: this.toJson(health),
          steps: this.toJson(steps),
        },
        firmwareVersion: health.deviceInfo?.firmwareVersion ?? undefined,
        userCount: health.deviceInfo?.userCount ?? undefined,
      },
    });
  }

  private toJson(value: unknown) {
    return JSON.parse(JSON.stringify(value));
  }
}
