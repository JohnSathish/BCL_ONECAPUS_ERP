'use client';

import { useCallback, useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Copy, QrCode, RefreshCw } from 'lucide-react';

import { ErpWorkspace } from '@/components/erp/erp-workspace-shell';
import { GlassCard } from '@/components/erp/glass-card';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-auth';
import { issueStudentLoginQr, type QrLoginIssueResponse } from '@/services/student-portal';

function formatRemaining(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const sec = Math.ceil(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function StudentLoginQrPage() {
  useRequireAuth();
  const [issued, setIssued] = useState<QrLoginIssueResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const issueMutation = useMutation({
    mutationFn: () => issueStudentLoginQr('web-student-portal'),
    onSuccess: (data) => {
      setIssued(data);
      setCopied(false);
    },
  });

  const refresh = useCallback(() => {
    issueMutation.mutate();
  }, [issueMutation]);

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!issued) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [issued]);

  const expired = issued ? new Date(issued.expiresAt).getTime() <= now : false;

  async function copyToken() {
    if (!issued?.token) return;
    try {
      await navigator.clipboard.writeText(issued.token);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <DashboardShell role="student" title="Show Login QR">
      <ErpWorkspace className="max-w-lg">
        <GlassCard className="p-6">
          <div className="flex items-start gap-3">
            <QrCode className="mt-0.5 h-6 w-6 text-primary" />
            <div>
              <h1 className="text-lg font-semibold">Login QR code</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Scan this code with the campus mobile app to sign in on another device. The code
                expires in about five minutes and can be used once.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col items-center gap-4">
            {issued?.qrDataUrl && !expired ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={issued.qrDataUrl}
                alt="Login QR code"
                className="h-64 w-64 rounded-xl border border-border/60 bg-white p-3"
              />
            ) : (
              <div className="flex h-64 w-64 items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/30 px-4 text-center text-sm text-muted-foreground">
                {issueMutation.isPending
                  ? 'Generating…'
                  : expired
                    ? 'Code expired — generate a new one'
                    : 'QR unavailable — use the code below'}
              </div>
            )}

            {issued ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Expires in{' '}
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatRemaining(issued.expiresAt)}
                  </span>
                </p>
                <div className="w-full rounded-xl border border-border/50 bg-muted/20 p-3">
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    One-time code
                  </p>
                  <p className="break-all font-mono text-xs leading-relaxed">{issued.token}</p>
                </div>
              </>
            ) : null}

            {issueMutation.isError ? (
              <p className="text-sm text-destructive">
                Could not issue a login QR. Ask your institution to enable QR login, or try again.
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={copyToken}
                disabled={!issued || expired}
              >
                <Copy className="mr-2 h-4 w-4" />
                {copied ? 'Copied' : 'Copy code'}
              </Button>
              <Button type="button" onClick={refresh} disabled={issueMutation.isPending}>
                <RefreshCw className="mr-2 h-4 w-4" />
                New code
              </Button>
            </div>
          </div>
        </GlassCard>
      </ErpWorkspace>
    </DashboardShell>
  );
}
