'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, CheckCircle2, XCircle } from 'lucide-react';
import { fetchKioskBootstrap, fetchKioskLive, scanKiosk } from '@/services/campus-access';
import type { KioskBootstrap, KioskScanResult } from '@/types/campus-access';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import { cn } from '@/utils/cn';

type DeskState = 'idle' | 'allowed-in' | 'allowed-out' | 'denied';

function speak(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 0.95;
  window.speechSynthesis.speak(utter);
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function StatBlock({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number | string }[];
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-white/60">{title}</p>
      <dl className="mt-2 space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between text-sm">
            <dt className="text-white/70">{r.label}</dt>
            <dd className="font-semibold text-white">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function CampusAccessKiosk({ code, token }: { code: string; token: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [buffer, setBuffer] = useState('');
  const [state, setState] = useState<DeskState>('idle');
  const [lastScan, setLastScan] = useState<KioskScanResult | null>(null);
  const [error, setError] = useState('');

  const bootstrapQ = useQuery({
    queryKey: ['kiosk', code, 'bootstrap'],
    queryFn: () => fetchKioskBootstrap(code, token),
    enabled: Boolean(code && token),
    retry: 1,
  });

  const liveQ = useQuery({
    queryKey: ['kiosk', code, 'live'],
    queryFn: () => fetchKioskLive(code, token),
    enabled: Boolean(code && token),
    refetchInterval: 2000,
  });

  const bootstrap = bootstrapQ.data;
  const stats = liveQ.data ?? bootstrap?.stats;

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    focusInput();
    const id = setInterval(focusInput, 1500);
    return () => clearInterval(id);
  }, [focusInput]);

  const submitScan = useCallback(
    async (scanCode: string) => {
      const trimmed = scanCode.trim();
      if (!trimmed) return;
      setError('');
      try {
        const result = await scanKiosk(code, token, trimmed);
        setLastScan(result);
        if (!result.allowed) {
          setState('denied');
        } else if (result.direction === 'OUT') {
          setState('allowed-out');
        } else {
          setState('allowed-in');
        }
        if (result.voiceMessage) speak(result.voiceMessage);
        void liveQ.refetch();
        setTimeout(() => {
          setState('idle');
          setLastScan(null);
          focusInput();
        }, 4000);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Scan failed');
        setState('denied');
        setTimeout(() => {
          setState('idle');
          setError('');
          focusInput();
        }, 3000);
      }
    },
    [code, token, liveQ, focusInput],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void submitScan(buffer);
      setBuffer('');
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <p>Kiosk token missing. Configure URL with ?token=… from Campus Access admin.</p>
      </div>
    );
  }

  if (bootstrapQ.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <p>Starting kiosk…</p>
      </div>
    );
  }

  if (bootstrapQ.isError || !bootstrap) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <p>Unable to connect kiosk. Check token and access point.</p>
      </div>
    );
  }

  const member = lastScan?.member;
  const showLibrary = bootstrap.accessPoint.accessType === 'LIBRARY' && member && lastScan?.allowed;

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-emerald-400">
            Campus Access Management
          </p>
          <h1 className="text-lg font-bold">{bootstrap.institutionName}</h1>
          <p className="text-sm text-white/60">{bootstrap.accessPoint.name}</p>
        </div>
        <div className="flex flex-wrap gap-4 text-center text-sm">
          <div>
            <p className="text-white/50">Entries</p>
            <p className="text-xl font-bold">{stats?.todayEntries ?? 0}</p>
          </div>
          <div>
            <p className="text-white/50">Exits</p>
            <p className="text-xl font-bold">{stats?.todayExits ?? 0}</p>
          </div>
          <div>
            <p className="text-white/50">Inside</p>
            <p className="text-xl font-bold text-emerald-400">{stats?.currentlyInside ?? 0}</p>
          </div>
          <div>
            <p className="text-white/50">Scans</p>
            <p className="text-xl font-bold">{stats?.scansToday ?? 0}</p>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[1fr_1.1fr_0.9fr]">
        {/* Left — profile */}
        <section className="border-r border-white/10 p-6">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/50">
            Live Scan
          </p>
          {member ? (
            <div className="space-y-4">
              <div className="mx-auto h-36 w-36 overflow-hidden rounded-2xl border-2 border-white/20 bg-white/10">
                {member.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resolveUploadAssetUrl(member.photoUrl) ?? member.photoUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-4xl font-bold text-white/30">
                    {member.fullName.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <dl className="space-y-2 text-sm">
                <Row label="Name" value={member.fullName} />
                <Row label="Enrollment No." value={member.enrollmentNumber} />
                <Row label="Programme" value={member.programme} />
                <Row label="Semester" value={member.semester ? `Sem ${member.semester}` : '—'} />
                <Row label="Mobile" value={member.mobile} />
                <Row label="Gender" value={member.gender} />
                <Row label="Status" value={member.status} />
                <Row label="Hosteller" value={member.hosteller ? 'Yes' : 'No'} />
                <Row label="Library Membership" value={member.libraryMembership} />
              </dl>
              {showLibrary ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                  <p className="mb-2 flex items-center gap-2 font-semibold text-amber-200">
                    <BookOpen className="h-4 w-4" /> Library
                  </p>
                  <p>Books Borrowed: {member.booksBorrowed ?? 0}</p>
                  <p>Books Due: {member.booksDue ?? 0}</p>
                  <p>Fine: ₹{member.outstandingFine ?? 0}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center text-white/40">
              <p className="text-lg">Scan student or staff ID</p>
              <p className="mt-2 text-sm">Barcode · QR · Enrollment number</p>
            </div>
          )}
        </section>

        {/* Center — status animation */}
        <section
          className={cn(
            'flex flex-col items-center justify-center p-8 transition-colors duration-300',
            state === 'allowed-in' && 'bg-emerald-600',
            state === 'allowed-out' && 'bg-blue-600',
            state === 'denied' && 'bg-red-600',
            state === 'idle' && 'bg-slate-900',
          )}
        >
          {state === 'idle' && !error ? (
            <div className="text-center">
              <p className="text-2xl font-light text-white/70">Ready to scan</p>
              <p className="mt-2 text-sm text-white/40">Place ID card under scanner</p>
            </div>
          ) : null}
          {state === 'allowed-in' && member ? (
            <StatusPanel
              icon={CheckCircle2}
              title="ENTRY ALLOWED"
              subtitle="WELCOME"
              name={member.fullName}
              time={formatTime(lastScan!.scannedAt)}
            />
          ) : null}
          {state === 'allowed-out' && member ? (
            <StatusPanel
              icon={CheckCircle2}
              title="EXIT RECORDED"
              subtitle="THANK YOU"
              name={member.fullName}
              time={formatTime(lastScan!.scannedAt)}
            />
          ) : null}
          {(state === 'denied' || error) && (
            <StatusPanel
              icon={XCircle}
              title="ENTRY DENIED"
              subtitle={lastScan?.denialReason ?? error ?? 'Access not permitted'}
              name={member?.fullName ?? '—'}
              time={lastScan ? formatTime(lastScan.scannedAt) : ''}
            />
          )}
        </section>

        {/* Right — stats + feed */}
        <section className="flex flex-col gap-4 overflow-y-auto border-l border-white/10 p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/50">
            Today&apos;s Statistics
          </p>
          <StatBlock
            title="Students inside"
            rows={[
              { label: 'Male', value: stats?.studentsInside.male ?? 0 },
              { label: 'Female', value: stats?.studentsInside.female ?? 0 },
              { label: 'Total', value: stats?.studentsInside.total ?? 0 },
            ]}
          />
          <StatBlock
            title="Staff inside"
            rows={[
              { label: 'Teaching', value: stats?.staffInside.teaching ?? 0 },
              { label: 'Non-teaching', value: stats?.staffInside.nonTeaching ?? 0 },
            ]}
          />
          <StatBlock
            title="Visitors inside"
            rows={[{ label: 'Total', value: stats?.visitorsInside ?? 0 }]}
          />
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
              Live activity
            </p>
            <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-sm">
              {(stats?.activity ?? []).map((a, i) => (
                <li
                  key={`${a.at}-${i}`}
                  className="flex justify-between gap-2 border-b border-white/5 pb-2"
                >
                  <span className="text-white/50">{formatTime(a.at)}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{a.name}</span>
                  <span
                    className={cn(
                      'shrink-0 font-bold',
                      a.direction === 'IN' ? 'text-emerald-400' : 'text-blue-400',
                    )}
                  >
                    {a.direction}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <input
        ref={inputRef}
        type="text"
        value={buffer}
        onChange={(e) => setBuffer(e.target.value)}
        onKeyDown={onKeyDown}
        className="pointer-events-none absolute opacity-0"
        aria-hidden
        autoComplete="off"
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 border-b border-white/5 pb-1">
      <dt className="text-white/50">{label}</dt>
      <dd className="text-right font-medium">{value ?? '—'}</dd>
    </div>
  );
}

function StatusPanel({
  icon: Icon,
  title,
  subtitle,
  name,
  time,
}: {
  icon: typeof CheckCircle2;
  title: string;
  subtitle: string;
  name: string;
  time: string;
}) {
  return (
    <div className="animate-in zoom-in-95 text-center duration-300">
      <Icon className="mx-auto h-24 w-24" strokeWidth={1.5} />
      <p className="mt-4 text-3xl font-extrabold tracking-wide">{title}</p>
      <p className="mt-2 text-xl font-semibold opacity-90">{subtitle}</p>
      <p className="mt-6 text-4xl font-black uppercase tracking-tight">{name}</p>
      {time ? <p className="mt-4 text-lg opacity-80">{time}</p> : null}
    </div>
  );
}
