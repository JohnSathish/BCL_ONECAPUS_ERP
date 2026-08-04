'use client';

import Link from 'next/link';
import { Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PRINCIPAL_FAB_ACTIONS } from '@/config/principal-desk-nav';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/utils/cn';

export function PrincipalFab() {
  const { session } = useAuth();
  const permissions = session?.user?.permissions ?? [];
  const [open, setOpen] = useState(false);

  const actions = useMemo(
    () =>
      PRINCIPAL_FAB_ACTIONS.filter(
        (a) => !('permission' in a && a.permission) || permissions.includes(a.permission as string),
      ),
    [permissions],
  );

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
      {open ? (
        <div className="mb-1 flex flex-col items-end gap-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.id}
                href={action.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-2 pl-3 pr-4 text-sm font-medium text-slate-800 shadow-lg hover:bg-slate-50 dark:border-border dark:bg-card dark:text-foreground"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">
                  <Icon className="h-4 w-4" />
                </span>
                {action.label}
              </Link>
            );
          })}
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 transition hover:bg-indigo-700',
        )}
        aria-label={open ? 'Close quick actions' : 'Open quick actions'}
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </button>
    </div>
  );
}
