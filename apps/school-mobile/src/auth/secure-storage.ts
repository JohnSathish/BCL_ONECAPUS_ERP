import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

/**
 * iOS-only keychain flag. Passing this object as the 2nd argument on Android
 * (especially New Architecture) makes Kotlin reject getValueWithKeyAsync.
 *
 * Android SecureStore also rejects values larger than 2048 bytes (JWTs with
 * permission lists). Those are chunked. Tokens are always mirrored to the app
 * private documents folder so a Keystore hiccup cannot log the user out.
 */
const IOS_OPTIONS: SecureStore.SecureStoreOptions | undefined =
  Platform.OS === 'ios' ? { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK } : undefined;

const ANDROID_CHUNK = 1600;
const memory = new Map<string, string>();

function fileUri(key: string) {
  const dir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
  return `${dir}sls-kv-${encodeURIComponent(key)}.txt`;
}

async function nativeGet(key: string): Promise<string | null> {
  try {
    return IOS_OPTIONS
      ? await SecureStore.getItemAsync(key, IOS_OPTIONS)
      : await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function nativeSet(key: string, value: string): Promise<void> {
  if (IOS_OPTIONS) await SecureStore.setItemAsync(key, value, IOS_OPTIONS);
  else await SecureStore.setItemAsync(key, value);
}

async function nativeDel(key: string): Promise<void> {
  try {
    if (IOS_OPTIONS) await SecureStore.deleteItemAsync(key, IOS_OPTIONS);
    else await SecureStore.deleteItemAsync(key);
  } catch {
    /* ignore */
  }
}

async function fileGet(key: string): Promise<string | null> {
  try {
    const info = await FileSystem.getInfoAsync(fileUri(key));
    if (!info.exists) return null;
    return await FileSystem.readAsStringAsync(fileUri(key));
  } catch {
    return null;
  }
}

async function fileSet(key: string, value: string): Promise<void> {
  await FileSystem.writeAsStringAsync(fileUri(key), value);
}

async function fileDel(key: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(fileUri(key), { idempotent: true });
  } catch {
    /* ignore */
  }
}

async function persistNativeChunks(key: string, value: string) {
  const n = Math.max(1, Math.ceil(value.length / ANDROID_CHUNK) || 1);
  await nativeSet(`${key}__n`, String(n));
  for (let i = 0; i < n; i++) {
    await nativeSet(
      i === 0 ? key : `${key}__${i}`,
      value.slice(i * ANDROID_CHUNK, (i + 1) * ANDROID_CHUNK),
    );
  }
  let extra = n;
  while (extra < 12) {
    const leftover = await nativeGet(`${key}__${extra}`);
    if (!leftover) break;
    await nativeDel(`${key}__${extra}`);
    extra += 1;
  }
}

async function persistValue(key: string, value: string) {
  let nativeOk = false;
  try {
    await persistNativeChunks(key, value);
    nativeOk = true;
  } catch {
    nativeOk = false;
  }
  try {
    await fileSet(key, value);
  } catch (err) {
    if (!nativeOk) throw err;
  }
}

async function readPersisted(key: string): Promise<string | null> {
  // Android Keystore can briefly fail after reboot / process death. Prefer the
  // app-private file mirror so a Keystore hiccup cannot wipe the session.
  const fileValue = await fileGet(key);
  const countRaw = await nativeGet(`${key}__n`);
  const first = await nativeGet(key);
  const n = Number(countRaw);
  let nativeValue: string | null = null;
  if (Number.isFinite(n) && n > 1) {
    let out = first ?? '';
    for (let i = 1; i < n; i++) {
      out += (await nativeGet(`${key}__${i}`)) ?? '';
    }
    if (out) nativeValue = out;
  } else if (first) {
    nativeValue = first;
  }
  if (Platform.OS === 'android') {
    if (fileValue) {
      if (!nativeValue || nativeValue !== fileValue) {
        void persistNativeChunks(key, fileValue).catch(() => undefined);
      }
      return fileValue;
    }
    return nativeValue;
  }
  if (nativeValue && fileValue && fileValue.length > nativeValue.length) return fileValue;
  return nativeValue || fileValue;
}

export async function secureGet(key: string): Promise<string | null> {
  if (memory.has(key)) return memory.get(key) ?? null;
  const value = await readPersisted(key);
  if (value) memory.set(key, value);
  return value;
}

export async function secureSet(key: string, value: string): Promise<void> {
  memory.set(key, value);
  try {
    await persistValue(key, value);
  } catch {
    try {
      await fileSet(key, value);
    } catch {
      /* in-memory session still valid for this app run */
    }
  }
}

export async function secureDel(key: string): Promise<void> {
  memory.delete(key);
  const countRaw = await nativeGet(`${key}__n`);
  const n = Number(countRaw);
  await nativeDel(key);
  await nativeDel(`${key}__n`);
  if (Number.isFinite(n) && n > 1) {
    for (let i = 1; i < n; i++) await nativeDel(`${key}__${i}`);
  }
  await fileDel(key);
}
