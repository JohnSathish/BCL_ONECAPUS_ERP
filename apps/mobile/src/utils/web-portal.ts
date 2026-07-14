import { Linking, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { getApiBaseSync } from '@/auth/school-config';

/** Resolve college web portal origin from the active API base URL. */
export function resolveWebPortalOrigin(): string {
  const fromEnv = process.env.EXPO_PUBLIC_WEB_ORIGIN?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  try {
    const apiUrl = getApiBaseSync()?.trim();
    if (apiUrl) {
      const u = new URL(apiUrl);
      return u.origin;
    }
  } catch {
    /* ignore */
  }
  return 'https://erp.donboscocollege.ac.in';
}

export function webPortalPath(path: string): string {
  const origin = resolveWebPortalOrigin();
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${p}`;
}

/**
 * Open a web portal path.
 * - By default uses an ephemeral browser session so the device browser's ERP cookies
 *   are NOT reused (avoids silent SSO into the full student dashboard).
 * - Routes through /login?next=… so the user must authenticate in that session.
 */
export async function openWebPortal(
  path: string,
  options?: { requireLogin?: boolean; ephemeral?: boolean },
) {
  const requireLogin = options?.requireLogin !== false;
  const ephemeral = options?.ephemeral !== false;
  const target = path.startsWith('/') ? path : `/${path}`;
  const url = requireLogin
    ? webPortalPath(`/login?next=${encodeURIComponent(target)}`)
    : webPortalPath(target);

  try {
    if (ephemeral) {
      // preferEphemeralSession is an ASWebAuthenticationSession (iOS) hint and is
      // not part of WebBrowserOpenOptions' type, so widen the type to keep it.
      const browserOptions: WebBrowser.WebBrowserOpenOptions & {
        preferEphemeralSession?: boolean;
      } = {
        preferEphemeralSession: true,
        showTitle: true,
        enableBarCollapsing: true,
        ...(Platform.OS === 'ios'
          ? { dismissButtonStyle: 'close' as const }
          : { showInRecents: false }),
      };
      await WebBrowser.openBrowserAsync(url, browserOptions);
      return;
    }
  } catch {
    // Fall through to system browser
  }

  await Linking.openURL(url);
}
