import * as SecureStore from 'expo-secure-store';

const REFRESH_KEY = 'oc_refresh_token';
const ACCESS_KEY = 'oc_access_token';
const APP_TYPE_KEY = 'oc_app_type';
const USER_SNAPSHOT_KEY = 'oc_user_snapshot';
const LAST_LOGIN_KEY = 'oc_last_login_at';
const REMEMBER_ME_KEY = 'oc_remember_me';

export type StoredUserSnapshot = {
  permissions?: string[];
  roles?: string[];
  shiftIds?: string[];
  allShifts?: boolean;
  mustResetPassword?: boolean;
};

export type StoredAppType = 'student' | 'staff';

export async function saveSession(accessToken: string, refreshToken: string) {
  await SecureStore.setItemAsync(ACCESS_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
}

export async function saveUserSnapshot(user: StoredUserSnapshot) {
  await SecureStore.setItemAsync(USER_SNAPSHOT_KEY, JSON.stringify(user));
}

export async function getUserSnapshot(): Promise<StoredUserSnapshot | null> {
  const raw = await SecureStore.getItemAsync(USER_SNAPSHOT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUserSnapshot;
  } catch {
    return null;
  }
}

export async function saveAppType(type: StoredAppType) {
  await SecureStore.setItemAsync(APP_TYPE_KEY, type);
}

export async function getStoredAppType(): Promise<StoredAppType | null> {
  const value = await SecureStore.getItemAsync(APP_TYPE_KEY);
  return value === 'student' || value === 'staff' ? value : null;
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS_KEY);
}

export async function getRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export async function saveRememberMe(value: boolean) {
  await SecureStore.setItemAsync(REMEMBER_ME_KEY, value ? '1' : '0');
}

export async function getRememberMe(): Promise<boolean | null> {
  const raw = await SecureStore.getItemAsync(REMEMBER_ME_KEY);
  if (raw === '1') return true;
  if (raw === '0') return false;
  return null;
}

export async function saveLastLoginAt(iso: string) {
  await SecureStore.setItemAsync(LAST_LOGIN_KEY, iso);
}

export async function getLastLoginAt() {
  return SecureStore.getItemAsync(LAST_LOGIN_KEY);
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
  await SecureStore.deleteItemAsync(APP_TYPE_KEY);
  await SecureStore.deleteItemAsync(USER_SNAPSHOT_KEY);
  await SecureStore.deleteItemAsync(LAST_LOGIN_KEY);
  await SecureStore.deleteItemAsync(REMEMBER_ME_KEY);
}
