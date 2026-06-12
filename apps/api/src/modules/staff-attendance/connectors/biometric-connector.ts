export type DeviceHealth = {
  status:
    | 'CONNECTED'
    | 'DISCONNECTED'
    | 'AUTHENTICATION_FAILED'
    | 'DEVICE_BUSY'
    | 'SYNC_PENDING'
    | 'NOT_CONFIGURED';
  registrationStatus?:
    | 'CONFIGURED'
    | 'DRAFT'
    | 'MISSING_CREDENTIALS'
    | 'DISABLED';
  networkStatus?:
    | 'ONLINE'
    | 'OFFLINE'
    | 'TIMEOUT'
    | 'DNS_FAILED'
    | 'PORT_CLOSED'
    | 'UNKNOWN';
  authenticationStatus?:
    | 'AUTH_SUCCESS'
    | 'INVALID_PASSWORD'
    | 'COMM_KEY_INVALID'
    | 'ACCESS_DENIED'
    | 'HANDSHAKE_FAILED'
    | 'NOT_TESTED';
  syncHealthStatus?:
    | 'HEALTHY'
    | 'WARNING'
    | 'FAILED'
    | 'DELAYED'
    | 'NEVER_SYNCED';
  latencyMs?: number;
  lastSeenAt?: Date;
  lastOnlineAt?: Date;
  lastOfflineAt?: Date;
  failureReason?: string;
  deviceInfo?: DeviceInfo;
  signalHealth?: string;
  diagnostics?: Record<string, unknown>;
};

export type DiagnosticStatus = 'PASS' | 'FAIL' | 'WARN' | 'SKIPPED';

export type DiagnosticStep = {
  key: string;
  label: string;
  status: DiagnosticStatus;
  message: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
};

export type DeviceInfo = {
  serialNumber?: string;
  firmwareVersion?: string;
  model?: string;
  platform?: string;
  deviceTime?: Date;
  timezone?: string;
  userCount?: number;
  logCount?: number;
};

export type RawPunchInput = {
  deviceUserId: string;
  biometricId?: string;
  punchTimestamp: Date;
  verificationMode?: string;
  punchDirection?: string;
  rawPayload: Record<string, unknown>;
};

export type DeviceUser = {
  deviceUserId: string;
  biometricId?: string;
  name?: string;
  employeeCode?: string;
  department?: string;
  cardNumber?: string;
  password?: string;
  privilege?: string;
  enabled?: boolean;
  templateCount?: number;
  faceCount?: number;
  syncStatus?: string;
  validationErrors?: string[];
  status?: string;
};

export type PushResult = {
  total: number;
  successful: number;
  duplicate: number;
  invalid: number;
  failed: number;
  errors: string[];
  validationErrors?: Array<{
    staffProfileId?: string;
    employeeCode?: string;
    fullName?: string;
    deviceUserId?: string;
    missing: string[];
    message: string;
  }>;
  preview?: Array<{
    staffProfileId?: string;
    employeeCode?: string;
    fullName?: string;
    biometricId?: string;
    deviceUserId?: string;
    name?: string;
    cardNumber?: string;
    privilege?: string;
    enabled?: boolean;
    status: string;
    missing: string[];
  }>;
};

export type DeviceTimeResult = {
  deviceTime?: Date;
  serverTime: Date;
  driftSeconds?: number;
  synced: boolean;
};

export interface BiometricConnector {
  testConnection(device: Record<string, unknown>): Promise<DeviceHealth>;
  pullPunchLogs(
    device: Record<string, unknown>,
    range?: { from?: Date; to?: Date },
  ): Promise<RawPunchInput[]>;
  pullUsers(device: Record<string, unknown>): Promise<DeviceUser[]>;
  pushUsers(
    device: Record<string, unknown>,
    users: DeviceUser[],
  ): Promise<PushResult>;
  syncTime(device: Record<string, unknown>): Promise<DeviceTimeResult>;
}
