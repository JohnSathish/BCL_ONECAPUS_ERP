'use client';

import { api } from '@/services/api';

export type SecurityDashboard = {
  successfulLogins: number;
  failedLogins24h: number;
  suspiciousIps: Array<{ ipAddress: string; failures: number }>;
  unauthorizedApi7d: number;
  accountLockouts: number;
  lockouts7d: number;
  sensitiveModifications24h: number;
  sensitiveBreakdown: Record<string, number>;
  openAlerts: number;
  activity7d?: Array<{
    date: string;
    label: string;
    failedSignIns: number;
    suspiciousIps: number;
    unauthorizedApi: number;
  }>;
  comparison?: {
    successfulLogins7d: number;
    successfulLoginsPrev7d: number;
    failedLoginsPrev24h: number;
    unauthorizedApiPrev7d: number;
    lockoutsPrev7d: number;
    sensitiveModificationsPrev24h: number;
  };
  recentEvents?: Array<{
    id: string;
    createdAt: string;
    summary: string;
    actor: string;
    ipAddress: string | null;
  }>;
  recentAlerts: Array<{
    id: string;
    ruleCode: string;
    severity: string;
    title: string;
    summary: string;
    status: string;
    createdAt: string;
  }>;
  server: Record<string, string | boolean>;
  backup: {
    lastSuccessAt: string | null;
    lastRunId: string | null;
    type: string | null;
    sizeBytes: string | null;
    encryptionConfigured: boolean;
  };
};

export type SecurityEventRow = {
  id: string;
  createdAt: string;
  eventType: string;
  severity: string;
  action: string;
  actorUserId: string | null;
  module: string | null;
  entityId: string | null;
  summary: string;
  ipAddress: string | null;
  previousValue: unknown;
  newValue: unknown;
};

export type SecurityAlertRow = {
  id: string;
  ruleCode: string;
  severity: string;
  title: string;
  summary: string;
  status: string;
  createdAt: string;
  acknowledgedAt: string | null;
};

export type SecurityPolicy = {
  maxFailures: number;
  windowMinutes: number;
  lockMinutes: number;
  escalatedLockMinutes: number;
  failedLoginAlertThreshold: number;
  suspiciousIpMinIdentifiers: number;
  unauthorizedApiThreshold: number;
  bulkDownloadThreshold: number;
  bulkMutationThreshold: number;
  notifyInApp: boolean;
  notifyEmail: boolean;
  fileIntegrityEnabled: boolean;
};

export type AuditTrailRow = {
  id: string;
  source: string;
  at: string;
  actorUserId: string | null;
  action: string;
  module: string;
  entityId: string | null;
  summary: string;
  ipAddress: string | null;
  severity: string | null;
  previousValue: unknown;
  newValue: unknown;
};

export async function fetchSecurityDashboard() {
  const { data } = await api.get<SecurityDashboard>('/v1/admin/security-centre/dashboard');
  return data;
}

export async function fetchSecurityAlerts(status?: string) {
  const { data } = await api.get<{ items: SecurityAlertRow[]; total: number }>(
    '/v1/admin/security-centre/alerts',
    { params: { status: status || undefined, limit: '50' } },
  );
  return data;
}

export async function acknowledgeSecurityAlert(id: string) {
  const { data } = await api.post(`/v1/admin/security-centre/alerts/${id}/acknowledge`);
  return data;
}

export async function fetchSecurityTrail(params: Record<string, string | undefined>) {
  const { data } = await api.get<{ items: AuditTrailRow[]; total: number }>(
    '/v1/admin/security-centre/trail',
    { params },
  );
  return data;
}

export async function exportSecurityTrail(params: Record<string, string | undefined>) {
  const { data } = await api.get<{ filename: string; csv: string }>(
    '/v1/admin/security-centre/trail/export',
    { params },
  );
  return data;
}

export async function fetchSecurityIntegrity() {
  const { data } = await api.get<{
    chain: {
      ok: boolean;
      brokenAt: number | null;
      checked: number;
      window: number;
      limitation: string;
    };
    files: {
      watched: string[];
      files: Array<{
        relativePath: string;
        sha256: string;
        status: string;
        lastCheckedAt: string;
      }>;
    };
  }>('/v1/admin/security-centre/integrity');
  return data;
}

export async function scanSecurityFiles() {
  const { data } = await api.post('/v1/admin/security-centre/integrity/scan');
  return data;
}

export async function acceptSecurityFile(relativePath: string) {
  const { data } = await api.post('/v1/admin/security-centre/integrity/accept', { relativePath });
  return data;
}

export async function fetchSecurityPolicy() {
  const { data } = await api.get<SecurityPolicy>('/v1/admin/security-centre/policy');
  return data;
}

export async function updateSecurityPolicy(payload: Partial<SecurityPolicy>) {
  const { data } = await api.patch<SecurityPolicy>('/v1/admin/security-centre/policy', payload);
  return data;
}
