import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/api/client';
import { getStoredAppType } from '@/auth/session';

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
  portalHighlights?: {
    stats: {
      students: number;
      faculty: number;
      departments: number;
      academicYear: string | null;
    };
    updates: string[];
  };
};

export function useBootstrap() {
  const [config, setConfig] = useState<BootstrapConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setLoading(true);
    setError(null);
    setConfig(null);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const storedType = await getStoredAppType();
        const appType = storedType === 'staff' ? 'staff' : 'student';
        const data = await apiFetch<BootstrapConfig>(
          `/v1/mobile-app/bootstrap?appType=${appType}`,
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
  }, [attempt]);

  return { config, error, loading, retry };
}
