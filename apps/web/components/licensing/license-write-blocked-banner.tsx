'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, X } from 'lucide-react';

const LICENSE_BLOCKED_EVENT = 'erp:license-write-blocked';

export function dispatchLicenseWriteBlocked(message: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(LICENSE_BLOCKED_EVENT, { detail: { message } }));
}

export function LicenseWriteBlockedBanner() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setMessage(detail?.message ?? 'License expired. Please renew your subscription.');
    };
    window.addEventListener(LICENSE_BLOCKED_EVENT, handler);
    return () => window.removeEventListener(LICENSE_BLOCKED_EVENT, handler);
  }, []);

  if (!message) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md rounded-xl border border-destructive/40 bg-destructive/10 p-4 shadow-lg">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1 space-y-2 text-sm">
          <p className="font-medium text-destructive">Write action blocked</p>
          <p className="text-muted-foreground">{message}</p>
          <Link
            href="/admin/administration/license"
            className="text-primary underline-offset-2 hover:underline"
          >
            Go to license page
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setMessage(null)}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
