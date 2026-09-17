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
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: prompt,
    cancelLabel: 'Cancel',
    fallbackLabel: 'Use password',
    disableDeviceFallback: true,
    requireConfirmation: false,
  });
  if (result.success) return { ok: true as const };
  return { ok: false as const, reason: 'failed' as const };
}

export async function enableBiometricLogin() {
  const cap = await biometricCapability();
  if (!cap.available) {
    throw new Error('Biometrics are not available on this device.');
  }
  const auth = await authenticateWithBiometrics(
    'Confirm to enable fingerprint or Face ID for this school account.',
  );
  if (!auth.ok) {
    throw new Error('Biometric confirmation was cancelled.');
  }
  await setBiometricLoginEnabled(true, cap.enrolledLevel);
}

export async function disableBiometricLogin() {
  await setBiometricLoginEnabled(false);
}
