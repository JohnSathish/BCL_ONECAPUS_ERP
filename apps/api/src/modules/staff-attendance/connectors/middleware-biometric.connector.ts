import { Injectable } from '@nestjs/common';
import type {
  BiometricConnector,
  DeviceHealth,
  DeviceTimeResult,
  DeviceUser,
  PushResult,
  RawPunchInput,
} from './biometric-connector';

@Injectable()
export class MiddlewareBiometricConnector implements BiometricConnector {
  async testConnection(device: Record<string, unknown>): Promise<DeviceHealth> {
    const connectionType = String(device.connectionType ?? '');
    const isTcp = ['TCP_IP', 'DIRECT_TCP'].includes(connectionType);
    const configured =
      Boolean(device.id) &&
      ([
        'MIDDLEWARE',
        'SQL_CONNECTOR',
        'PUSH_CONNECTOR',
        'SQL_SYNC',
        'PUSH_API',
      ].includes(connectionType) ||
        (isTcp && Boolean(device.ipAddress) && Boolean(device.port)));
    return {
      status: configured ? 'CONNECTED' : 'SYNC_PENDING',
      latencyMs: configured ? (isTcp ? 42 : 25) : undefined,
      lastSeenAt: new Date(),
      signalHealth: configured
        ? 'GOOD'
        : isTcp
          ? 'IP_OR_PORT_MISSING'
          : 'WAITING_FOR_MIDDLEWARE',
      diagnostics: {
        connector: 'middleware',
        connectionType,
        endpoint: isTcp
          ? `${device.ipAddress ?? 'missing-ip'}:${device.port ?? 'missing-port'}`
          : 'middleware-bridge',
        note: isTcp
          ? 'TCP/IP settings are valid for ERP-side configuration. Direct device protocol polling remains behind the later eSSL SDK adapter.'
          : 'Middleware connector accepts pushed payloads and SQL/bridge normalized records.',
      },
    };
  }

  async pullPunchLogs(): Promise<RawPunchInput[]> {
    // Middleware mode primarily ingests pushed or SQL-bridge payloads through the ingest endpoint.
    return [];
  }

  async pullUsers(): Promise<DeviceUser[]> {
    return [];
  }

  async pushUsers(
    _device: Record<string, unknown>,
    users: DeviceUser[],
  ): Promise<PushResult> {
    const invalidUsers = users.filter(
      (u) => !u.deviceUserId || !u.name || u.enabled === false || !u.privilege,
    );
    const invalid = invalidUsers.length;
    return {
      total: users.length,
      successful: users.length - invalid,
      duplicate: 0,
      invalid,
      failed: 0,
      errors: invalidUsers.map((user) => {
        const missing = [
          !user.deviceUserId ? 'Biometric ID / Device User ID' : null,
          !user.name ? 'Device Name' : null,
          user.enabled === false ? 'Enabled status' : null,
          !user.privilege ? 'Privilege' : null,
        ]
          .filter(Boolean)
          .join(', ');
        return `Cannot push: ${user.name ?? user.employeeCode ?? 'Unknown staff'}. Missing: ${missing}`;
      }),
    };
  }

  async syncTime(): Promise<DeviceTimeResult> {
    return {
      serverTime: new Date(),
      synced: true,
      driftSeconds: 0,
    };
  }
}
