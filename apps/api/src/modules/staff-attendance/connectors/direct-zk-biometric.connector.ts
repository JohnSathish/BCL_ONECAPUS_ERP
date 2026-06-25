import { Injectable } from '@nestjs/common';
import * as net from 'net';
import type {
  BiometricConnector,
  DeviceHealth,
  DeviceInfo,
  DeviceTimeResult,
  DeviceUser,
  PushResult,
  RawPunchInput,
} from './biometric-connector';

type ZkClient = {
  createSocket: () => Promise<void>;
  disconnect?: () => Promise<void> | void;
  connectionType?: 'tcp' | 'udp' | null;
  zklibTcp?: {
    executeCmd?: (command: number, data: Buffer | string) => Promise<unknown>;
  };
  zklibUdp?: {
    executeCmd?: (command: number, data: Buffer | string) => Promise<unknown>;
  };
  getInfo?: () => Promise<Record<string, unknown>> | Record<string, unknown>;
  getUsers?: () => Promise<{ data?: unknown[] } | unknown[]>;
  getAttendances?: () => Promise<{ data?: unknown[] } | unknown[]>;
  getSerialNumber?: () => Promise<string>;
  getFirmware?: () => Promise<string>;
  getTime?: () => Promise<Date>;
  setUser?: (...args: unknown[]) => Promise<unknown>;
};

const ZK_COMMAND_USER_WRITE = 8;

function ZKLibCtor(): new (
  ip: string,
  port: number,
  timeout: number,
  inport: number,
  commKey?: number,
) => ZkClient {
  // node-zklib is CommonJS and does not ship stable TS types.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('node-zklib');
  return mod.default ?? mod;
}

@Injectable()
export class DirectZkBiometricConnector implements BiometricConnector {
  async testConnection(device: Record<string, unknown>): Promise<DeviceHealth> {
    const started = Date.now();
    const ip = String(device.ipAddress ?? '');
    const port = Number(device.port ?? 4370);
    const timeoutMs = Number(device.timeoutSec ?? 5) * 1000;
    const commKey =
      Number(device.communicationKey ?? device.deviceKey ?? 0) || 0;

    if (!ip) {
      return this.failed(
        'OFFLINE',
        'HANDSHAKE_FAILED',
        'Device IP address is missing',
      );
    }

    const network = await this.testTcp(ip, port, timeoutMs);
    if (!network.ok) {
      return {
        ...this.failed(
          network.status,
          'NOT_TESTED',
          network.reason ?? network.status,
        ),
        latencyMs: Date.now() - started,
        lastOfflineAt: new Date(),
        diagnostics: { tcp: network },
      };
    }

    let client: ZkClient | null = null;
    try {
      const ZKLib = ZKLibCtor();
      client = new ZKLib(ip, port, timeoutMs, 4000, commKey);
      await client.createSocket();
      const info = await this.readDeviceInfo(client);
      await this.disconnect(client);
      return {
        status: 'CONNECTED',
        registrationStatus: 'CONFIGURED',
        networkStatus: 'ONLINE',
        authenticationStatus: 'AUTH_SUCCESS',
        syncHealthStatus: device.lastSyncAt ? 'HEALTHY' : 'NEVER_SYNCED',
        latencyMs: Date.now() - started,
        lastSeenAt: new Date(),
        lastOnlineAt: new Date(),
        signalHealth: 'GOOD',
        deviceInfo: info,
        diagnostics: {
          tcp: network,
          handshake: 'PASS',
          identity: this.identityDiagnostics(device, info),
        },
      };
    } catch (error) {
      await this.disconnect(client);
      const message = this.errorMessage(error);
      return {
        status: 'AUTHENTICATION_FAILED',
        registrationStatus: 'CONFIGURED',
        networkStatus: 'ONLINE',
        authenticationStatus: this.classifyAuth(message),
        syncHealthStatus: 'FAILED',
        latencyMs: Date.now() - started,
        lastOfflineAt: new Date(),
        failureReason: message,
        signalHealth: 'HANDSHAKE_FAILED',
        diagnostics: { tcp: network, handshake: 'FAIL', error: message },
      };
    }
  }

  async pullPunchLogs(
    device: Record<string, unknown>,
  ): Promise<RawPunchInput[]> {
    const client = await this.connect(device);
    try {
      const raw = await client.getAttendances?.();
      const rows = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.data)
          ? raw.data
          : [];
      return rows
        .map((row: any) => ({
          deviceUserId: String(
            row.deviceUserId ?? row.userId ?? row.user_id ?? row.id ?? '',
          ),
          biometricId: row.biometricId ? String(row.biometricId) : undefined,
          punchTimestamp: new Date(
            row.recordTime ??
              row.timestamp ??
              row.time ??
              row.date ??
              Date.now(),
          ),
          verificationMode: row.verifyMode
            ? String(row.verifyMode)
            : row.verify_mode
              ? String(row.verify_mode)
              : undefined,
          punchDirection: row.type
            ? String(row.type)
            : row.punchDirection
              ? String(row.punchDirection)
              : undefined,
          rawPayload: row,
        }))
        .filter(
          (row) =>
            row.deviceUserId && !Number.isNaN(row.punchTimestamp.getTime()),
        );
    } finally {
      await this.disconnect(client);
    }
  }

  async pullUsers(device: Record<string, unknown>): Promise<DeviceUser[]> {
    const client = await this.connect(device);
    try {
      const raw = await client.getUsers?.();
      const rows = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.data)
          ? raw.data
          : [];
      return rows
        .map((row: any) => {
          const deviceUserId =
            row.userId ??
            row.userid ??
            row.userID ??
            row.deviceUserId ??
            row.uid;
          return {
            deviceUserId: String(deviceUserId ?? ''),
            biometricId:
              deviceUserId != null ? String(deviceUserId) : undefined,
            name: row.name ? String(row.name) : undefined,
            cardNumber:
              (row.cardno ?? row.cardNo ?? row.cardNumber)
                ? String(row.cardno ?? row.cardNo ?? row.cardNumber)
                : undefined,
            password: row.password ? String(row.password) : undefined,
            privilege:
              row.role != null
                ? String(row.role)
                : row.privilege != null
                  ? String(row.privilege)
                  : undefined,
            enabled: row.enabled ?? row.status !== false,
            templateCount: Number(
              row.templateCount ??
                row.fingerCount ??
                row.fpCount ??
                row.fingerprintCount ??
                0,
            ),
            faceCount: Number(row.faceCount ?? row.faceTemplateCount ?? 0),
          };
        })
        .filter((row) => row.deviceUserId);
    } finally {
      await this.disconnect(client);
    }
  }

  async pushUsers(
    device: Record<string, unknown>,
    users: DeviceUser[],
  ): Promise<PushResult> {
    const client = await this.connect(device);
    let successful = 0;
    const errors: string[] = [];
    try {
      for (const user of users) {
        if (!user.deviceUserId) {
          errors.push(
            `Push failed. Staff: ${user.name ?? user.employeeCode ?? 'Unknown'}. Cause: Missing device user ID payload.`,
          );
          continue;
        }
        if (!user.name) {
          errors.push(
            `Push failed. Staff: ${user.employeeCode ?? user.deviceUserId}. Device User ID: ${user.deviceUserId}. Cause: Missing name payload.`,
          );
          continue;
        }
        const uid = Number.parseInt(user.deviceUserId, 10);
        if (!Number.isFinite(uid)) {
          errors.push(
            `Push failed. Staff: ${user.name}. Device User ID: ${user.deviceUserId}. Cause: eSSL/ZKTeco user ID must be numeric.`,
          );
          continue;
        }
        const role = user.privilege === 'ADMIN' ? 14 : 0;
        await this.writeUser(client, {
          uid,
          deviceUserId: user.deviceUserId,
          name: user.name,
          password: user.password ?? '',
          role,
          cardNumber: user.cardNumber,
        });
        const verificationRows = await client.getUsers?.();
        const rows = Array.isArray(verificationRows)
          ? verificationRows
          : Array.isArray(verificationRows?.data)
            ? verificationRows.data
            : [];
        const found = rows.some(
          (row: any) =>
            String(
              row.userId ??
                row.userid ??
                row.userID ??
                row.deviceUserId ??
                row.uid ??
                '',
            ) === user.deviceUserId,
        );
        if (!found) {
          errors.push(
            `Push failed. Staff: ${user.name}. Device User ID: ${user.deviceUserId}. Cause: SDK write completed but read-back verification failed.`,
          );
          continue;
        }
        successful += 1;
      }
      return {
        total: users.length,
        successful,
        duplicate: 0,
        invalid: 0,
        failed: users.length - successful,
        errors,
      };
    } finally {
      await this.disconnect(client);
    }
  }

  async syncTime(device: Record<string, unknown>): Promise<DeviceTimeResult> {
    const client = await this.connect(device);
    try {
      const deviceTime = client.getTime ? await client.getTime() : undefined;
      const serverTime = new Date();
      return {
        deviceTime,
        serverTime,
        driftSeconds: deviceTime
          ? Math.round((serverTime.getTime() - deviceTime.getTime()) / 1000)
          : undefined,
        synced: Boolean(deviceTime),
      };
    } finally {
      await this.disconnect(client);
    }
  }

  private async connect(device: Record<string, unknown>) {
    const ZKLib = ZKLibCtor();
    const client = new ZKLib(
      String(device.ipAddress),
      Number(device.port ?? 4370),
      Number(device.timeoutSec ?? 5) * 1000,
      4000,
      Number(device.communicationKey ?? device.deviceKey ?? 0) || 0,
    );
    await client.createSocket();
    return client;
  }

  private async readDeviceInfo(client: ZkClient): Promise<DeviceInfo> {
    const [
      info,
      serialNumber,
      firmwareVersion,
      deviceTime,
      users,
      attendances,
    ] = await Promise.allSettled([
      Promise.resolve(client.getInfo?.() ?? {}),
      Promise.resolve(client.getSerialNumber?.()),
      Promise.resolve(client.getFirmware?.()),
      Promise.resolve(client.getTime?.()),
      Promise.resolve(client.getUsers?.()),
      Promise.resolve(client.getAttendances?.()),
    ]);
    const infoValue = info.status === 'fulfilled' ? info.value : {};
    const userRows =
      users.status === 'fulfilled'
        ? Array.isArray(users.value)
          ? users.value
          : Array.isArray(users.value?.data)
            ? users.value.data
            : []
        : [];
    const attendanceRows =
      attendances.status === 'fulfilled'
        ? Array.isArray(attendances.value)
          ? attendances.value
          : Array.isArray(attendances.value?.data)
            ? attendances.value.data
            : []
        : [];
    return {
      serialNumber:
        serialNumber.status === 'fulfilled' ? serialNumber.value : undefined,
      firmwareVersion:
        firmwareVersion.status === 'fulfilled'
          ? firmwareVersion.value
          : undefined,
      model: String(
        (infoValue as any).deviceName ?? (infoValue as any).model ?? '',
      ),
      platform: String((infoValue as any).platform ?? ''),
      deviceTime:
        deviceTime.status === 'fulfilled' ? deviceTime.value : undefined,
      userCount: Number(
        (infoValue as any).userCounts ??
          (infoValue as any).userCount ??
          userRows.length ??
          0,
      ),
      logCount: Number(
        (infoValue as any).logCounts ??
          (infoValue as any).logCount ??
          attendanceRows.length ??
          0,
      ),
    };
  }

  private async writeUser(
    client: ZkClient,
    user: {
      uid: number;
      deviceUserId: string;
      name: string;
      password: string;
      role: number;
      cardNumber?: string;
    },
  ) {
    if (client.setUser) {
      await client.setUser(
        user.uid,
        user.deviceUserId,
        user.name,
        user.password,
        user.role,
        user.cardNumber ?? 0,
      );
      return;
    }

    const target =
      client.connectionType === 'udp' && client.zklibUdp?.executeCmd
        ? client.zklibUdp
        : client.zklibTcp?.executeCmd
          ? client.zklibTcp
          : undefined;

    if (!target?.executeCmd) {
      throw new Error(
        'SDK write unavailable: node-zklib exposes neither setUser nor low-level executeCmd for this connection',
      );
    }

    const payload =
      client.connectionType === 'udp'
        ? this.encodeUser28(user)
        : this.encodeUser72(user);
    await target.executeCmd(ZK_COMMAND_USER_WRITE, payload);
  }

  private encodeUser72(user: {
    uid: number;
    deviceUserId: string;
    name: string;
    password: string;
    role: number;
    cardNumber?: string;
  }) {
    const payload = Buffer.alloc(72);
    payload.writeUInt16LE(user.uid, 0);
    payload.writeUInt8(user.role, 2);
    payload.write(user.password.slice(0, 8), 3, 8, 'ascii');
    payload.write(user.name.slice(0, 24), 11, 24, 'ascii');
    payload.writeUInt32LE(Number(user.cardNumber ?? 0) || 0, 35);
    payload.write(user.deviceUserId.slice(0, 9), 48, 9, 'ascii');
    return payload;
  }

  private encodeUser28(user: {
    uid: number;
    deviceUserId: string;
    name: string;
    role: number;
  }) {
    const payload = Buffer.alloc(28);
    payload.writeUInt16LE(user.uid, 0);
    payload.writeUInt8(user.role, 2);
    payload.write(user.name.slice(0, 8), 8, 8, 'ascii');
    payload.writeUInt32LE(Number(user.deviceUserId) || user.uid, 24);
    return payload;
  }

  private testTcp(ip: string, port: number, timeoutMs: number) {
    return new Promise<{
      ok: boolean;
      status: 'ONLINE' | 'OFFLINE' | 'TIMEOUT' | 'DNS_FAILED' | 'PORT_CLOSED';
      reason?: string;
    }>((resolve) => {
      const socket = net.createConnection({
        host: ip,
        port,
        timeout: timeoutMs,
      });
      let settled = false;
      const finish = (value: {
        ok: boolean;
        status: 'ONLINE' | 'OFFLINE' | 'TIMEOUT' | 'DNS_FAILED' | 'PORT_CLOSED';
        reason?: string;
      }) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve(value);
      };
      socket.on('connect', () => finish({ ok: true, status: 'ONLINE' }));
      socket.on('timeout', () =>
        finish({
          ok: false,
          status: 'TIMEOUT',
          reason: `Connection timed out after ${timeoutMs}ms`,
        }),
      );
      socket.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOTFOUND')
          finish({
            ok: false,
            status: 'DNS_FAILED',
            reason: 'DNS lookup failed',
          });
        else if (error.code === 'ECONNREFUSED')
          finish({
            ok: false,
            status: 'PORT_CLOSED',
            reason: `Port ${port} is closed or refused`,
          });
        else if (error.code === 'EHOSTUNREACH' || error.code === 'ENETUNREACH')
          finish({
            ok: false,
            status: 'OFFLINE',
            reason: 'Host is unreachable',
          });
        else finish({ ok: false, status: 'OFFLINE', reason: error.message });
      });
    });
  }

  private failed(
    networkStatus: DeviceHealth['networkStatus'],
    authenticationStatus: DeviceHealth['authenticationStatus'],
    reason: string,
  ): DeviceHealth {
    return {
      status: 'DISCONNECTED',
      registrationStatus: 'CONFIGURED',
      networkStatus,
      authenticationStatus,
      syncHealthStatus: 'FAILED',
      failureReason: reason,
      signalHealth: reason,
    };
  }

  private classifyAuth(
    message: string,
  ): NonNullable<DeviceHealth['authenticationStatus']> {
    const lower = message.toLowerCase();
    if (lower.includes('password')) return 'INVALID_PASSWORD';
    if (lower.includes('key') || lower.includes('comm'))
      return 'COMM_KEY_INVALID';
    if (lower.includes('denied') || lower.includes('access'))
      return 'ACCESS_DENIED';
    return 'HANDSHAKE_FAILED';
  }

  private identityDiagnostics(
    device: Record<string, unknown>,
    info: DeviceInfo,
  ) {
    return {
      serialMatches:
        !device.serialNumber ||
        !info.serialNumber ||
        device.serialNumber === info.serialNumber,
      configuredSerial: device.serialNumber,
      deviceSerial: info.serialNumber,
      configuredModel: device.model,
      deviceModel: info.model,
    };
  }

  private errorMessage(error: unknown) {
    if (error instanceof Error && error.message) return error.message;
    if (error && typeof error === 'object') {
      const nested = error as { message?: string; err?: { message?: string } };
      if (nested.err?.message) return nested.err.message;
      if (nested.message) return nested.message;
      try {
        return JSON.stringify(error);
      } catch {
        return String(error);
      }
    }
    return String(error);
  }

  private async disconnect(client: ZkClient | null) {
    try {
      await client?.disconnect?.();
    } catch {
      // Ignore disconnect errors after failed handshakes.
    }
  }
}
