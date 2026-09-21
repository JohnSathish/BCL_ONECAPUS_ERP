import { getApiBase, schoolHeaders } from '@/api/config';
import { getAccessToken, getRefreshToken, saveSession } from '@/auth/session';

export class AccountDisabledError extends Error {
  constructor() {
    super('ACCOUNT_DISABLED');
    this.name = 'AccountDisabledError';
  }
}

export class SessionRevokedError extends Error {
  constructor() {
    super('SESSION_REVOKED');
    this.name = 'SessionRevokedError';
  }
}

export class DeviceBlockedError extends Error {
  constructor() {
    super('DEVICE_BLOCKED');
    this.name = 'DeviceBlockedError';
  }
}

export class SessionExpiredError extends Error {
  constructor(message = 'Session expired') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

type Refreshed = { accessToken: string; refreshToken: string };

let inFlight: Promise<Refreshed> | null = null;

function asRefreshed(json: unknown): Partial<Refreshed> & { message?: string; detail?: string } {
  const root = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
  const nested =
    root.data && typeof root.data === 'object' ? (root.data as Record<string, unknown>) : root;
  return {
    accessToken: typeof nested.accessToken === 'string' ? nested.accessToken : undefined,
    refreshToken: typeof nested.refreshToken === 'string' ? nested.refreshToken : undefined,
    message: typeof nested.message === 'string' ? nested.message : undefined,
    detail: typeof root.detail === 'string' ? root.detail : undefined,
  };
}

function combinedMessage(json: unknown, fallback = '') {
  const row = asRefreshed(json);
  const root = json && typeof json === 'object' ? (json as { message?: string }) : {};
  return `${row.detail || ''} ${row.message || ''} ${root.message || ''} ${fallback}`;
}

export function authFailureKind(message: string): 'blocked' | 'revoked' | 'disabled' | null {
  if (/\bDEVICE_BLOCKED\b/.test(message)) return 'blocked';
  if (/\bACCOUNT_DISABLED\b/.test(message)) return 'disabled';
  if (/\bSESSION_REVOKED\b/.test(message)) return 'revoked';
  return null;
}

async function currentTokensIfRotated(sentRefresh: string): Promise<Refreshed | null> {
  const current = await getRefreshToken();
  const access = await getAccessToken();
  if (current && current !== sentRefresh && access) {
    return { accessToken: access, refreshToken: current };
  }
  return null;
}

async function postRefresh(refreshToken: string, unlock?: boolean) {
  const headers = await schoolHeaders();
  const body = JSON.stringify({
    refreshToken,
    rememberMe: true,
    ...(unlock ? { unlockMethod: 'biometric_unlock' } : {}),
  });
  const urls = ['/v1/school-mobile/auth/refresh', '/v1/auth/refresh'];
  let last: { res: Response; json: unknown } | null = null;
  for (const path of urls) {
    const res = await fetch(`${getApiBase()}${path}`, { method: 'POST', headers, body });
    const json = await res.json().catch(() => ({}));
    last = { res, json };
    const data = asRefreshed(json);
    if (res.ok && data.accessToken) return { res, json, data };
    if (res.status !== 404) return { res, json, data };
  }
  return { res: last!.res, json: last!.json, data: asRefreshed(last!.json) };
}

async function doRefresh(opts?: { biometricUnlock?: boolean }): Promise<Refreshed> {
  const sent = await getRefreshToken();
  if (!sent) throw new SessionExpiredError('No refresh token');
  let res: Response;
  let json: unknown;
  let data: ReturnType<typeof asRefreshed>;
  try {
    const out = await postRefresh(sent, opts?.biometricUnlock);
    res = out.res;
    json = out.json;
    data = out.data;
  } catch {
    throw new Error("You're offline. Some information may be unavailable.");
  }

  if (res.ok && data.accessToken) {
    const nextRefresh = data.refreshToken || sent;
    await saveSession(data.accessToken, nextRefresh);
    return { accessToken: data.accessToken, refreshToken: nextRefresh };
  }

  const rotated = await currentTokensIfRotated(sent);
  if (rotated) return rotated;

  const message = combinedMessage(json);
  if (res.status === 401 || res.status === 403) {
    const kind = authFailureKind(message);
    if (kind === 'blocked') throw new DeviceBlockedError();
    if (kind === 'revoked') throw new SessionRevokedError();
    if (kind === 'disabled') throw new AccountDisabledError();
    throw new SessionExpiredError('Please sign in again.');
  }

  throw new Error("Couldn't renew your session. Please try again.");
}

export async function refreshAccessToken(opts?: { biometricUnlock?: boolean }) {
  if (inFlight) return inFlight;
  inFlight = doRefresh(opts).finally(() => {
    inFlight = null;
  });
  return inFlight;
}
