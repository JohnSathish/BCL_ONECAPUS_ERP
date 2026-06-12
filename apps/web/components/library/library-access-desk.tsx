'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useLibraryRealtime } from '@/hooks/use-library-realtime';
import {
  fetchLibraryOccupancy,
  registerLibraryVisitor,
  scanLibraryAccess,
} from '@/services/library';
import type { OccupancySnapshot, ScanResult } from '@/types/library';
import { apiErrorMessage } from '@/utils/api-error';

type DeskState = 'idle' | 'welcome' | 'thankyou';

function playBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.start();
    setTimeout(() => {
      osc.stop();
      void ctx.close();
    }, 180);
  } catch {
    /* ignore */
  }
}

function formatDuration(minutes?: number | null) {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} Minutes`;
  return `${h} Hour${h > 1 ? 's' : ''} ${m} Minutes`;
}

function OccupancyCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: string;
}) {
  return (
    <div className={`rounded-xl border bg-card/90 p-3 shadow-sm ${accent ?? ''}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}

function HourlyChart({ data }: { data: OccupancySnapshot['hourlyFootfall'] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="mt-4 rounded-xl border bg-card/80 p-4">
      <p className="mb-3 text-sm font-medium text-muted-foreground">Today&apos;s hourly footfall</p>
      <div className="flex h-24 items-end gap-1">
        {data.slice(8, 20).map((b) => (
          <div key={b.hour} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-primary/70"
              style={{ height: `${Math.max(4, (b.count / max) * 100)}%` }}
              title={`${b.hour}:00 — ${b.count}`}
            />
            <span className="text-[10px] text-muted-foreground">{b.hour}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LibraryAccessDesk() {
  const qc = useQueryClient();
  const enabled = useAuthQueryEnabled();
  const inputRef = useRef<HTMLInputElement>(null);
  const [buffer, setBuffer] = useState('');
  const [state, setState] = useState<DeskState>('idle');
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [error, setError] = useState('');
  const [visitorOpen, setVisitorOpen] = useState(false);
  const [visitorForm, setVisitorForm] = useState({
    fullName: '',
    mobile: '',
    institution: '',
    purpose: '',
  });
  const [liveOccupancy, setLiveOccupancy] = useState<OccupancySnapshot | null>(null);

  useLibraryRealtime((snapshot) => {
    setLiveOccupancy(snapshot);
    qc.setQueryData(['library', 'occupancy'], snapshot);
  });

  const occupancy = useQuery({
    queryKey: ['library', 'occupancy'],
    queryFn: fetchLibraryOccupancy,
    enabled,
    refetchInterval: 30_000,
  });

  const scanMut = useMutation({
    mutationFn: (code: string) => scanLibraryAccess(code),
    onSuccess: (result) => {
      setLastScan(result);
      setState(result.action === 'ENTRY' ? 'welcome' : 'thankyou');
      playBeep();
      void qc.invalidateQueries({ queryKey: ['library', 'occupancy'] });
      setTimeout(() => {
        setState('idle');
        setLastScan(null);
        inputRef.current?.focus();
      }, 4000);
    },
    onError: (err) => {
      setError(apiErrorMessage(err));
      setTimeout(() => setError(''), 3000);
      inputRef.current?.focus();
    },
  });

  const visitorMut = useMutation({
    mutationFn: () => registerLibraryVisitor(visitorForm),
    onSuccess: (v) => {
      setVisitorOpen(false);
      setVisitorForm({ fullName: '', mobile: '', institution: '', purpose: '' });
      scanMut.mutate(v.passNumber);
    },
  });

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    focusInput();
    const id = setInterval(focusInput, 2000);
    return () => clearInterval(id);
  }, [focusInput]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = buffer.trim();
      setBuffer('');
      if (code) scanMut.mutate(code);
      return;
    }
    if (e.key.length === 1) {
      setBuffer((prev) => prev + e.key);
    }
  };

  const occ = liveOccupancy ?? occupancy.data;

  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <input
        ref={inputRef}
        className="pointer-events-none absolute opacity-0"
        value={buffer}
        onChange={() => undefined}
        onKeyDown={handleKeyDown}
        autoFocus
        aria-hidden
      />

      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-3">
          <BookOpen className="h-8 w-8 text-emerald-400" />
          <div>
            <h1 className="text-lg font-semibold">Library Access Desk</h1>
            <p className="text-xs text-white/60">Scan RFID, barcode, or student QR code</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-white/20 bg-white/5 text-white"
          onClick={() => setVisitorOpen(true)}
        >
          <Users className="mr-2 h-4 w-4" />
          Register Visitor
        </Button>
      </header>

      {occ ? (
        <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4 lg:grid-cols-8">
          <OccupancyCard label="Students Inside" value={occ.studentsInside} />
          <OccupancyCard label="Male Students" value={occ.maleStudents} />
          <OccupancyCard label="Female Students" value={occ.femaleStudents} />
          <OccupancyCard label="Faculty Inside" value={occ.facultyInside} />
          <OccupancyCard label="Staff Inside" value={occ.staffInside} />
          <OccupancyCard label="Visitors Inside" value={occ.visitorsInside} />
          <OccupancyCard
            label="Available Seats"
            value={occ.availableSeats}
            accent="border-emerald-500/30"
          />
          <OccupancyCard
            label="Occupancy %"
            value={`${occ.occupancyPercent}%`}
            accent="border-blue-500/30"
          />
        </div>
      ) : null}

      <main className="flex flex-1 flex-col items-center justify-center p-6">
        {error ? (
          <div className="mb-4 rounded-lg bg-red-500/20 px-4 py-2 text-red-200">{error}</div>
        ) : null}

        {state === 'idle' ? (
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-32 w-32 items-center justify-center rounded-full border-2 border-dashed border-white/20">
              <BookOpen className="h-16 w-16 text-white/30" />
            </div>
            <p className="text-2xl font-light text-white/80">Ready for scan</p>
            <p className="mt-2 text-sm text-white/50">
              Barcode/RFID reader or phone QR — entry/exit toggles automatically
            </p>
            {scanMut.isPending ? (
              <p className="mt-4 animate-pulse text-emerald-400">Processing…</p>
            ) : null}
          </div>
        ) : null}

        {state === 'welcome' && lastScan ? (
          <div className="animate-pulse text-center">
            <div className="mx-auto mb-4 rounded-2xl border-2 border-emerald-400 bg-emerald-500/10 px-8 py-6">
              <p className="text-sm uppercase tracking-widest text-emerald-300">
                Welcome to Library
              </p>
              <p className="mt-2 text-3xl font-bold">{lastScan.profile.fullName}</p>
              {lastScan.profile.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={lastScan.profile.photoUrl}
                  alt=""
                  className="mx-auto mt-4 h-28 w-28 rounded-full border-4 border-emerald-400 object-cover"
                />
              ) : null}
              <p className="mt-3 text-white/70">{lastScan.profile.department ?? '—'}</p>
              <p className="text-white/60">Semester {lastScan.profile.semester ?? '—'}</p>
              <p className="mt-4 text-lg text-emerald-300">Access Granted</p>
              {lastScan.zone?.seatLabel ? (
                <p className="mt-2 text-sm text-emerald-200">
                  Seat {lastScan.zone.seatLabel} · {lastScan.zone.name}
                </p>
              ) : null}
              <p className="text-sm text-white/50">
                {new Date(lastScan.visit.entryAt).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ) : null}

        {state === 'thankyou' && lastScan ? (
          <div className="text-center">
            <div className="mx-auto rounded-2xl border border-amber-400/50 bg-amber-500/10 px-8 py-6">
              <p className="text-sm uppercase tracking-widest text-amber-200">Thank You</p>
              <p className="mt-2 text-3xl font-bold">{lastScan.profile.fullName}</p>
              <p className="mt-4 text-white/70">
                Time Out: {new Date(lastScan.visit.exitAt ?? '').toLocaleTimeString()}
              </p>
              <p className="mt-2 text-xl text-amber-200">
                Total Duration: {formatDuration(lastScan.visit.durationMinutes)}
              </p>
            </div>
          </div>
        ) : null}
      </main>

      {occ ? (
        <div className="p-4">
          <HourlyChart data={occ.hourlyFootfall} />
        </div>
      ) : null}

      {visitorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-6 text-foreground shadow-xl">
            <h2 className="text-lg font-semibold">Register Visitor</h2>
            <div className="mt-4 space-y-3">
              <Input
                placeholder="Full name"
                value={visitorForm.fullName}
                onChange={(e) => setVisitorForm({ ...visitorForm, fullName: e.target.value })}
              />
              <Input
                placeholder="Mobile"
                value={visitorForm.mobile}
                onChange={(e) => setVisitorForm({ ...visitorForm, mobile: e.target.value })}
              />
              <Input
                placeholder="Institution"
                value={visitorForm.institution}
                onChange={(e) => setVisitorForm({ ...visitorForm, institution: e.target.value })}
              />
              <Input
                placeholder="Purpose"
                value={visitorForm.purpose}
                onChange={(e) => setVisitorForm({ ...visitorForm, purpose: e.target.value })}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setVisitorOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!visitorForm.fullName.trim() || visitorMut.isPending}
                onClick={() => visitorMut.mutate()}
              >
                Register &amp; Check In
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
