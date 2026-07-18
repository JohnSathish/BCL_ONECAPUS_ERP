'use client';

import { useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { publicEventCheckIn } from '@/services/campus-competitions';

export default function CompetitionCheckInKioskPage() {
  const params = useParams<{ eventId: string }>();
  const search = useSearchParams();
  const eventId = params.eventId ?? '';
  const token = search.get('token') ?? '';
  const [scanCode, setScanCode] = useState('');
  const [last, setLast] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const mut = useMutation({
    mutationFn: () =>
      publicEventCheckIn(eventId, token, {
        scanCode: scanCode.trim(),
      }),
    onSuccess: (data: { alreadyCheckedIn?: boolean }) => {
      setLast({
        tone: 'ok',
        text: data.alreadyCheckedIn ? 'Already checked in' : 'Checked in',
      });
      setScanCode('');
    },
    onError: (e) =>
      setLast({
        tone: 'err',
        text: e instanceof Error ? e.message : 'Check-in failed',
      }),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-white/10 bg-slate-900 p-6">
        <h1 className="text-xl font-semibold">Event check-in</h1>
        <p className="text-sm text-slate-400">
          Scan RFID card or enter QR pass / enrollment number.
        </p>
        {!token ? (
          <p className="rounded-lg border border-rose-400/40 bg-rose-950/40 px-3 py-2 text-sm text-rose-100">
            Missing check-in token in URL.
          </p>
        ) : (
          <>
            <Input
              autoFocus
              className="bg-slate-950 text-white"
              placeholder="Scan or type code"
              value={scanCode}
              onChange={(e) => setScanCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && scanCode.trim()) mut.mutate();
              }}
            />
            <Button
              className="w-full"
              type="button"
              disabled={!scanCode.trim() || mut.isPending}
              onClick={() => mut.mutate()}
            >
              Check in
            </Button>
          </>
        )}
        {last ? (
          <p
            className={`rounded-lg px-3 py-2 text-sm ${
              last.tone === 'ok'
                ? 'border border-emerald-400/30 bg-emerald-950/40 text-emerald-100'
                : 'border border-rose-400/30 bg-rose-950/40 text-rose-100'
            }`}
          >
            {last.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}
