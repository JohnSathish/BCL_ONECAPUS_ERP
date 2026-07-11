import { useCallback, useEffect, useState } from 'react';
import {
  fetchBootstrapConfig,
  readCachedBootstrap,
  type BootstrapConfig,
} from '@/services/mobile-remote-config';

export type { BootstrapConfig };

export function useBootstrap() {
  const [config, setConfig] = useState<BootstrapConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setLoading(true);
    setError(null);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await readCachedBootstrap();
      if (!cancelled && cached) setConfig(cached);
      try {
        const data = await fetchBootstrapConfig();
        if (!cancelled) {
          setConfig(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Bootstrap failed');
          if (!cached) setConfig(null);
        }
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
