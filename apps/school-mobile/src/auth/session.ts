import * as SecureStore from 'expo-secure-store';

const ACCESS = 'sls_access_token';
const REFRESH = 'sls_refresh_token';
const USER = 'sls_user_snapshot';
const CHILD = 'sls_active_child';

export type StoredUser = {
  permissions?: string[];
  roles?: string[];
  displayName?: string;
  mustResetPassword?: boolean;
};

export async function saveSession(accessToken: string, refreshToken: string) {
  await SecureStore.setItemAsync(ACCESS, accessToken);
  await SecureStore.setItemAsync(REFRESH, refreshToken);
}

export async function saveUser(user: StoredUser) {
  await SecureStore.setItemAsync(USER, JSON.stringify(user));
}

export async function getUser(): Promise<StoredUser | null> {
  const raw = await SecureStore.getItemAsync(USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS);
}

export async function getRefreshToken() {
  return SecureStore.getItemAsync(REFRESH);
}

export async function saveActiveChild(id: string | null) {
  if (!id) {
    await SecureStore.deleteItemAsync(CHILD);
    return;
  }
  await SecureStore.setItemAsync(CHILD, id);
}

export async function getActiveChild() {
  return SecureStore.getItemAsync(CHILD);
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(ACCESS);
  await SecureStore.deleteItemAsync(REFRESH);
  await SecureStore.deleteItemAsync(USER);
  await SecureStore.deleteItemAsync(CHILD);
}
