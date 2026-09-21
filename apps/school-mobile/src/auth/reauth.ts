import { getRefreshToken, getUser, isBiometricLoginEnabled } from '@/auth/session';
import { biometricCapability } from '@/auth/biometric';

export type ReauthRoute = '/unlock' | '/login';

/**
 * Only used after the server genuinely ended the session (revoked / no refresh).
 * While a refresh token remains on device, return null — stay signed in.
 */
export async function destinationIfReauthNeeded(): Promise<ReauthRoute | null> {
  const refresh = await getRefreshToken();
  if (refresh) return null;

  const [bioEnabled, user] = await Promise.all([isBiometricLoginEnabled(), getUser()]);
  if (bioEnabled && user) {
    const cap = await biometricCapability();
    // No refresh left — unlock cannot renew; fall through to password login.
    if (cap.available) return '/login';
  }
  return '/login';
}
