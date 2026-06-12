import { Injectable } from '@nestjs/common';
import type {
  BiometricConnector,
  DeviceHealth,
  DeviceTimeResult,
  DeviceUser,
  PushResult,
  RawPunchInput,
} from './biometric-connector';

type ETimeSettings = {
  webServiceUrl: string;
  username?: string;
  password?: string;
  companyShortName?: string;
  addEmployeeOperation: string;
  transactionsOperation: string;
  commandStatusOperation: string;
  fieldMap: Record<string, string>;
};

@Injectable()
export class ETimeTrackLiteWebConnector implements BiometricConnector {
  async testConnection(device: Record<string, unknown>): Promise<DeviceHealth> {
    const started = Date.now();
    const settings = this.settings(device);
    if (!settings.webServiceUrl) {
      return {
        status: 'NOT_CONFIGURED',
        registrationStatus: 'MISSING_CREDENTIALS',
        networkStatus: 'UNKNOWN',
        authenticationStatus: 'NOT_TESTED',
        syncHealthStatus: 'NEVER_SYNCED',
        failureReason: 'eTimeTrackLite WebAPIService.asmx URL is missing.',
        diagnostics: { connector: 'etimeTrackLiteWeb' },
      };
    }

    try {
      const response = await this.call(
        settings,
        settings.commandStatusOperation,
        { CommandId: 'PING' },
        'GET',
      );
      return {
        status: 'CONNECTED',
        registrationStatus: 'CONFIGURED',
        networkStatus: 'ONLINE',
        authenticationStatus: response.ok ? 'AUTH_SUCCESS' : 'HANDSHAKE_FAILED',
        syncHealthStatus: 'HEALTHY',
        latencyMs: Date.now() - started,
        lastSeenAt: new Date(),
        lastOnlineAt: new Date(),
        signalHealth: response.ok
          ? 'WEB_API_REACHABLE'
          : 'WEB_API_RETURNED_ERROR',
        deviceInfo: {
          model: String(device.model ?? 'eTimeTrackLite Web'),
          platform: 'eBioserverNew WebAPIService.asmx',
          timezone: String(device.timezone ?? 'Asia/Kolkata'),
        },
        diagnostics: {
          connector: 'etimeTrackLiteWeb',
          endpoint: settings.webServiceUrl,
          operation: settings.commandStatusOperation,
          httpStatus: response.status,
          responsePreview: response.preview,
        },
      };
    } catch (error) {
      return {
        status: 'DISCONNECTED',
        registrationStatus: 'CONFIGURED',
        networkStatus: 'OFFLINE',
        authenticationStatus: 'HANDSHAKE_FAILED',
        syncHealthStatus: 'FAILED',
        latencyMs: Date.now() - started,
        lastOfflineAt: new Date(),
        failureReason: error instanceof Error ? error.message : String(error),
        signalHealth: 'WEB_API_UNREACHABLE',
        diagnostics: {
          connector: 'etimeTrackLiteWeb',
          endpoint: settings.webServiceUrl,
        },
      };
    }
  }

  async pullPunchLogs(
    device: Record<string, unknown>,
    range?: { from?: Date; to?: Date },
  ): Promise<RawPunchInput[]> {
    const settings = this.settings(device);
    const response = await this.call(settings, settings.transactionsOperation, {
      FromDate: this.formatDate(range?.from),
      ToDate: this.formatDate(range?.to),
    });
    return this.parseTransactions(response.text);
  }

  async pullUsers(): Promise<DeviceUser[]> {
    // eSSL's public WebAPI list focuses on employee push/delete/block and transaction logs.
    // Device user listing still belongs to direct SDK or database bridge mode.
    return [];
  }

  async pushUsers(
    device: Record<string, unknown>,
    users: DeviceUser[],
  ): Promise<PushResult> {
    const settings = this.settings(device);
    const errors: string[] = [];
    let successful = 0;
    let invalid = 0;

    for (const user of users) {
      const missing = [
        !user.deviceUserId ? 'Device User ID / Biometric ID' : null,
        !user.name ? 'Device Display Name' : null,
        user.enabled === false ? 'Enabled status' : null,
        !user.privilege ? 'Privilege' : null,
      ].filter(Boolean);
      if (missing.length) {
        invalid += 1;
        errors.push(
          `Cannot push: ${user.name ?? user.employeeCode ?? 'Unknown staff'}. Missing: ${missing.join(', ')}`,
        );
        continue;
      }

      try {
        const response = await this.call(
          settings,
          settings.addEmployeeOperation,
          this.employeePayload(settings, user),
        );
        if (!response.ok || this.looksFailed(response.text)) {
          errors.push(
            `Push failed. Staff: ${user.name}. Device User ID: ${user.deviceUserId}. Cause: ${this.failureText(response.text, response.status)}`,
          );
          continue;
        }
        successful += 1;
      } catch (error) {
        errors.push(
          `Push failed. Staff: ${user.name}. Device User ID: ${user.deviceUserId}. Cause: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return {
      total: users.length,
      successful,
      duplicate: 0,
      invalid,
      failed: users.length - successful - invalid,
      errors,
    };
  }

  async syncTime(): Promise<DeviceTimeResult> {
    return { serverTime: new Date(), synced: false, driftSeconds: 0 };
  }

  private settings(device: Record<string, unknown>): ETimeSettings {
    const rawSettings = this.record(device.settings);
    const etime = this.record(rawSettings.etimeTrackLite);
    const protocol = device.sslEnabled ? 'https' : 'http';
    const fallbackUrl = device.ipAddress
      ? `${protocol}://${device.ipAddress}:${Number(device.port ?? 3366)}/WebAPIService.asmx`
      : '';
    return {
      webServiceUrl: String(
        etime.webServiceUrl ?? rawSettings.webServiceUrl ?? fallbackUrl,
      ).trim(),
      username: this.optionalString(etime.username ?? rawSettings.username),
      password: this.optionalString(
        etime.password ?? rawSettings.password ?? device.devicePassword,
      ),
      companyShortName: this.optionalString(
        etime.companyShortName ?? rawSettings.companyShortName,
      ),
      addEmployeeOperation: String(etime.addEmployeeOperation ?? 'AddEmployee'),
      transactionsOperation: String(
        etime.transactionsOperation ?? 'GetTransactionsLog',
      ),
      commandStatusOperation: String(
        etime.commandStatusOperation ?? 'GetCommandStatus',
      ),
      fieldMap: {
        employeeCode: 'EmployeeCode',
        deviceUserId: 'EmployeeCode',
        name: 'EmployeeName',
        cardNumber: 'CardNumber',
        privilege: 'Privilege',
        password: 'Password',
        companyShortName: 'CompanySName',
        username: 'UserName',
        loginName: 'LoginName',
        loginPassword: 'Password',
        ...this.record(etime.fieldMap ?? rawSettings.fieldMap),
      },
    };
  }

  private employeePayload(settings: ETimeSettings, user: DeviceUser) {
    const map = settings.fieldMap;
    const payload: Record<string, string> = {
      [map.employeeCode]: user.employeeCode ?? user.deviceUserId,
      [map.deviceUserId]: user.deviceUserId,
      [map.name]: user.name ?? '',
      [map.cardNumber]: user.cardNumber ?? '',
      [map.privilege]: user.privilege ?? 'USER',
      [map.password]: user.password ?? '',
    };
    if (settings.companyShortName)
      payload[map.companyShortName] = settings.companyShortName;
    if (settings.username) {
      payload[map.username] = settings.username;
      payload[map.loginName] = settings.username;
    }
    if (settings.password) payload[map.loginPassword] = settings.password;
    return payload;
  }

  private async call(
    settings: ETimeSettings,
    operation: string,
    payload: Record<string, string | undefined>,
    method: 'GET' | 'POST' = 'POST',
  ) {
    if (!settings.webServiceUrl)
      throw new Error('eTimeTrackLite WebAPIService.asmx URL is missing.');
    const endpoint = new URL(settings.webServiceUrl);
    endpoint.searchParams.set('op', operation);
    const body = new URLSearchParams();
    Object.entries(payload).forEach(([key, value]) => {
      if (value != null && value !== '') body.set(key, value);
    });

    const response = await fetch(endpoint, {
      method,
      headers:
        method === 'POST'
          ? { 'Content-Type': 'application/x-www-form-urlencoded' }
          : undefined,
      body: method === 'POST' ? body : undefined,
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      text,
      preview: text.replace(/\s+/g, ' ').slice(0, 500),
    };
  }

  private parseTransactions(text: string): RawPunchInput[] {
    const rows = this.extractRows(text);
    return rows
      .map((row) => {
        const deviceUserId =
          row.UserID ??
          row.EmployeeCode ??
          row.EmployeeID ??
          row.EmpCode ??
          row.PIN ??
          '';
        const timestamp =
          row.PunchTime ??
          row.LogDate ??
          row.DateTime ??
          row.AttendanceDateTime ??
          row.TransactionTime;
        return {
          deviceUserId: String(deviceUserId),
          biometricId: String(deviceUserId || ''),
          punchTimestamp: new Date(timestamp ?? Date.now()),
          verificationMode: row.VerifyMode ?? row.VerificationMode,
          punchDirection: row.Direction ?? row.InOutMode,
          rawPayload: row,
        };
      })
      .filter(
        (row) =>
          row.deviceUserId && !Number.isNaN(row.punchTimestamp.getTime()),
      );
  }

  private extractRows(text: string): Array<Record<string, string>> {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed))
        return parsed.map((row) => this.recordOfStrings(row));
      if (this.record(parsed).data && Array.isArray(this.record(parsed).data)) {
        return (this.record(parsed).data as unknown[]).map((row) =>
          this.recordOfStrings(row),
        );
      }
    } catch {
      // Continue with XML-ish parsing below.
    }

    const rowMatches = Array.from(
      text.matchAll(
        /<(?:Table|Transaction|Log|Row)[^>]*>([\s\S]*?)<\/(?:Table|Transaction|Log|Row)>/gi,
      ),
    );
    return rowMatches.map((match) => this.parseXmlRecord(match[1] ?? ''));
  }

  private parseXmlRecord(xml: string) {
    const row: Record<string, string> = {};
    for (const match of xml.matchAll(
      /<([A-Za-z0-9_]+)[^>]*>([\s\S]*?)<\/\1>/g,
    )) {
      row[match[1]] = this.decodeXml(match[2].replace(/<[^>]+>/g, '').trim());
    }
    return row;
  }

  private looksFailed(text: string) {
    return (
      /error|failed|invalid|duplicate|not\s+found|false/i.test(text) &&
      !/success|true/i.test(text)
    );
  }

  private failureText(text: string, status: number) {
    const clean = text
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return clean.slice(0, 300) || `HTTP ${status}`;
  }

  private formatDate(value?: Date) {
    if (!value) return undefined;
    return value.toISOString().slice(0, 10);
  }

  private record(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private recordOfStrings(value: unknown): Record<string, string> {
    const row = this.record(value);
    return Object.fromEntries(
      Object.entries(row).map(([key, item]) => [key, String(item ?? '')]),
    );
  }

  private optionalString(value: unknown) {
    return value == null || value === '' ? undefined : String(value);
  }

  private decodeXml(value: string) {
    return value
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }
}
