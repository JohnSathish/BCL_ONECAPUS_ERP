import * as SecureStore from 'expo-secure-store';

const DEVICE_KEY = 'oc_device_id';

function randomId() {
  return `mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function getDeviceId() {
  const existing = await SecureStore.getItemAsync(DEVICE_KEY);
  if (existing) return existing;
  const id = randomId();
  await SecureStore.setItemAsync(DEVICE_KEY, id);
  return id;
}
