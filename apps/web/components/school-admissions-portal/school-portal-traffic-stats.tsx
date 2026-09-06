'use client';

import { useEffect, useState } from 'react';
import { heartbeatSchoolPortalTraffic } from '@/services/school-admissions';

const SESSION_KEY = 'tps-portal-session-id';
const HEARTBEAT_MS = 25_000;

function sessionId(): string {
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const next = crypto.randomUUID();
    window.localStorage.setItem(SESSION_KEY, next);
    return next;
  } catch {
    return crypto.randomUUID();
  }
}

function formatCount(value: number | null): string {
  if (value == null) return '—';
  return value.toLocaleString('en-IN');
}

export function SchoolPortalTrafficStats() {
  const [totalVisitors, setTotalVisitors] = useState<number | null>(null);
  const [liveOnline, setLiveOnline] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const id = sessionId();

    const pulse = async () => {
      try {
        const stats = await heartbeatSchoolPortalTraffic(id);
        if (cancelled) return;
        setTotalVisitors(stats.totalVisitors);
        setLiveOnline(stats.liveOnline);
      } catch {
        // Footer stays usable if the counter is briefly unavailable.
      }
    };

    void pulse();
    const timer = window.setInterval(() => void pulse(), HEARTBEAT_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void pulse();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return (
    <p className="tps-public-traffic" aria-live="polite">
      <span>
        Site visitors <strong>{formatCount(totalVisitors)}</strong>
      </span>
      <span className="tps-public-traffic-sep" aria-hidden>
        ·
      </span>
      <span>
        Live online <strong>{formatCount(liveOnline)}</strong>
      </span>
    </p>
  );
}
