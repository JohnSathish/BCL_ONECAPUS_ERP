import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  getStoredBiometricLevel,
  isBiometricLoginEnabled,
  setBiometricLoginEnabled,
} from '@/auth/session';

export type BiometricCapability = {
  available: boolean;
  enrolled: boolean;
  label: string;
  enrolledLevel: number;
};

export async function biometricCapability(): Promise<BiometricCapability> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const enrolled = hasHardware ? await LocalAuthentication.isEnrolledAsync() : false;
  const types = hasHardware ? await LocalAuthentication.supportedAuthenticationTypesAsync() : [];
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  const hasPrint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
  let label = 'Unlock with biometrics';
  if (Platform.OS === 'ios' && hasFace) label = 'Unlock with Face ID';
  else if (hasPrint) label = 'Unlock with fingerprint';
  else if (hasFace) label = 'Unlock with face recognition';
  return {
    available: hasHardware && enrolled,
    enrolled,
    label,
    enrolledLevel: level,
  };
}

export async function biometricEnrollmentChanged() {
  if (!(await isBiometricLoginEnabled())) return false;
  const stored = await getStoredBiometricLevel();
  if (stored == null) return false;
  const current = await LocalAuthentication.getEnrolledLevelAsync();
  return current < stored;
}

export async function authenticateWithBiometrics(prompt: string) {
  const cap = await biometricCapability();
  if (!cap.available) {
    return { ok: false as const, reason: 'unavailable' as const };
  }
  const message = String(prompt || 'Unlock your school account');
  try {
    const result =
      Platform.OS === 'android'
        ? await LocalAuthentication.authenticateAsync({ promptMessage: message })
        : await LocalAuthentication.authenticateAsync({
            promptMessage: message,
            fallbackLabel: 'Use password',
            disableDeviceFallback: true,
          });
    if (result.success) return { ok: true as const };
    return { ok: false as const, reason: 'failed' as const };
  } catch {
    return { ok: false as const, reason: 'failed' as const };
  }
}

export async function enableBiometricLogin() {
  const cap = await biometricCapability();
  if (!cap.available) {
    throw new Error('Fingerprint is not set up on this phone.');
  }
  const auth = await authenticateWithBiometrics(
    'Confirm to enable fingerprint or Face ID for this school account.',
  );
  if (!auth.ok) {
    throw new Error('Could not verify fingerprint. You can skip and use your password.');
  }
  await setBiometricLoginEnabled(true, cap.enrolledLevel);
}

export async function disableBiometricLogin() {
  await setBiometricLoginEnabled(false);
}
