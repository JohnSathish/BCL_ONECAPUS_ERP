'use client';

import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, X } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { endImpersonation } from '@/services/administration';
import { Button } from '@/components/ui/button';

const IMPERSONATION_BACKUP_KEY = 'nep-erp-admin-session-backup';

export function storeAdminSessionBackup(session: unknown) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(IMPERSONATION_BACKUP_KEY, JSON.stringify(session));
}

export function popAdminSessionBackup() {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(IMPERSONATION_BACKUP_KEY);
  sessionStorage.removeItem(IMPERSONATION_BACKUP_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function ImpersonationBanner() {
  const session = useAuthStore((s) => s.session);
  const setSession = useAuthStore((s) => s.setSession);

  const exit = useMutation({
    mutationFn: async () => {
      await endImpersonation(session?.user.impersonationSessionId);
      const backup = popAdminSessionBackup();
      if (backup) setSession(backup);
    },
  });

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <span>
          Viewing portal as <strong>{session?.user.email}</strong>
        </span>
      </div>
      <Button size="sm" variant="outline" onClick={() => exit.mutate()} disabled={exit.isPending}>
        <X className="mr-1 h-3.5 w-3.5" />
        Exit impersonation
      </Button>
    </div>
  );
}
