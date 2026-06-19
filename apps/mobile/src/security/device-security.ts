import * as Device from 'expo-device';
import { Platform } from 'react-native';

export type DeviceSecurityStatus = {
  isRootedOrJailbroken: boolean;
  isEmulator: boolean;
  isDebugMode: boolean;
  warnings: string[];
};

export function checkDeviceSecurity(): DeviceSecurityStatus {
  const warnings: string[] = [];
  const isEmulator = !Device.isDevice;
  const isDebugMode = __DEV__;
  let isRootedOrJailbroken = false;

  if (isEmulator) {
    warnings.push('Running on an emulator or simulator.');
  }
  if (isDebugMode && !__DEV__) {
    warnings.push('Debug mode detected.');
  }

  if (Platform.OS === 'android') {
    const tags = (Device as { platformApiLevel?: number }).platformApiLevel;
    void tags;
  }

  return {
    isRootedOrJailbroken,
    isEmulator,
    isDebugMode,
    warnings,
  };
}

export function shouldBlockSensitiveActions(status: DeviceSecurityStatus): boolean {
  if (process.env.EXPO_PUBLIC_BLOCK_COMPROMISED_DEVICE === 'true') {
    return status.isEmulator || status.isRootedOrJailbroken;
  }
  return false;
}
