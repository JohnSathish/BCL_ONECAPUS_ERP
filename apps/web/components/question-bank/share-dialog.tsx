'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Link2, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  createPaperShareLink,
  fetchPaperShareLinks,
  revokePaperShareLink,
  shareDownloadUrl,
} from '@/services/question-bank';
import { apiErrorMessage } from '@/utils/api-error';

type Props = {
  paperId: string;
  paperLabel: string;
  onClose: () => void;
};

export function SharePaperDialog({ paperId, paperLabel, onClose }: Props) {
  const queryEnabled = useAuthQueryEnabled();
  const queryClient = useQueryClient();
  const [expiresInDays, setExpiresInDays] = useState('30');
  const [latestLink, setLatestLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const sharesQuery = useQuery({
    queryKey: ['question-bank', 'shares', paperId],
    queryFn: () => fetchPaperShareLinks(paperId),
    enabled: queryEnabled && Boolean(paperId),
  });

  const createMut = useMutation({
    mutationFn: () =>
      createPaperShareLink(paperId, expiresInDays ? Number(expiresInDays) : undefined),
    onSuccess: (data) => {
      setLatestLink(shareDownloadUrl(data.token));
      queryClient.invalidateQueries({ queryKey: ['question-bank', 'shares', paperId] });
    },
  });

  const revokeMut = useMutation({
    mutationFn: (shareId: string) => revokePaperShareLink(shareId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question-bank', 'shares', paperId] });
    },
  });

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const activeShares = (sharesQuery.data ?? []).filter((s) => !s.revokedAt);
  const revokedShares = (sharesQuery.data ?? []).filter((s) => s.revokedAt);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-xl border bg-background p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-semibold">
              <Link2 className="h-4 w-4" /> Share paper
            </h3>
            <p className="text-sm text-muted-foreground">{paperLabel}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <label className="block space-y-1 text-sm">
          <span>Expires in (days)</span>
          <Input
            type="number"
            min={1}
            max={365}
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(e.target.value)}
          />
        </label>

        <Button disabled={createMut.isPending} onClick={() => createMut.mutate()}>
          {createMut.isPending ? 'Creating…' : 'Create share link'}
        </Button>

        {latestLink ? (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">New link</p>
            <Input readOnly value={latestLink} />
            <Button variant="outline" size="sm" onClick={() => copy(latestLink)}>
              <Copy className="mr-1 h-3 w-3" /> {copied ? 'Copied' : 'Copy link'}
            </Button>
          </div>
        ) : null}

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Active links</h4>
          {!activeShares.length ? (
            <p className="text-sm text-muted-foreground">No active share links.</p>
          ) : (
            <ul className="space-y-2">
              {activeShares.map((s) => {
                const url = shareDownloadUrl(s.token);
                const expired = s.expiresAt != null && new Date(s.expiresAt).getTime() < Date.now();
                return (
                  <li key={s.id} className="rounded-lg border p-3 text-sm">
                    <p className="truncate text-xs text-muted-foreground">{url}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Created {new Date(s.createdAt).toLocaleString()}
                      {s.expiresAt
                        ? ` · Expires ${new Date(s.expiresAt).toLocaleDateString()}`
                        : ' · No expiry'}
                      {expired ? ' · Expired' : ''}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => copy(url)}>
                        <Copy className="mr-1 h-3 w-3" /> Copy
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={revokeMut.isPending}
                        onClick={() => revokeMut.mutate(s.id)}
                      >
                        <Trash2 className="mr-1 h-3 w-3" /> Revoke
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {revokedShares.length ? (
          <p className="text-xs text-muted-foreground">
            {revokedShares.length} revoked link{revokedShares.length === 1 ? '' : 's'}
          </p>
        ) : null}

        {createMut.isError ? (
          <p className="text-sm text-destructive">{apiErrorMessage(createMut.error)}</p>
        ) : null}
        {revokeMut.isError ? (
          <p className="text-sm text-destructive">{apiErrorMessage(revokeMut.error)}</p>
        ) : null}
        {sharesQuery.isError ? (
          <p className="text-sm text-destructive">{apiErrorMessage(sharesQuery.error)}</p>
        ) : null}
      </div>
    </div>
  );
}
