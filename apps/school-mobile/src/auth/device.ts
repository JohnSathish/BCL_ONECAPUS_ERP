import * as Device from 'expo-device';
import { secureGet, secureSet } from '@/auth/secure-storage';

const KEY = 'sls_device_id';

export async function getDeviceId() {
  const existing = await secureGet(KEY);
  if (existing) return existing;
  const id = `${Device.osName ?? 'device'}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await secureSet(KEY, id);
  return id;
}
