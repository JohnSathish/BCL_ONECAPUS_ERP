'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

function allowsFunctional() {
  const raw = document.cookie.split('; ').find((c) => c.startsWith('bcl_cc='));
  if (!raw) return false;
  try {
    const v = JSON.parse(decodeURIComponent(raw.split('=').slice(1).join('=')));
    return Boolean(v.functional);
  } catch {
    return false;
  }
}

export function VisitorBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    function ping() {
      if (!pathname || pathname.startsWith('/admin') || pathname.startsWith('/portal')) return;
      if (!allowsFunctional()) return;
      void fetch('/api/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: pathname }),
      });
    }
    ping();
    window.addEventListener('bcl-consent', ping);
    return () => window.removeEventListener('bcl-consent', ping);
  }, [pathname]);
  return null;
}
