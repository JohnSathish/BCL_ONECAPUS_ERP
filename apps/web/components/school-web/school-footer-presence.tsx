'use client';

import { useEffect, useState } from 'react';

const COOKIE = 'sls_vid';
const STORAGE = 'sls_vid';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readCookie(name: string) {
  if (typeof document === 'undefined') return '';
  const match = document.cookie
    .split(';')
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

function writeCookie(id: string) {
  document.cookie = `${COOKIE}=${encodeURIComponent(id)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

function visitorId() {
  const fromCookie = readCookie(COOKIE);
  if (UUID_RE.test(fromCookie)) return fromCookie;
  try {
    const stored = localStorage.getItem(STORAGE) || '';
    if (UUID_RE.test(stored)) {
      writeCookie(stored);
      return stored;
    }
  } catch {
    /* private mode */
  }
  const id = crypto.randomUUID();
  try {
    localStorage.setItem(STORAGE, id);
  } catch {
    /* ignore */
  }
  writeCookie(id);
  return id;
}

function publicPath() {
  const path = window.location.pathname || '/';
  return path.startsWith('/school-site') ? path.slice('/school-site'.length) || '/' : path;
}

export function SchoolFooterPresence({ label }: { label: string }) {
  const [online, setOnline] = useState<number | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    let stopped = false;
    const sessionId = visitorId();
    const ping = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const res = await fetch('/api/v1/school-web/public/presence', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Login-Host': window.location.hostname,
            'X-Forwarded-Host': window.location.hostname,
          },
          body: JSON.stringify({ sessionId, path: publicPath() }),
        });
        const payload = (await res.json()) as { data?: { online?: number }; online?: number };
        const count = payload.data?.online ?? payload.online;
        if (!stopped && typeof count === 'number') setOnline(count);
      } catch {
        /* keep last known count; never show an error in the footer */
      }
    };
    void ping();
    timer = window.setInterval(ping, 40_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void ping();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      if (timer) window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return (
    <p className="sls-footer-online" aria-live="polite">
      <span aria-hidden>👁</span>
      <span>
        {label}: {online == null ? '—' : online}
      </span>
    </p>
  );
}
