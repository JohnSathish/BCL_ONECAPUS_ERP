import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const ENROLLED_KEY = 'oc_biometric_enrolled';
const FAIL_KEY = 'oc_biometric_fail_count';
const MAX_FAILURES = 3;

export type BiometricCapability = {
  available: boolean;
  hasHardware: boolean;
  isEnrolled: boolean;
  types: LocalAuthentication.AuthenticationType[];
};

export type BiometricAuthResult =
  | { ok: true }
  | { ok: false; reason: 'cancelled' | 'failed' | 'fall_back' | 'unavailable' };

export async function isBiometricEnrolled(): Promise<boolean> {
  const raw = await SecureStore.getItemAsync(ENROLLED_KEY);
  return raw === '1';
}

export async function setBiometricEnrolled(value: boolean): Promise<void> {
  await SecureStore.setItemAsync(ENROLLED_KEY, value ? '1' : '0');
  if (value) {
    await SecureStore.deleteItemAsync(FAIL_KEY).catch(() => undefined);
  }
}

export async function clearBiometricEnrollment(): Promise<void> {
  await SecureStore.deleteItemAsync(ENROLLED_KEY);
  await SecureStore.deleteItemAsync(FAIL_KEY).catch(() => undefined);
}

async function getFailCount(): Promise<number> {
  const raw = await SecureStore.getItemAsync(FAIL_KEY);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function setFailCount(count: number): Promise<void> {
  if (count <= 0) {
    await SecureStore.deleteItemAsync(FAIL_KEY).catch(() => undefined);
    return;
  }
  await SecureStore.setItemAsync(FAIL_KEY, String(count));
}

export async function resetBiometricFailCount(): Promise<void> {
  await setFailCount(0);
}

export async function canUseBiometrics(): Promise<BiometricCapability> {
  try {
    const [hasHardware, isEnrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    return {
      available: hasHardware && isEnrolled,
      hasHardware,
      isEnrolled,
      types,
    };
  } catch {
    return {
      available: false,
      hasHardware: false,
      isEnrolled: false,
      types: [],
    };
  }
}

/**
 * Device unlock of an existing refresh session (Microsoft-style).
 * After MAX_FAILURES consecutive failures, returns fall_back so UI shows password.
 */
export async function authenticateWithBiometrics(
  promptMessage = 'Unlock with biometrics',
): Promise<BiometricAuthResult> {
  const fails = await getFailCount();
  if (fails >= MAX_FAILURES) {
    return { ok: false, reason: 'fall_back' };
  }

  const capability = await canUseBiometrics();
  if (!capability.available) {
    return { ok: false, reason: 'unavailable' };
  }

  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Use password',
      disableDeviceFallback: true,
      fallbackLabel: 'Use password',
    });

    if (result.success) {
      await setFailCount(0);
      return { ok: true };
    }

    if (result.error === 'user_cancel' || result.error === 'system_cancel') {
      return { ok: false, reason: 'cancelled' };
    }

    const next = fails + 1;
    await setFailCount(next);
    if (next >= MAX_FAILURES) {
      return { ok: false, reason: 'fall_back' };
    }
    return { ok: false, reason: 'failed' };
  } catch {
    const next = fails + 1;
    await setFailCount(next);
    if (next >= MAX_FAILURES) {
      return { ok: false, reason: 'fall_back' };
    }
    return { ok: false, reason: 'failed' };
  }
}
