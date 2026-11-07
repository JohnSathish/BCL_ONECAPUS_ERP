import type { LoginProtection } from './login-protection';

export type ThreatSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type ThreatFinding = {
  ruleCode: string;
  severity: ThreatSeverity;
  title: string;
  summary: string;
};

export type ThreatContext = {
  eventType: string;
  policy: Pick<
    LoginProtection,
    | 'failedLoginAlertThreshold'
    | 'suspiciousIpMinIdentifiers'
    | 'unauthorizedApiThreshold'
    | 'bulkDownloadThreshold'
    | 'bulkMutationThreshold'
  >;
  recentFailedLogins: number;
  distinctFailedIdentifiersOnIp: number;
  recentUnauthorized: number;
  recentDownloads: number;
  recentMutations: number;
};

export function evaluateThreats(ctx: ThreatContext): ThreatFinding[] {
  const findings: ThreatFinding[] = [];

  if (
    ctx.eventType === 'LOGIN_FAILED' &&
    ctx.recentFailedLogins >= ctx.policy.failedLoginAlertThreshold
  ) {
    findings.push({
      ruleCode: 'REPEATED_FAILED_LOGIN',
      severity: 'HIGH',
      title: 'Repeated failed sign-ins',
      summary: `${ctx.recentFailedLogins} failed sign-ins were recorded for one subject inside the monitoring window.`,
    });
  }

  if (
    (ctx.eventType === 'LOGIN_FAILED' || ctx.eventType === 'ACCOUNT_LOCKOUT') &&
    ctx.distinctFailedIdentifiersOnIp >= ctx.policy.suspiciousIpMinIdentifiers
  ) {
    findings.push({
      ruleCode: 'SUSPICIOUS_IP',
      severity: 'HIGH',
      title: 'Suspicious sign-in source',
      summary: `One network address failed sign-in for ${ctx.distinctFailedIdentifiersOnIp} different accounts.`,
    });
  }

  if (ctx.eventType === 'ACCOUNT_LOCKOUT') {
    findings.push({
      ruleCode: 'ACCOUNT_LOCKOUT',
      severity: 'MEDIUM',
      title: 'Account temporarily locked',
      summary:
        'Sign-in was paused after too many failed attempts. The lock expires automatically.',
    });
  }

  if (
    ctx.eventType === 'UNAUTHORIZED_API' &&
    ctx.recentUnauthorized >= ctx.policy.unauthorizedApiThreshold
  ) {
    findings.push({
      ruleCode: 'UNAUTHORIZED_API',
      severity: 'MEDIUM',
      title: 'Repeated unauthorized API access',
      summary: `${ctx.recentUnauthorized} permission denials were recorded in the monitoring window.`,
    });
  }

  if (ctx.eventType === 'PRIVILEGE_CHANGE') {
    findings.push({
      ruleCode: 'PRIVILEGE_ESCALATION',
      severity: 'HIGH',
      title: 'Privilege or role change',
      summary:
        'A role or permission assignment was changed. Confirm the actor was authorized.',
    });
  }

  if (ctx.eventType === 'ADMIN_ACCOUNT_CREATED') {
    findings.push({
      ruleCode: 'UNEXPECTED_ADMIN_ACCOUNT',
      severity: 'CRITICAL',
      title: 'Privileged account created',
      summary:
        'An account was created or granted a super-administrator role. Confirm this was expected.',
    });
  }

  if (
    ctx.eventType === 'BULK_DOWNLOAD' &&
    ctx.recentDownloads >= ctx.policy.bulkDownloadThreshold
  ) {
    findings.push({
      ruleCode: 'BULK_DOWNLOAD',
      severity: 'MEDIUM',
      title: 'Unusual bulk download activity',
      summary: `${ctx.recentDownloads} export or download events were recorded in the monitoring window.`,
    });
  }

  if (
    (ctx.eventType === 'DATA_CHANGE' || ctx.eventType === 'MASS_MUTATION') &&
    ctx.recentMutations >= ctx.policy.bulkMutationThreshold
  ) {
    findings.push({
      ruleCode: 'MASS_MUTATION',
      severity: 'HIGH',
      title: 'Mass data modification',
      summary: `${ctx.recentMutations} sensitive data changes were recorded in the monitoring window.`,
    });
  }

  if (ctx.eventType === 'BACKUP_DELETION') {
    findings.push({
      ruleCode: 'BACKUP_DELETION',
      severity: 'CRITICAL',
      title: 'Backup deletion',
      summary: 'A database backup artifact or backup run was deleted.',
    });
  }

  if (ctx.eventType === 'FILE_INTEGRITY') {
    findings.push({
      ruleCode: 'FILE_INTEGRITY',
      severity: 'CRITICAL',
      title: 'Application file changed',
      summary:
        'A watched application or configuration file no longer matches its approved checksum.',
    });
  }

  if (ctx.eventType === 'NEW_DEVICE_LOGIN') {
    findings.push({
      ruleCode: 'NEW_DEVICE_LOGIN',
      severity: 'LOW',
      title: 'Sign-in from a new device',
      summary: 'An account signed in from a device that was not seen before.',
    });
  }

  return findings;
}
