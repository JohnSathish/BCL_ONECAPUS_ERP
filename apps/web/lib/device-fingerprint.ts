const DEVICE_ID_KEY = 'erp.deviceId';

export type WebDeviceFingerprint = {
  deviceId: string;
  screenResolution: string;
  language: string;
  timeZone: string;
  clientType: 'WEB';
  browserName?: string;
  browserVersion?: string;
  platform?: string;
};

function detectBrowser(): { browserName?: string; browserVersion?: string } {
  if (typeof navigator === 'undefined') return {};
  const ua = navigator.userAgent;
  const edge = /Edg\/([\d.]+)/i.exec(ua);
  if (edge) return { browserName: 'Edge', browserVersion: edge[1] };
  const chrome = /Chrome\/([\d.]+)/i.exec(ua);
  if (chrome && !/Edg\//i.test(ua)) {
    return { browserName: 'Chrome', browserVersion: chrome[1] };
  }
  const firefox = /Firefox\/([\d.]+)/i.exec(ua);
  if (firefox) return { browserName: 'Firefox', browserVersion: firefox[1] };
  const safari = /Version\/([\d.]+).*Safari/i.exec(ua);
  if (safari) return { browserName: 'Safari', browserVersion: safari[1] };
  return {};
}

function ensureDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing && existing.length >= 8) return existing;
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return `web-ephemeral-${Date.now()}`;
  }
}

/** Collect lightweight web client fingerprint for login / session registration. */
export function getWebDeviceFingerprint(): WebDeviceFingerprint {
  const browser = detectBrowser();
  return {
    deviceId: ensureDeviceId(),
    screenResolution:
      typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : '',
    language:
      typeof navigator !== 'undefined'
        ? navigator.language || (navigator.languages?.[0] ?? '')
        : '',
    timeZone:
      typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone || '' : '',
    clientType: 'WEB',
    ...browser,
    platform: typeof navigator !== 'undefined' ? navigator.platform || undefined : undefined,
  };
}
