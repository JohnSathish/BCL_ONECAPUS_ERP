import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/api/client';
import { useSyncGuard } from '@/state/sync-guard';

export type MobileRuntimeConfig = {
  dashboardCards: Record<string, boolean>;
  featureFlags: Record<string, boolean>;
  configVersion: number;
  minVersion?: string;
  latestVersion?: string;
  forceUpdate?: boolean;
  playStoreUrl?: string | null;
  apkDownloadUrl?: string | null;
};

const defaultConfig: MobileRuntimeConfig = {
  dashboardCards: {},
  featureFlags: {},
  configVersion: 0,
};

export function useMobileConfig(options?: { enabled?: boolean }) {
  const enabled = options?.enabled !== false;
  const { requestSync, isEditing } = useSyncGuard();
  const [config, setConfig] = useState<MobileRuntimeConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await apiFetch<MobileRuntimeConfig & { menuVisibility?: Record<string, boolean> }>(
      '/v1/mobile-app/config',
    );
    setConfig({
      dashboardCards: data.dashboardCards ?? {},
      featureFlags: data.featureFlags ?? data.menuVisibility ?? {},
      configVersion: data.configVersion ?? 0,
      minVersion: data.minVersion,
      latestVersion: data.latestVersion,
      forceUpdate: data.forceUpdate,
      playStoreUrl: data.playStoreUrl,
      apkDownloadUrl: data.apkDownloadUrl,
    });
  }, []);

  const refresh = useCallback(() => {
    requestSync(async () => {
      setLoading(true);
      try {
        await load();
      } finally {
        setLoading(false);
      }
    });
  }, [load, requestSync]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        await load();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, load]);

  return {
    cards: config.dashboardCards,
    featureFlags: config.featureFlags,
    configVersion: config.configVersion,
    config,
    loading,
    refresh,
    isEditing,
  };
}
