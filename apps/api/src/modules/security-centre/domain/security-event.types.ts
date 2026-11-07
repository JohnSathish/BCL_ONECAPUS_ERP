export const SECURITY_EVENT_TYPES = [
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'LOGOUT',
  'PASSWORD_CHANGE',
  'PASSWORD_RESET',
  'MFA_CHANGE',
  'NEW_DEVICE_LOGIN',
  'SESSION_EXPIRED',
  'ACCOUNT_LOCKOUT',
  'UNAUTHORIZED_API',
  'PRIVILEGE_CHANGE',
  'ADMIN_ACCOUNT_CREATED',
  'DATA_CHANGE',
  'BULK_DOWNLOAD',
  'BACKUP_DELETION',
  'BACKUP_ACTIVITY',
  'FILE_INTEGRITY',
  'FILE_BASELINE_ACCEPTED',
  'POLICY_CHANGE',
  'ALERT_ACKNOWLEDGED',
] as const;

export type SecurityEventType = (typeof SECURITY_EVENT_TYPES)[number];

export type SecuritySeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type SecurityCaptureInput = {
  tenantId: string;
  actorUserId?: string | null;
  eventType: SecurityEventType;
  severity?: SecuritySeverity;
  module?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  action: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  summary: string;
  previousValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown> | null;
  subjectKey?: string | null;
};

const PRIVILEGED_ROLES = ['super-admin', 'college-admin', 'university-admin'];

export function inferAdminSecurityEvent(input: {
  module?: string | null;
  action?: string | null;
  entityType?: string | null;
  metadata?: Record<string, unknown> | null;
}): { eventType: SecurityEventType; severity: SecuritySeverity } | null {
  const moduleName = (input.module ?? '').toLowerCase();
  const action = (input.action ?? '').toLowerCase();
  const entity = (input.entityType ?? '').toLowerCase();
  const blob = `${moduleName} ${action} ${entity}`;
  const sensitive =
    /student|exam|attendance|fee|payment|staff|payroll|salary|rbac|user|admin|setting|auth|role|permission|backup|report/.test(
      blob,
    );
  if (!sensitive) return null;

  const meta = JSON.stringify(input.metadata ?? {}).toLowerCase();
  const privileged = PRIVILEGED_ROLES.some((role) => meta.includes(role));
  if (
    privileged &&
    /(create|created|assign|grant)/.test(action) &&
    /(user|role|account)/.test(blob)
  ) {
    return { eventType: 'ADMIN_ACCOUNT_CREATED', severity: 'critical' };
  }
  if (/backup/.test(blob) && /delete/.test(action)) {
    return { eventType: 'BACKUP_DELETION', severity: 'critical' };
  }
  if (/(role|permission|rbac)/.test(blob)) {
    return { eventType: 'PRIVILEGE_CHANGE', severity: 'high' };
  }
  if (/(export|download)/.test(action)) {
    return { eventType: 'BULK_DOWNLOAD', severity: 'medium' };
  }
  if (/delete/.test(action)) {
    return { eventType: 'DATA_CHANGE', severity: 'high' };
  }
  return { eventType: 'DATA_CHANGE', severity: 'low' };
}

export function backupActionToSecurityEvent(action: string): {
  eventType: SecurityEventType;
  severity: SecuritySeverity;
} {
  if (action === 'DELETE') {
    return { eventType: 'BACKUP_DELETION', severity: 'critical' };
  }
  if (action === 'DOWNLOAD') {
    return { eventType: 'BULK_DOWNLOAD', severity: 'medium' };
  }
  return { eventType: 'BACKUP_ACTIVITY', severity: 'low' };
}
