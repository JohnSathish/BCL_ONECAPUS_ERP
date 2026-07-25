'use client';

import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';

const SESSION_KEY = 'dbc-college-visitor-counted';

/**
 * Footer visitor counter.
 * Server counts at most once per visitor key (IP + UA) per Kolkata calendar day.
 * sessionStorage avoids repeat POSTs within the same browser tab session.
 */
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
        const payload = (await response.json()) as { count?: number; counted?: boolean };
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
