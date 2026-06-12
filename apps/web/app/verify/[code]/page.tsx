'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, XCircle } from 'lucide-react';

import { verifyIdCardPublic } from '@/services/id-cards';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';

export default function PublicVerifyPage() {
  const params = useParams<{ code: string }>();
  const code = decodeURIComponent(params.code ?? '');

  const verifyQ = useQuery({
    queryKey: ['verify', code],
    queryFn: () => verifyIdCardPublic(code),
    enabled: Boolean(code),
  });

  const result = verifyQ.data;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 dark:bg-slate-950">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-lg dark:bg-slate-900">
        <h1 className="text-center text-lg font-bold">Identity Verification</h1>
        <p className="mt-1 text-center text-xs text-muted-foreground font-mono">{code}</p>

        {verifyQ.isLoading ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">Verifying…</p>
        ) : result?.valid && result.display ? (
          <div className="mt-6 space-y-4 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
              {result.display.roleLabel}
            </p>
            {result.display.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolveUploadAssetUrl(result.display.photoUrl) ?? result.display.photoUrl}
                alt=""
                className="mx-auto h-24 w-24 rounded-xl border object-cover"
              />
            ) : (
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-xl bg-muted text-2xl font-bold">
                {result.display.name.charAt(0)}
              </div>
            )}
            <div>
              <p className="font-semibold">{result.display.name}</p>
              {result.display.department ? (
                <p className="text-sm text-muted-foreground">{result.display.department}</p>
              ) : null}
              {result.display.designation ? (
                <p className="text-xs text-muted-foreground">{result.display.designation}</p>
              ) : null}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Status: {result.status} · No sensitive data is shown on this page.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-3 text-center">
            <XCircle className="mx-auto h-12 w-12 text-destructive" />
            <p className="font-medium text-destructive">Not verified</p>
            <p className="text-sm text-muted-foreground">
              {result?.message ?? 'Invalid or inactive card'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
