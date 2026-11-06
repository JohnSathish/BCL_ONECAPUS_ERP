'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock, Database, Eye, EyeOff, FileArchive, Gauge, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { requestStepUpToken } from '@/services/step-up';
import {
  BackupDownloadCancelled,
  cancelBackupBundle,
  downloadBackupBundle,
  formatBytes,
  type BackupDownloadProgress,
  type BackupDownloadStage,
} from '@/services/backup';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

const STAGES: Array<{ id: BackupDownloadStage; label: string; detail: string }> = [
  {
    id: 'preparing',
    label: 'Preparing database backup',
    detail: 'Reading the backup files on the server.',
  },
  {
    id: 'compressing',
    label: 'Compressing database and uploaded files',
    detail: 'Copying the database and uploaded files into the ZIP.',
  },
  {
    id: 'finalising',
    label: 'Finalising ZIP archive',
    detail: 'Closing the archive and checking it on the server.',
  },
  {
    id: 'downloading',
    label: 'Downloading ZIP file',
    detail: 'Sending the ZIP to this computer.',
  },
  {
    id: 'verifying',
    label: 'Verifying downloaded file',
    detail: 'Checking the file that arrived.',
  },
];

type Status = 'idle' | 'running' | 'success' | 'error' | 'cancelled';

function formatEta(seconds: number | null) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null;
  const rounded = Math.round(seconds);
  if (rounded < 1) return 'Less than a second left';
  if (rounded < 60) return `~ ${rounded} seconds left`;
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  if (minutes < 60) {
    return rest ? `~ ${minutes} min ${rest} sec left` : `~ ${minutes} min left`;
  }
  const hours = Math.floor(minutes / 60);
  return `~ ${hours} hr ${minutes % 60} min left`;
}

export function BackupDownloadDialog({
  open,
  runId,
  filename,
  onOpenChange,
}: {
  open: boolean;
  runId: string | null;
  filename: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<BackupDownloadProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef<string | null>(null);
  const requestSent = useRef(false);
  const cancelRequested = useRef(false);

  useEffect(() => {
    if (!open) return;
    setPassword('');
    setShowPassword(false);
    setStatus('idle');
    setMessage(null);
    setProgress(null);
    cancelRequested.current = false;
  }, [open, runId]);

  useEffect(() => {
    return () => {
      const controller = abortRef.current;
      const id = runIdRef.current;
      abortRef.current = null;
      if (!controller || !id || !requestSent.current) return;
      controller.abort();
      void cancelBackupBundle(id);
    };
  }, []);

  const requestClose = () => {
    if (status === 'running') {
      stopDownload();
      return;
    }
    onOpenChange(false);
  };

  const stopDownload = () => {
    if (cancelRequested.current) return;
    cancelRequested.current = true;
    const id = runIdRef.current;
    abortRef.current?.abort();
    if (id && requestSent.current) void cancelBackupBundle(id);
  };

  const submit = async () => {
    if (!runId || status === 'running') return;
    if (!password.trim()) {
      setMessage('Password is required.');
      return;
    }
    setStatus('running');
    setMessage(null);
    setProgress(null);
    cancelRequested.current = false;
    requestSent.current = false;
    const controller = new AbortController();
    abortRef.current = controller;
    runIdRef.current = runId;
    try {
      const token = await requestStepUpToken({ password });
      if (controller.signal.aborted) throw new BackupDownloadCancelled();
      await downloadBackupBundle(runId, filename, token, {
        signal: controller.signal,
        onProgress: setProgress,
        onRequest: () => {
          requestSent.current = true;
        },
      });
      setStatus('success');
      setMessage('Backup downloaded. The ZIP was saved to your downloads.');
    } catch (error) {
      if (cancelRequested.current || error instanceof BackupDownloadCancelled) {
        setStatus('cancelled');
        setMessage('Download cancelled. The backup on the server was not deleted.');
        return;
      }
      setMessage(apiErrorMessage(error, 'The backup could not be downloaded.'));
      setStatus(requestSent.current ? 'error' : 'idle');
    } finally {
      abortRef.current = null;
    }
  };

  const stageId = progress?.stage === 'done' ? 'verifying' : progress?.stage;
  const stage = STAGES.find((item) => item.id === stageId);
  const skipped = new Set(progress?.skippedStages ?? []);
  const stageIndex = STAGES.findIndex((item) => item.id === stageId);
  const percent = progress?.percent ?? null;
  const sizeLabel =
    progress?.bytesProcessed != null && progress.bytesTotal != null && progress.bytesTotal > 0
      ? `${formatBytes(progress.bytesProcessed)} of ${formatBytes(progress.bytesTotal)}`
      : null;
  const speedLabel =
    progress?.bytesPerSecond != null && progress.bytesPerSecond > 0
      ? `${formatBytes(progress.bytesPerSecond)}/s`
      : null;
  const etaLabel = formatEta(progress?.etaSeconds ?? null);
  const showProgress = status === 'running' || status === 'success' || progress != null;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : requestClose())}>
      <DialogContent className="sm:max-w-lg">
        <style>{`
          @keyframes backup-indeterminate {
            0% { transform: translateX(-120%); }
            100% { transform: translateX(320%); }
          }
        `}</style>
        <DialogHeader>
          <DialogTitle>Confirm your identity</DialogTitle>
          <DialogDescription>
            Re-enter your password. A backup ZIP is about 1 GB and can take several minutes. Leave
            this window open.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-2">
            <Label htmlFor="backup-download-password">Password</Label>
            <div className="relative">
              <Input
                id="backup-download-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                disabled={status === 'running'}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && status !== 'running') void submit();
                }}
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {showProgress && stage ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-[10px] font-bold text-violet-700">
                  <FileArchive className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-slate-900">{stage.label}</p>
                    {percent != null ? (
                      <span className="rounded-md bg-blue-100 px-2 py-0.5 text-sm font-semibold text-blue-700">
                        {percent}%
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-slate-500">{stage.detail}</p>
                </div>
              </div>
              <div
                className="relative mt-3 h-2 overflow-hidden rounded-full bg-slate-200"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent ?? undefined}
                aria-label={stage.label}
              >
                {percent != null ? (
                  <div
                    className="h-full rounded-full bg-blue-600"
                    style={{ width: `${percent}%` }}
                  />
                ) : (
                  <div
                    className="absolute inset-y-0 w-1/3 rounded-full bg-blue-600"
                    style={{ animation: 'backup-indeterminate 1.2s ease-in-out infinite' }}
                  />
                )}
              </div>
              {sizeLabel || speedLabel || etaLabel ? (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  {sizeLabel ? (
                    <span className="inline-flex items-center gap-1">
                      <Database className="h-3.5 w-3.5" /> {sizeLabel}
                    </span>
                  ) : null}
                  {speedLabel ? (
                    <span className="inline-flex items-center gap-1">
                      <Gauge className="h-3.5 w-3.5" /> {speedLabel}
                    </span>
                  ) : null}
                  {etaLabel ? (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {etaLabel}
                    </span>
                  ) : null}
                </div>
              ) : null}
              <ol className="mt-3 space-y-1 border-t border-slate-200 pt-2 text-xs">
                {STAGES.map((item, index) => {
                  const state = skipped.has(item.id)
                    ? 'skipped'
                    : status === 'success' || progress?.stage === 'done'
                      ? 'done'
                      : index < stageIndex
                        ? 'done'
                        : index === stageIndex
                          ? 'current'
                          : 'pending';
                  return (
                    <li
                      key={item.id}
                      className={cn(
                        'flex items-center gap-2',
                        state === 'current' && 'font-medium text-blue-700',
                        state === 'done' && 'text-emerald-700',
                        state === 'skipped' && 'text-slate-400',
                        state === 'pending' && 'text-slate-400',
                      )}
                    >
                      <span className="w-3">
                        {state === 'done' ? '✓' : state === 'current' ? '→' : '○'}
                      </span>
                      {item.label}
                      {state === 'skipped' ? ' · not needed' : ''}
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : null}

          {message ? (
            <p
              className={cn(
                'text-sm',
                status === 'success' && 'text-emerald-700',
                status === 'cancelled' && 'text-amber-700',
                (status === 'error' || status === 'idle') && 'text-destructive',
              )}
            >
              {message}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          {status === 'running' ? (
            <Button variant="outline" onClick={stopDownload}>
              Cancel
            </Button>
          ) : status === 'idle' ? (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          ) : null}
          {status === 'running' ? (
            <Button disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Downloading…
            </Button>
          ) : status === 'idle' ? (
            <Button onClick={() => void submit()}>Continue</Button>
          ) : (
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
