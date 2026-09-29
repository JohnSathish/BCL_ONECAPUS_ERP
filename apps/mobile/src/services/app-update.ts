import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Linking, Platform } from 'react-native';
import { apiFetch } from '@/api/client';
import { getInstalledAppVersion, isVersionBelow } from '@/utils/app-version';
import {
  checkPlayUpdate,
  isPlayInAppUpdatesAvailable,
  startPlayUpdate,
} from '../../modules/play-in-app-updates';

export type PlatformUpdatePolicy = {
  active: boolean;
  latestVersion: string | null;
  minimumVersion: string | null;
  forceUpdate: boolean;
  storeUrl: string;
  releaseTitle: string | null;
  releaseNotes: string[];
  releaseDate: string | null;
  updatedAt: string | null;
};

export type AppVersionPayload = {
  android: PlatformUpdatePolicy;
  ios: PlatformUpdatePolicy;
  releaseTitle: string | null;
  releaseNotes: string[];
  releaseDate: string | null;
};

export type UpdateDecision =
  | { kind: 'none' }
  | {
      kind: 'optional' | 'required';
      currentVersion: string;
      latestVersion: string;
      minimumVersion: string | null;
      storeUrl: string | null;
      releaseTitle: string | null;
      releaseNotes: string[];
      releaseDate: string | null;
      message?: string | null;
    };

const CACHE_KEY = 'onecampus.appUpdate.policy.v1';
const SNOOZE_KEY = 'onecampus.appUpdate.snooze.v1';

/** Minimum gap between network checks when the app returns from background. */
export const UPDATE_RECHECK_INTERVAL_MS = 15 * 60_000;
/** After "Later", the optional dialog stays quiet for this long (per version). */
const OPTIONAL_SNOOZE_MS = 24 * 60 * 60_000;

const IOS_APP_STORE_ID = '6798552213';

function androidPackage() {
  return Constants.expoConfig?.android?.package ?? 'edu.onecampus.mobile';
}

function currentPlatformKey(): 'android' | 'ios' {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

async function readCachedPayload(): Promise<AppVersionPayload | null> {
  try {
    const raw = await SecureStore.getItemAsync(CACHE_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as { payload?: AppVersionPayload }).payload ?? null;
  } catch {
    return null;
  }
}

/** Latest policy from the server; falls back to the last good response when offline. */
export async function loadAppVersionPolicy(): Promise<AppVersionPayload | null> {
  try {
    const payload = await apiFetch<AppVersionPayload>(
      `/v1/app/version?platform=${currentPlatformKey()}`,
      { skipAuth: true, timeoutMs: 10_000 },
    );
    if (payload?.android && payload?.ios) {
      try {
        await SecureStore.setItemAsync(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), payload }));
      } catch {
        /* cache is best-effort */
      }
      return payload;
    }
  } catch {
    /* fall through to cache */
  }
  return readCachedPayload();
}

export function evaluateUpdate(
  payload: AppVersionPayload | null,
  installed = getInstalledAppVersion(),
): UpdateDecision {
  const policy = payload?.[currentPlatformKey()];
  if (!policy?.active || !policy.latestVersion) return { kind: 'none' };

  const belowMinimum = Boolean(
    policy.minimumVersion && isVersionBelow(installed, policy.minimumVersion),
  );
  const belowLatest = isVersionBelow(installed, policy.latestVersion);
  if (!belowMinimum && !belowLatest) return { kind: 'none' };

  return {
    kind: belowMinimum || (policy.forceUpdate && belowLatest) ? 'required' : 'optional',
    currentVersion: installed,
    latestVersion: policy.latestVersion,
    minimumVersion: policy.minimumVersion,
    storeUrl: policy.storeUrl,
    releaseTitle: policy.releaseTitle,
    releaseNotes: policy.releaseNotes ?? [],
    releaseDate: policy.releaseDate,
  };
}

export async function shouldPromptOptional(version: string): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(SNOOZE_KEY);
    if (!raw) return true;
    const snooze = JSON.parse(raw) as { version?: string; at?: number };
    return !(snooze.version === version && Date.now() - (snooze.at ?? 0) < OPTIONAL_SNOOZE_MS);
  } catch {
    return true;
  }
}

export async function snoozeOptional(version: string) {
  try {
    await SecureStore.setItemAsync(SNOOZE_KEY, JSON.stringify({ version, at: Date.now() }));
  } catch {
    /* ignore */
  }
}

export async function openStoreListing(storeUrl?: string | null): Promise<boolean> {
  const candidates =
    Platform.OS === 'ios'
      ? [
          storeUrl,
          `itms-apps://apps.apple.com/app/id${IOS_APP_STORE_ID}`,
          `https://apps.apple.com/app/id${IOS_APP_STORE_ID}`,
        ]
      : [
          storeUrl,
          `market://details?id=${androidPackage()}`,
          `https://play.google.com/store/apps/details?id=${androidPackage()}`,
        ];
  for (const url of candidates) {
    if (!url?.trim()) continue;
    try {
      await Linking.openURL(url.trim());
      return true;
    } catch {
      /* try next */
    }
  }
  return false;
}

/**
 * Android: Google Play in-app update (immediate for mandatory, flexible for optional).
 * Falls back to the store listing when Play has nothing to offer this install
 * (sideloaded build, staged rollout not reached yet, or no native module).
 */
export async function startAppUpdate(options: {
  required: boolean;
  storeUrl?: string | null;
}): Promise<'in-app' | 'store' | 'failed'> {
  if (Platform.OS === 'android' && isPlayInAppUpdatesAvailable()) {
    const info = await checkPlayUpdate();
    if (info?.updateAvailable || info?.updateInProgress) {
      if (options.required) {
        if ((info.immediateAllowed || info.updateInProgress) && (await startPlayUpdate(true))) {
          return 'in-app';
        }
      } else {
        if (info.flexibleAllowed && (await startPlayUpdate(false))) return 'in-app';
        if (info.immediateAllowed && (await startPlayUpdate(true))) return 'in-app';
      }
    }
  }
  return (await openStoreListing(options.storeUrl)) ? 'store' : 'failed';
}
