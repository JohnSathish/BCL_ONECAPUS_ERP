import { apiFetch } from '@/api/client';

export type AuthLoginMethods = {
  allowBiometricLogin: boolean;
  allowQrLogin: boolean;
  allowRfidLogin: boolean;
};

export type AuthLoginContext = {
  tenantSlug?: string;
  loginMethods: AuthLoginMethods;
  institution?: {
    displayName?: string;
    shortName?: string;
    campusName?: string;
    portalSubtitle?: string;
    logoUrl?: string;
  };
};

const DEFAULT_METHODS: AuthLoginMethods = {
  allowBiometricLogin: true,
  allowQrLogin: false,
  allowRfidLogin: false,
};

const CACHE_TTL_MS = 60_000;

let cache: { at: number; data: AuthLoginContext } | null = null;

function normalizeMethods(raw: unknown): AuthLoginMethods {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_METHODS };
  const m = raw as Record<string, unknown>;
  return {
    allowBiometricLogin:
      typeof m.allowBiometricLogin === 'boolean'
        ? m.allowBiometricLogin
        : DEFAULT_METHODS.allowBiometricLogin,
    allowQrLogin:
      typeof m.allowQrLogin === 'boolean' ? m.allowQrLogin : DEFAULT_METHODS.allowQrLogin,
    allowRfidLogin:
      typeof m.allowRfidLogin === 'boolean' ? m.allowRfidLogin : DEFAULT_METHODS.allowRfidLogin,
  };
}

export async function fetchAuthLoginContext(options?: {
  force?: boolean;
}): Promise<AuthLoginContext> {
  if (!options?.force && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.data;
  }

  try {
    const data = await apiFetch<AuthLoginContext & { loginMethods?: unknown }>('/v1/auth/context', {
      skipAuth: true,
    });
    const normalized: AuthLoginContext = {
      ...data,
      loginMethods: normalizeMethods(data?.loginMethods),
    };
    cache = { at: Date.now(), data: normalized };
    return normalized;
  } catch {
    const fallback: AuthLoginContext = { loginMethods: { ...DEFAULT_METHODS } };
    cache = { at: Date.now(), data: fallback };
    return fallback;
  }
}

export function clearAuthLoginContextCache() {
  cache = null;
}
