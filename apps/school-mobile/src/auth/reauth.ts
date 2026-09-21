import { biometricCapability } from '@/auth/biometric';
import { getRefreshToken, getUser, isBiometricLoginEnabled } from '@/auth/session';

export type ReauthRoute = '/unlock' | '/login';

/**
 * Password login is only for a truly empty session.
 * Fingerprint (when enrolled) is the re-auth path. If the refresh token is
 * still on the device, stay signed in and let the next API call retry.
 */
export async function destinationIfReauthNeeded(): Promise<ReauthRoute | null> {
  const [refresh, bioEnabled, user] = await Promise.all([
    getRefreshToken(),
    isBiometricLoginEnabled(),
    getUser(),
  ]);
  if (bioEnabled) {
    const cap = await biometricCapability();
    if (cap.available && (refresh || user)) return '/unlock';
  }
  if (refresh) return null;
  return '/login';
}
