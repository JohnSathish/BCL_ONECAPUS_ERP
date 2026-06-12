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
export class DirectTcpBiometricConnector implements BiometricConnector {
  async testConnection(): Promise<DeviceHealth> {
    return {
      status: 'NOT_CONFIGURED',
      signalHealth: 'DIRECT_TCP_PENDING_PROTOCOL_VALIDATION',
      diagnostics: {
        connector: 'direct-tcp',
        note: 'Direct eSSL/ZK TCP support is intentionally behind this adapter until tested with a real X2008 device/SDK.',
      },
    };
  }

  async pullPunchLogs(): Promise<RawPunchInput[]> {
    return [];
  }

  async pullUsers(): Promise<DeviceUser[]> {
    return [];
  }

  async pushUsers(
    _device: Record<string, unknown>,
    users: DeviceUser[],
  ): Promise<PushResult> {
    return {
      total: users.length,
      successful: 0,
      duplicate: 0,
      invalid: 0,
      failed: users.length,
      errors: ['Direct TCP connector is not configured in this phase'],
    };
  }

  async syncTime(): Promise<DeviceTimeResult> {
    return {
      serverTime: new Date(),
      synced: false,
      driftSeconds: undefined,
    };
  }
}
