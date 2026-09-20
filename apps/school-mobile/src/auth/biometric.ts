import { AppState, InteractionManager, Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { requireNativeModule } from 'expo-modules-core';
import {
  getStoredBiometricLevel,
  isBiometricLoginEnabled,
  setBiometricLoginEnabled,
  setBiometricPrompted,
  wasBiometricPrompted,
} from '@/auth/session';

export type BiometricCapability = {
  available: boolean;
  enrolled: boolean;
  hasHardware: boolean;
  label: string;
  enrolledLevel: number;
};

export type BioFailReason =
  | 'cancel'
  | 'unavailable'
  | 'not_enrolled'
  | 'lockout'
  | 'failed'
  | 'timeout';

export type BioResult = { ok: true } | { ok: false; reason: BioFailReason };

type NativeAuthResult = {
  success: boolean;
  error?: string;
  warning?: string;
};

let offerSkippedThisSession = false;
let authenticating = false;

export function isBiometricPromptBusy() {
  return authenticating;
}

export function skipBiometricOfferThisSession() {
  offerSkippedThisSession = true;
}

export async function shouldOfferBiometricSetup() {
  if (offerSkippedThisSession) return false;
  if (await isBiometricLoginEnabled()) return false;
  if (await wasBiometricPrompted()) return false;
  return true;
}

export async function biometricCapability(): Promise<BiometricCapability> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = hasHardware ? await LocalAuthentication.isEnrolledAsync() : false;
    const types = hasHardware ? await LocalAuthentication.supportedAuthenticationTypesAsync() : [];
    let level = 0;
    try {
      level = hasHardware ? await LocalAuthentication.getEnrolledLevelAsync() : 0;
    } catch {
      level = enrolled ? 1 : 0;
    }
    const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    const hasPrint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
    let label = 'Unlock with biometrics';
    if (Platform.OS === 'ios' && hasFace) label = 'Unlock with Face ID';
    else if (hasPrint) label = 'Unlock with fingerprint';
    else if (hasFace) label = 'Unlock with face recognition';
    return {
      available: hasHardware && enrolled,
      enrolled,
      hasHardware,
      label,
      enrolledLevel: level,
    };
  } catch {
    return {
      available: false,
      enrolled: false,
      hasHardware: false,
      label: 'Unlock with fingerprint',
      enrolledLevel: 0,
    };
  }
}

export async function biometricEnrollmentChanged() {
  if (!(await isBiometricLoginEnabled())) return false;
  const stored = await getStoredBiometricLevel();
  if (stored == null || stored === 0) return false;
  try {
    const current = await LocalAuthentication.getEnrolledLevelAsync();
    return current < stored;
  } catch {
    return false;
  }
}

function mapAuthError(error?: string): BioFailReason {
  const value = String(error || '').toLowerCase();
  if (
    value.includes('user_cancel') ||
    value.includes('system_cancel') ||
    value.includes('app_cancel') ||
    value.includes('negative') ||
    value.includes('user_fallback')
  ) {
    return 'cancel';
  }
  if (value.includes('lockout')) return 'lockout';
  if (value.includes('not_enrolled') || value.includes('not enrolled')) {
    return 'not_enrolled';
  }
  if (
    value.includes('not_available') ||
    value.includes('passcode_not_set') ||
    value.includes('hw_unavailable') ||
    value.includes('no_hardware') ||
    value.includes('missing_activity') ||
    value.includes('missing activity')
  ) {
    return 'unavailable';
  }
  if (value.includes('timeout')) return 'timeout';
  return 'failed';
}

export function biometricFailMessage(reason: BioFailReason) {
  switch (reason) {
    case 'cancel':
      return null;
    case 'lockout':
      return 'Too many attempts. Use your password for now.';
    case 'not_enrolled':
      return 'No fingerprint is enrolled on this phone. Add one in Android Settings, then try again.';
    case 'unavailable':
      return 'Fingerprint is not available on this phone.';
    case 'timeout':
      return 'Fingerprint timed out. You can enable it later in Settings.';
    default:
      return 'Could not read the fingerprint. Wait for the system prompt, then touch the sensor.';
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForAppActive() {
  if (AppState.currentState === 'active') return Promise.resolve();
  return new Promise<void>((resolve) => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        sub.remove();
        resolve();
      }
    });
    setTimeout(() => {
      sub.remove();
      resolve();
    }, 1500);
  });
}

function waitForInteractions() {
  return new Promise<void>((resolve) => {
    InteractionManager.runAfterInteractions(() => resolve());
  });
}

function androidNativeAuthenticate(message: string): Promise<NativeAuthResult> | null {
  try {
    const mod = requireNativeModule('SchoolBiometric') as {
      authenticate(promptMessage: string): Promise<NativeAuthResult>;
    };
    if (!mod?.authenticate) return null;
    return mod.authenticate(message);
  } catch {
    return null;
  }
}

async function promptOnce(message: string): Promise<NativeAuthResult> {
  if (Platform.OS === 'android') {
    const native = androidNativeAuthenticate(message);
    if (native) return native;
    return LocalAuthentication.authenticateAsync({
      promptMessage: message,
      cancelLabel: 'Cancel',
      disableDeviceFallback: true,
      requireConfirmation: false,
      biometricsSecurityLevel: 'weak',
    });
  }
  return LocalAuthentication.authenticateAsync({
    promptMessage: message,
    fallbackLabel: 'Use password',
    disableDeviceFallback: true,
  });
}

export async function authenticateWithBiometrics(prompt: string): Promise<BioResult> {
  if (authenticating) return { ok: false, reason: 'cancel' };
  authenticating = true;
  const message = String(prompt || 'Confirm it is you').slice(0, 80);
  try {
    await waitForAppActive();
    await waitForInteractions();
    await wait(200);
    const result = await promptOnce(message);
    if (result.success) return { ok: true };
    return {
      ok: false,
      reason: mapAuthError(result.error || 'failed'),
    };
  } catch (err) {
    const messageText = err instanceof Error ? err.message : '';
    return { ok: false, reason: mapAuthError(messageText) };
  } finally {
    authenticating = false;
  }
}

export async function enableBiometricLogin(): Promise<BioResult> {
  const cap = await biometricCapability();
  if (!cap.hasHardware) return { ok: false, reason: 'unavailable' };
  if (!cap.enrolled) return { ok: false, reason: 'not_enrolled' };
  const auth = await authenticateWithBiometrics('Enable fingerprint login');
  if (!auth.ok) return auth;
  await setBiometricLoginEnabled(true, cap.enrolledLevel || 1);
  await setBiometricPrompted(true);
  skipBiometricOfferThisSession();
  return { ok: true };
}

export async function declineBiometricOffer() {
  skipBiometricOfferThisSession();
  await setBiometricPrompted(true);
}

export async function disableBiometricLogin() {
  await setBiometricLoginEnabled(false);
}
