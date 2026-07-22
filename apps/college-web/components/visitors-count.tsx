'use client';

import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';

const SESSION_KEY = 'dbc-college-visitor-counted';

export function VisitorsCount() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      try {
        const alreadyCounted = sessionStorage.getItem(SESSION_KEY) === '1';
        const response = await fetch('/api/visitors', {
          method: alreadyCounted ? 'GET' : 'POST',
          cache: 'no-store',
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { count?: number };
        if (!alreadyCounted) sessionStorage.setItem(SESSION_KEY, '1');
        if (!cancelled && typeof payload.count === 'number') setCount(payload.count);
      } catch {
        // Keep footer usable even if the counter is unavailable.
      }
    };

    void sync();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <span className="visitors-count" aria-live="polite">
      <Eye aria-hidden />
      Visitors{count == null ? '…' : `: ${count.toLocaleString('en-IN')}`}
    </span>
  );
}
