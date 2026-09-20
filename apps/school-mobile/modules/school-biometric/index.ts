import { requireNativeModule } from 'expo-modules-core';

export type SchoolBiometricResult = {
  success: boolean;
  error?: string;
  warning?: string;
};

type SchoolBiometricNative = {
  authenticate(promptMessage: string): Promise<SchoolBiometricResult>;
};

export default requireNativeModule<SchoolBiometricNative>('SchoolBiometric');
