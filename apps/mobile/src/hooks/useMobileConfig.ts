import { useEffect, useState } from 'react';
import { apiFetch } from '@/api/client';

export function useMobileConfig() {
  const [cards, setCards] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<{ dashboardCards: Record<string, boolean> }>(
          '/v1/mobile-app/config',
        );
        if (!cancelled) setCards(data.dashboardCards ?? {});
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { cards, loading };
}
