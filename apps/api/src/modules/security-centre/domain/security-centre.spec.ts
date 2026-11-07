import { csvCell, toCsv } from './csv';
import { normalizeLoginProtection } from './login-protection';
import {
  maskSecurityIdentifier,
  redactSecurityValue,
} from './redact-security-payload';
import { hashSecurityRecord, verifySecurityChain } from './security-hash';
import {
  backupActionToSecurityEvent,
  inferAdminSecurityEvent,
} from './security-event.types';
import { superAdminAccessDenial } from './super-admin-access';
import { evaluateThreats } from './threat-rules';
import { resolveWatchedPath } from './watched-path';

const policy = normalizeLoginProtection(null);

describe('security centre rules', () => {
  it('alerts on repeated failures, privileged accounts, and backup deletion', () => {
    const findings = evaluateThreats({
      eventType: 'LOGIN_FAILED',
      policy,
      recentFailedLogins: 5,
      distinctFailedIdentifiersOnIp: 4,
      recentUnauthorized: 0,
      recentDownloads: 0,
      recentMutations: 0,
    });
    expect(findings.map((item) => item.ruleCode)).toEqual([
      'REPEATED_FAILED_LOGIN',
      'SUSPICIOUS_IP',
    ]);

    expect(
      evaluateThreats({
        eventType: 'ADMIN_ACCOUNT_CREATED',
        policy,
        recentFailedLogins: 0,
        distinctFailedIdentifiersOnIp: 0,
        recentUnauthorized: 0,
        recentDownloads: 0,
        recentMutations: 0,
      })[0],
    ).toMatchObject({
      ruleCode: 'UNEXPECTED_ADMIN_ACCOUNT',
      severity: 'CRITICAL',
    });

    expect(
      evaluateThreats({
        eventType: 'BACKUP_DELETION',
        policy,
        recentFailedLogins: 0,
        distinctFailedIdentifiersOnIp: 0,
        recentUnauthorized: 0,
        recentDownloads: 0,
        recentMutations: 0,
      })[0].severity,
    ).toBe('CRITICAL');
  });

  it('does not alert on a single failed sign-in', () => {
    expect(
      evaluateThreats({
        eventType: 'LOGIN_FAILED',
        policy,
        recentFailedLogins: 1,
        distinctFailedIdentifiersOnIp: 1,
        recentUnauthorized: 0,
        recentDownloads: 0,
        recentMutations: 0,
      }),
    ).toEqual([]);
  });

  it('classifies privileged account creation and ordinary student edits differently', () => {
    expect(
      inferAdminSecurityEvent({
        module: 'administration',
        action: 'erp_user.created',
        entityType: 'user',
        metadata: { role: 'super-admin' },
      })?.eventType,
    ).toBe('ADMIN_ACCOUNT_CREATED');
    expect(
      inferAdminSecurityEvent({
        module: 'students',
        action: 'profile.updated',
        entityType: 'student',
      })?.eventType,
    ).toBe('DATA_CHANGE');
    expect(backupActionToSecurityEvent('DELETE').eventType).toBe(
      'BACKUP_DELETION',
    );
  });

  it('redacts secrets and masks identifiers used in notices', () => {
    expect(redactSecurityValue({ password: 'secret', name: 'Ada' })).toEqual({
      password: '[redacted]',
      name: 'Ada',
    });
    expect(redactSecurityValue({ tokenPreview: 'abcd1234' })).toEqual({
      tokenPreview: '[redacted]',
    });
    expect(maskSecurityIdentifier('student@college.edu')).toBe(
      's***@college.edu',
    );
  });

  it('detects a broken hash chain and keeps an intact chain valid', () => {
    const first = {
      tenantId: 't',
      actorUserId: null,
      eventType: 'LOGIN_FAILED',
      severity: 'medium',
      module: 'auth',
      entityType: null,
      entityId: null,
      action: 'login_failure',
      ipAddress: '203.0.113.4',
      summary: 'Failed sign-in',
      subjectKey: 'ip:203.0.113.4',
      createdAt: '2026-11-07T00:00:00.000Z',
    };
    const firstHash = hashSecurityRecord(first, null);
    const second = { ...first, createdAt: '2026-11-07T00:01:00.000Z' };
    const secondHash = hashSecurityRecord(second, firstHash);
    expect(
      verifySecurityChain([
        { prevHash: null, recordHash: firstHash, payload: first },
        { prevHash: firstHash, recordHash: secondHash, payload: second },
      ]).ok,
    ).toBe(true);
    expect(
      verifySecurityChain([
        { prevHash: null, recordHash: firstHash, payload: first },
        { prevHash: 'tampered', recordHash: secondHash, payload: second },
      ]).ok,
    ).toBe(false);
  });

  it('keeps login defaults and refuses paths outside the watch root', () => {
    expect(normalizeLoginProtection({ maxFailures: 0 }).maxFailures).toBe(3);
    expect(normalizeLoginProtection(null).maxFailures).toBe(8);
    expect(resolveWatchedPath('/app', 'prisma/schema.prisma')).toMatch(
      /schema\.prisma$/,
    );
    expect(resolveWatchedPath('/app', '../secrets.env')).toBeNull();
    expect(resolveWatchedPath('/app', 'src/../../etc/passwd')).toBeNull();
  });

  it('limits the centre to super administrators and escapes spreadsheet formulas', () => {
    expect(superAdminAccessDenial(undefined)).toMatch(/Authentication/);
    expect(superAdminAccessDenial({ roles: ['accountant'] })).toMatch(
      /super administrators/,
    );
    expect(
      superAdminAccessDenial({ roles: ['super-admin'], isImpersonating: true }),
    ).toMatch(/impersonation/);
    expect(superAdminAccessDenial({ roles: ['college-admin'] })).toBeNull();
    expect(csvCell('=cmd|evil')).toBe("'=cmd|evil");
    expect(toCsv(['note'], [['safe']])).toBe('note\nsafe');
  });
});
