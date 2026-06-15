import { useEffect, useState } from 'react';
import { apiFetch, getAppType } from '@/api/client';

export type BootstrapConfig = {
  appName: string;
  minVersion: string;
  latestVersion: string;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  forceUpdate: boolean;
  forceUpdateMessage: string | null;
  branding: {
    logoUrl: string | null;
    splashImageUrl: string | null;
    primaryColor: string | null;
    displayName: string | null;
  };
};

export function useBootstrap() {
  const [config, setConfig] = useState<BootstrapConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<BootstrapConfig>(
          `/v1/mobile-app/bootstrap?appType=${getAppType()}`,
          { skipAuth: true },
        );
        if (!cancelled) setConfig(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Bootstrap failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { config, error, loading };
}
