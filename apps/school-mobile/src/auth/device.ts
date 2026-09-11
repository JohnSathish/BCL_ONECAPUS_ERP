import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';

const KEY = 'sls_device_id';

export async function getDeviceId() {
  const existing = await SecureStore.getItemAsync(KEY);
  if (existing) return existing;
  const id = `${Device.osName ?? 'device'}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await SecureStore.setItemAsync(KEY, id);
  return id;
}
