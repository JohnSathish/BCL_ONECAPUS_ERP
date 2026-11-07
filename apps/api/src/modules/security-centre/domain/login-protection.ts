/** Defaults match the historical login lock so unsaved tenants behave as before. */
export const DEFAULT_LOGIN_PROTECTION = {
  maxFailures: 8,
  windowMinutes: 20,
  lockMinutes: 5,
  escalatedLockMinutes: 15,
  failedLoginAlertThreshold: 5,
  suspiciousIpMinIdentifiers: 4,
  unauthorizedApiThreshold: 10,
  bulkDownloadThreshold: 15,
  bulkMutationThreshold: 25,
  notifyInApp: true,
  notifyEmail: true,
  fileIntegrityEnabled: true,
} as const;

export type LoginProtection = {
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

function clamp(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

export function normalizeLoginProtection(
  input: Partial<LoginProtection> | null | undefined,
): LoginProtection {
  const base = DEFAULT_LOGIN_PROTECTION;
  return {
    maxFailures: clamp(
      input?.maxFailures ?? base.maxFailures,
      3,
      20,
      base.maxFailures,
    ),
    windowMinutes: clamp(
      input?.windowMinutes ?? base.windowMinutes,
      5,
      120,
      base.windowMinutes,
    ),
    lockMinutes: clamp(
      input?.lockMinutes ?? base.lockMinutes,
      1,
      60,
      base.lockMinutes,
    ),
    escalatedLockMinutes: clamp(
      input?.escalatedLockMinutes ?? base.escalatedLockMinutes,
      5,
      240,
      base.escalatedLockMinutes,
    ),
    failedLoginAlertThreshold: clamp(
      input?.failedLoginAlertThreshold ?? base.failedLoginAlertThreshold,
      3,
      50,
      base.failedLoginAlertThreshold,
    ),
    suspiciousIpMinIdentifiers: clamp(
      input?.suspiciousIpMinIdentifiers ?? base.suspiciousIpMinIdentifiers,
      2,
      50,
      base.suspiciousIpMinIdentifiers,
    ),
    unauthorizedApiThreshold: clamp(
      input?.unauthorizedApiThreshold ?? base.unauthorizedApiThreshold,
      3,
      200,
      base.unauthorizedApiThreshold,
    ),
    bulkDownloadThreshold: clamp(
      input?.bulkDownloadThreshold ?? base.bulkDownloadThreshold,
      3,
      500,
      base.bulkDownloadThreshold,
    ),
    bulkMutationThreshold: clamp(
      input?.bulkMutationThreshold ?? base.bulkMutationThreshold,
      5,
      500,
      base.bulkMutationThreshold,
    ),
    notifyInApp: input?.notifyInApp ?? base.notifyInApp,
    notifyEmail: input?.notifyEmail ?? base.notifyEmail,
    fileIntegrityEnabled:
      input?.fileIntegrityEnabled ?? base.fileIntegrityEnabled,
  };
}
