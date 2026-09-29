import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

export type PlayInstallStatus =
  | 'PENDING'
  | 'DOWNLOADING'
  | 'DOWNLOADED'
  | 'INSTALLING'
  | 'INSTALLED'
  | 'FAILED'
  | 'CANCELED'
  | 'UNKNOWN';

export type PlayUpdateInfo = {
  updateAvailable: boolean;
  updateInProgress: boolean;
  immediateAllowed: boolean;
  flexibleAllowed: boolean;
  availableVersionCode: number;
  installStatus: PlayInstallStatus;
};

type Subscription = { remove: () => void };

type NativePlayInAppUpdates = {
  checkForUpdate(): Promise<PlayUpdateInfo>;
  startUpdate(immediate: boolean): Promise<boolean>;
  completeUpdate(): Promise<boolean>;
  addListener(
    event: 'onInstallStatus',
    listener: (e: {
      status: PlayInstallStatus;
      bytesDownloaded: number;
      totalBytesToDownload: number;
    }) => void,
  ): Subscription;
  addListener(
    event: 'onUpdateFlowResult',
    listener: (e: { result: 'OK' | 'CANCELED' | 'FAILED' }) => void,
  ): Subscription;
};

/** Null on iOS, Expo Go, or builds made before this module was added. */
const native: NativePlayInAppUpdates | null =
  Platform.OS === 'android'
    ? requireOptionalNativeModule<NativePlayInAppUpdates>('PlayInAppUpdates')
    : null;

export function isPlayInAppUpdatesAvailable() {
  return native != null;
}

export async function checkPlayUpdate(): Promise<PlayUpdateInfo | null> {
  if (!native) return null;
  try {
    return await native.checkForUpdate();
  } catch {
    return null;
  }
}

/** Starts the Play update flow. Resolves false when Play has no update to offer for this install. */
export async function startPlayUpdate(immediate: boolean): Promise<boolean> {
  if (!native) return false;
  try {
    return await native.startUpdate(immediate);
  } catch {
    return false;
  }
}

export async function completePlayUpdate(): Promise<boolean> {
  if (!native) return false;
  try {
    return await native.completeUpdate();
  } catch {
    return false;
  }
}

export function addPlayInstallStatusListener(
  listener: (status: PlayInstallStatus) => void,
): Subscription | null {
  return native?.addListener('onInstallStatus', (e) => listener(e.status)) ?? null;
}

export function addPlayUpdateFlowListener(
  listener: (result: 'OK' | 'CANCELED' | 'FAILED') => void,
): Subscription | null {
  return native?.addListener('onUpdateFlowResult', (e) => listener(e.result)) ?? null;
}
