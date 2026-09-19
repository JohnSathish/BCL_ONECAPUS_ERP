import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * iOS-only keychain flag. Passing this object as the 2nd argument on Android
 * (especially New Architecture) makes Kotlin reject getValueWithKeyAsync:
 * ReadableNativeMap cannot be cast to SecureStoreOptions, then NPE.
 */
const IOS_OPTIONS: SecureStore.SecureStoreOptions | undefined =
  Platform.OS === 'ios' ? { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK } : undefined;

export async function secureGet(key: string): Promise<string | null> {
  try {
    return IOS_OPTIONS
      ? await SecureStore.getItemAsync(key, IOS_OPTIONS)
      : await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function secureSet(key: string, value: string): Promise<void> {
  try {
    if (IOS_OPTIONS) await SecureStore.setItemAsync(key, value, IOS_OPTIONS);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    /* encrypted storage unavailable — treat as not persisted */
  }
}

export async function secureDel(key: string): Promise<void> {
  try {
    if (IOS_OPTIONS) await SecureStore.deleteItemAsync(key, IOS_OPTIONS);
    else await SecureStore.deleteItemAsync(key);
  } catch {
    /* ignore */
  }
}
