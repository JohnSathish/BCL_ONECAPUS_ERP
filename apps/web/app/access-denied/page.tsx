'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { resolveHomePath } from '@/lib/permissions/portal-access';
import { useAuth } from '@/hooks/use-auth';

export default function AccessDeniedPage() {
  const searchParams = useSearchParams();
  const { session } = useAuth();
  const from = searchParams.get('from');
  const redirect = searchParams.get('redirect');
  const home =
    redirect || resolveHomePath(session?.user.roles ?? [], session?.user.permissions ?? []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-foreground">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You do not have permission to view this page. Administrative modules are restricted to
          authorized staff only.
        </p>
        {from ? (
          <p className="mt-3 break-all text-xs text-muted-foreground">
            Requested path: <span className="font-mono">{from}</span>
          </p>
        ) : null}
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild>
            <Link href={home}>Go to my portal</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
