'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Bell,
  BookOpen,
  Clock,
  LayoutDashboard,
  LogIn,
  LogOut,
  Maximize2,
  Minimize2,
  ScanLine,
  Settings,
  User,
  UserPlus,
  Users,
  Wifi,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LibraryDeskSidePanel } from '@/components/library/library-desk-side-panel';
import { LibraryScannerStage, type ScannerPhase } from '@/components/library/library-scanner-stage';
import { useBranding } from '@/hooks/use-branding';
import { useAuth } from '@/hooks/use-auth';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useLibraryRealtime } from '@/hooks/use-library-realtime';
import { logoutClientSide } from '@/lib/auth/client-logout';
import {
  fetchLibraryAccessDeskDashboard,
  registerLibraryVisitor,
  scanLibraryAccess,
} from '@/services/library';
import type { ScanResult } from '@/types/library';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

function playBeep(ok = true) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = ok ? 880 : 440;
    gain.gain.value = 0.08;
    osc.start();
    setTimeout(
      () => {
        osc.stop();
        void ctx.close();
      },
      ok ? 180 : 280,
    );
  } catch {
    /* ignore */
  }
}

function formatStay(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
}

/** How long entry/exit success stays on screen before returning to idle (queue throughput). */
const SUCCESS_DISPLAY_MS = 3_500;
const ERROR_DISPLAY_MS = 3_500;
/** USB scanners type very fast; auto-submit after a short pause. Manual typing uses Enter / Scan. */
const SCAN_AUTO_SUBMIT_MS = 120;
const SCAN_KEY_GAP_MS = 80;
const MIN_AUTO_SCAN_LENGTH = 3;

function isFastScannerInput(keyTimes: number[], length: number) {
  if (length < MIN_AUTO_SCAN_LENGTH || keyTimes.length < 3) return false;
  const gaps = keyTimes.slice(1).map((t, i) => t - keyTimes[i]!);
  const recent = gaps.slice(-Math.min(gaps.length, length - 1));
  return recent.length >= 2 && recent.every((gap) => gap < SCAN_KEY_GAP_MS);
}

function useLiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function changeLabel(value?: number | null) {
  if (value == null) return undefined;
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}% from yesterday`;
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: typeof Users;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-950">{value}</p>
          {sub ? <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p> : null}
        </div>
        <div className={cn('rounded-xl p-2', tone)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

const VISITOR_TYPES = [
  'Parent',
  'Guest',
  'Alumni',
  'Vendor',
  'External Faculty',
  'Inspection Team',
] as const;

function HourlyFootfallChart({
  entries,
  exits,
}: {
  entries: { hour: number; count: number }[];
  exits: { hour: number; count: number }[];
}) {
  const slice = entries.filter((row) => row.hour >= 8 && row.hour <= 20);
  const exitMap = new Map(exits.map((row) => [row.hour, row.count]));
  const max = Math.max(1, ...slice.map((row) => Math.max(row.count, exitMap.get(row.hour) ?? 0)));
  const peak = slice.reduce((best, row) => (row.count > best.count ? row : best), slice[0]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Hourly footfall today</h3>
        <div className="flex gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-sky-500" /> Entries
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-emerald-400" /> Exits
          </span>
        </div>
      </div>
      <div className="flex h-36 items-end gap-1">
        {slice.map((row) => {
          const exitCount = exitMap.get(row.hour) ?? 0;
          return (
            <div key={row.hour} className="flex flex-1 items-end justify-center gap-0.5">
              <div className="flex h-28 w-full flex-col items-center justify-end gap-1">
                <div className="flex h-full w-full items-end gap-0.5">
                  <div
                    className="w-1/2 rounded-t bg-sky-500"
                    style={{ height: `${Math.max(row.count ? 6 : 0, (row.count / max) * 100)}%` }}
                    title={`${row.hour}:00 entries ${row.count}`}
                  />
                  <div
                    className="w-1/2 rounded-t bg-emerald-400"
                    style={{ height: `${Math.max(exitCount ? 6 : 0, (exitCount / max) * 100)}%` }}
                    title={`${row.hour}:00 exits ${exitCount}`}
                  />
                </div>
                <span className="text-[9px] text-slate-400">{row.hour}</span>
              </div>
            </div>
          );
        })}
      </div>
      {peak && peak.count > 0 ? (
        <p className="mt-2 text-xs text-slate-500">
          Peak: {peak.hour}:00–{peak.hour + 1}:00 ({peak.count} entries)
        </p>
      ) : (
        <p className="mt-2 text-xs text-slate-500">No entries recorded between 8:00 and 20:00.</p>
      )}
    </div>
  );
}

const SIDEBAR = [
  { icon: LayoutDashboard, label: 'Dashboard', active: true },
  { icon: ScanLine, label: 'Live Entry/Exit' },
  { icon: Users, label: 'Visitors Log', href: '/admin/library/visits' },
  { icon: User, label: 'Students Inside', href: '/library-desk/reports?view=inside' },
  { icon: BookOpen, label: 'Reports', href: '/library-desk/reports' },
  { icon: Bell, label: 'Alerts' },
  { icon: Settings, label: 'Settings', href: '/admin/library/settings' },
];

export function LibraryAccessDesk() {
  const qc = useQueryClient();
  const enabled = useAuthQueryEnabled();
  const { session } = useAuth();
  const branding = useBranding();
  const now = useLiveClock();
  const inputRef = useRef<HTMLInputElement>(null);
  const scanKeyTimesRef = useRef<number[]>([]);
  const scanAutoTimerRef = useRef<number | undefined>(undefined);
  const scanResetTimerRef = useRef<number | undefined>(undefined);
  const [scanInput, setScanInput] = useState('');
  const [displayPhase, setDisplayPhase] = useState<ScannerPhase>('idle');
  const [fullscreen, setFullscreen] = useState(false);
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [error, setError] = useState('');
  const [visitorOpen, setVisitorOpen] = useState(false);
  const visitorOpenRef = useRef(false);
  visitorOpenRef.current = visitorOpen;
  const [visitorForm, setVisitorForm] = useState({
    fullName: '',
    mobile: '',
    institution: '',
    purpose: 'Library Study',
    visitorType: 'Guest' as (typeof VISITOR_TYPES)[number],
  });

  const dashboard = useQuery({
    queryKey: ['library', 'access-desk', 'dashboard'],
    queryFn: fetchLibraryAccessDeskDashboard,
    enabled,
    refetchInterval: 15_000,
    retry: 2,
  });

  const d = dashboard.data;
  const dashboardError =
    dashboard.isError && !dashboard.isLoading ? apiErrorMessage(dashboard.error) : null;

  useLibraryRealtime({
    onOccupancy: () => {
      void qc.invalidateQueries({ queryKey: ['library', 'access-desk', 'dashboard'] });
    },
    onScanResult: (result) => {
      setLastScan(result);
      setDisplayPhase(result.action === 'ENTRY' ? 'entry' : 'exit');
      void qc.invalidateQueries({ queryKey: ['library', 'access-desk', 'dashboard'] });
    },
  });

  const clearScanInput = useCallback(() => {
    setScanInput('');
    scanKeyTimesRef.current = [];
    if (scanAutoTimerRef.current) window.clearTimeout(scanAutoTimerRef.current);
  }, []);

  const clearResultTimer = useCallback(() => {
    if (scanResetTimerRef.current) {
      window.clearTimeout(scanResetTimerRef.current);
      scanResetTimerRef.current = undefined;
    }
  }, []);

  const scheduleReturnToIdle = useCallback(
    (ms: number) => {
      clearResultTimer();
      scanResetTimerRef.current = window.setTimeout(() => {
        setDisplayPhase('idle');
        scanResetTimerRef.current = undefined;
      }, ms);
    },
    [clearResultTimer],
  );

  const scanMut = useMutation({
    mutationFn: (code: string) => scanLibraryAccess(code),
    onSuccess: (result) => {
      setLastScan(result);
      setDisplayPhase(result.action === 'ENTRY' ? 'entry' : 'exit');
      playBeep(true);
      clearScanInput();
      setError('');
      void qc.invalidateQueries({ queryKey: ['library', 'access-desk', 'dashboard'] });
      scheduleReturnToIdle(SUCCESS_DISPLAY_MS);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    },
    onError: (err) => {
      playBeep(false);
      const msg = apiErrorMessage(err);
      setError(msg);
      const lower = msg.toLowerCase();
      setDisplayPhase(
        lower.includes('restricted') || lower.includes('inactive') || lower.includes('suspended')
          ? 'blocked'
          : 'not-found',
      );
      scheduleReturnToIdle(ERROR_DISPLAY_MS);
      setTimeout(() => setError(''), ERROR_DISPLAY_MS);
      inputRef.current?.focus();
    },
  });

  const visitorMut = useMutation({
    mutationFn: () =>
      registerLibraryVisitor({
        fullName: visitorForm.fullName,
        mobile: visitorForm.mobile || undefined,
        institution: visitorForm.institution || visitorForm.visitorType,
        purpose: `${visitorForm.visitorType} — ${visitorForm.purpose}`,
      }),
    onSuccess: (v) => {
      setVisitorOpen(false);
      setVisitorForm({
        fullName: '',
        mobile: '',
        institution: '',
        purpose: 'Library Study',
        visitorType: 'Guest',
      });
      scanMut.mutate(v.passNumber);
    },
  });

  const focusScanner = useCallback(() => {
    if (visitorOpenRef.current) return;
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    focusScanner();
    const id = window.setInterval(focusScanner, 500);
    const onVis = () => {
      if (document.visibilityState === 'visible') focusScanner();
    };
    const onFocusIn = (e: FocusEvent) => {
      if (visitorOpenRef.current) return;
      const target = e.target as HTMLElement | null;
      if (!target || target === inputRef.current) return;
      if (target.closest('[data-kiosk-modal], button, a')) return;
      window.setTimeout(() => inputRef.current?.focus(), 0);
    };
    document.addEventListener('visibilitychange', onVis);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [focusScanner]);

  useEffect(() => {
    if (!visitorOpen) focusScanner();
  }, [visitorOpen, focusScanner]);

  const submitScan = useCallback(
    (raw: string) => {
      const code = raw.trim();
      if (!code || scanMut.isPending) return;
      if (!session?.accessToken) {
        setError('Session expired — please log in again.');
        return;
      }
      if (scanAutoTimerRef.current) window.clearTimeout(scanAutoTimerRef.current);
      scanKeyTimesRef.current = [];
      clearResultTimer();
      setDisplayPhase('verifying');
      scanMut.mutate(code);
    },
    [scanMut, session?.accessToken, clearResultTimer],
  );

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen();
    } else {
      void document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const commitScanFromInput = useCallback(
    (raw?: string) => {
      const code = (raw ?? inputRef.current?.value ?? scanInput).trim();
      if (!code) return;
      clearScanInput();
      submitScan(code);
    },
    [clearScanInput, scanInput, submitScan],
  );

  const handleScanInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setScanInput(next);
      if (next.length > 0 && !scanMut.isPending) {
        if (displayPhase === 'entry' || displayPhase === 'exit') {
          clearResultTimer();
        }
        if (displayPhase === 'idle' || displayPhase === 'entry' || displayPhase === 'exit') {
          setDisplayPhase('detecting');
        }
      }
      if (next.length === 0 && !scanMut.isPending && displayPhase === 'detecting') {
        setDisplayPhase('idle');
      }

      const now = Date.now();
      const times = scanKeyTimesRef.current;
      times.push(now);
      if (times.length > 24) times.shift();

      if (scanAutoTimerRef.current) window.clearTimeout(scanAutoTimerRef.current);

      const bulkInput = next.length >= MIN_AUTO_SCAN_LENGTH && times.length === 1;
      if (bulkInput || isFastScannerInput(times, next.length)) {
        scanAutoTimerRef.current = window.setTimeout(() => {
          commitScanFromInput(inputRef.current?.value ?? next);
        }, SCAN_AUTO_SUBMIT_MS);
      }
    },
    [commitScanFromInput, clearResultTimer, displayPhase, scanMut.isPending],
  );

  const scannerPhase: ScannerPhase = scanMut.isPending ? 'verifying' : displayPhase;

  const handleScanKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        commitScanFromInput(e.currentTarget.value);
      }
    },
    [commitScanFromInput],
  );

  useEffect(
    () => () => {
      if (scanAutoTimerRef.current) window.clearTimeout(scanAutoTimerRef.current);
      if (scanResetTimerRef.current) window.clearTimeout(scanResetTimerRef.current);
    },
    [],
  );

  const stats = d?.stats;
  const occ = d?.occupancy;
  const librarianName = session?.user?.email?.split('@')[0] ?? 'Librarian';

  const handleLogout = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
    }
    logoutClientSide({ replace: (href) => window.location.assign(href) });
  };

  return (
    <div
      className={cn(
        'flex min-h-screen bg-slate-50 text-slate-900',
        fullscreen && 'kiosk-fullscreen',
      )}
      onMouseDown={(e) => {
        if (visitorOpenRef.current) return;
        const target = e.target as HTMLElement;
        if (target.closest('[data-kiosk-modal]')) return;
        if (target.closest('a, button')) return;
        if (target === inputRef.current) return;
        e.preventDefault();
        focusScanner();
      }}
    >
      {/* Sidebar — hidden in kiosk fullscreen for max scan area */}
      <aside
        className={cn(
          'hidden w-56 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex',
          fullscreen && 'lg:hidden',
        )}
      >
        <div className="border-b border-slate-200 p-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-sky-700" />
            <span className="text-sm font-bold text-slate-900">Library I/O</span>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {SIDEBAR.map(({ icon: Icon, label, active, href }) =>
            href ? (
              <Link
                key={label}
                href={href}
                target={href.startsWith('/admin') ? '_blank' : undefined}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ) : (
              <button
                key={label}
                type="button"
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm',
                  active
                    ? 'bg-sky-50 font-semibold text-sky-800'
                    : 'text-slate-600 hover:bg-slate-50',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ),
          )}
        </nav>
        <div className="border-t border-slate-200 p-2">
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 transition-colors hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
        <div className="border-t border-slate-200 p-4 text-xs text-slate-500">
          <p className="font-medium text-slate-700">Auto sign-out</p>
          <p className="mt-1">Open visits close after 1 hour.</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top header */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            {branding.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logo} alt="" className="h-10 w-10 rounded-full object-contain" />
            ) : null}
            <div>
              <p className="text-xs font-semibold text-slate-500">{branding.displayName}</p>
              <h1
                className={cn(
                  'font-bold tracking-tight text-slate-950',
                  fullscreen ? 'text-2xl' : 'text-lg',
                )}
              >
                Library In-Out Management System
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
              <Wifi className="h-3.5 w-3.5" />
              System Online
            </span>
            <div className="text-right">
              <p className="font-mono text-lg font-semibold tabular-nums">
                {now ? now.toLocaleTimeString('en-IN', { hour12: true }) : '--:--:-- --'}
              </p>
              <p className="text-[11px] text-slate-500">
                {now
                  ? now.toLocaleDateString('en-IN', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : 'Loading…'}
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-800">
                {librarianName.slice(0, 2).toUpperCase()}
              </div>
              <div className="text-xs">
                <p className="font-medium capitalize">{librarianName}</p>
                <p className="text-slate-500">Librarian</p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0 border-slate-200 bg-white text-slate-700 hover:bg-red-50 hover:text-red-700"
              onClick={() => void handleLogout()}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
            <Button
              type="button"
              size="sm"
              className={cn(
                'shrink-0 border-0 bg-sky-700 px-4 font-semibold text-white hover:bg-sky-800',
              )}
              onClick={toggleFullscreen}
            >
              {fullscreen ? (
                <>
                  <Minimize2 className="mr-2 h-4 w-4" />
                  Exit Fullscreen
                </>
              ) : (
                <>
                  <Maximize2 className="mr-2 h-4 w-4" />
                  Kiosk Mode
                </>
              )}
            </Button>
          </div>
        </header>

        {dashboardError ? (
          <div className="mx-4 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
            <span>Dashboard stats unavailable: {dashboardError}</span>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-300 text-amber-900"
              onClick={() => void dashboard.refetch()}
            >
              Retry
            </Button>
          </div>
        ) : null}

        <div className="flex flex-1 flex-col gap-4 overflow-auto p-4 xl:flex-row">
          <div className={cn('min-w-0 flex-1 space-y-4', fullscreen && 'xl:max-w-none')}>
            {/* KPI row — compact in kiosk mode */}
            {!fullscreen ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                <KpiCard
                  label="Entries today (in)"
                  value={stats?.entriesToday ?? '—'}
                  sub={changeLabel(stats?.entriesChange)}
                  icon={LogIn}
                  tone="bg-sky-50 text-sky-700"
                />
                <KpiCard
                  label="Exits today (out)"
                  value={stats?.exitsToday ?? '—'}
                  sub={changeLabel(stats?.exitsChange)}
                  icon={LogOut}
                  tone="bg-rose-50 text-rose-600"
                />
                <KpiCard
                  label="Currently inside"
                  value={stats?.currentlyInside ?? '—'}
                  sub="Signed out after 1 hour"
                  icon={Users}
                  tone="bg-emerald-50 text-emerald-700"
                />
                <KpiCard
                  label="Visitors today"
                  value={stats?.visitorsToday ?? '—'}
                  sub="Total footfall"
                  icon={UserPlus}
                  tone="bg-violet-50 text-violet-700"
                />
                <KpiCard
                  label="Avg. stay time"
                  value={stats ? formatStay(stats.avgStayMinutes) : '—'}
                  icon={Clock}
                  tone="bg-sky-50 text-sky-700"
                />
                <KpiCard
                  label="Scans today"
                  value={stats?.scansToday ?? '—'}
                  icon={ScanLine}
                  tone="bg-indigo-50 text-indigo-700"
                />
              </div>
            ) : null}

            <LibraryScannerStage
              phase={scannerPhase}
              lastScan={lastScan}
              errorMessage={error}
              scanInput={scanInput}
              inputRef={inputRef}
              isPending={scanMut.isPending}
              resultDisplayMs={SUCCESS_DISPLAY_MS}
              onChange={handleScanInputChange}
              onKeyDown={handleScanKeyDown}
              onSubmit={() => commitScanFromInput()}
              onBlurRefocus={() => {
                if (!visitorOpenRef.current) {
                  window.setTimeout(() => inputRef.current?.focus(), 0);
                }
              }}
            />

            {occ ? (
              <HourlyFootfallChart entries={occ.hourlyFootfall} exits={occ.hourlyExits ?? []} />
            ) : null}
          </div>

          <aside className={cn('w-full shrink-0 space-y-4 xl:w-80', fullscreen && 'xl:w-72')}>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Quick actions</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  className="h-auto flex-col gap-1 border-0 bg-sky-600 py-3 text-[11px] font-semibold text-white hover:bg-sky-700"
                  onClick={() => setVisitorOpen(true)}
                >
                  <UserPlus className="h-5 w-5" />
                  Visitor Pass
                </Button>
                <Button
                  type="button"
                  className="h-auto flex-col gap-1 border border-slate-200 bg-white py-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => focusScanner()}
                >
                  <ScanLine className="h-5 w-5" />
                  Focus Scan
                </Button>
              </div>
            </div>
            <LibraryDeskSidePanel data={d} />
          </aside>
        </div>
      </div>

      {visitorOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          data-kiosk-modal
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-xl">
            <div className="bg-sky-700 px-6 py-4 text-white">
              <h2 className="text-lg font-semibold">Register visitor pass</h2>
              <p className="text-xs text-sky-100">
                Parent · Guest · Alumni · Vendor · External faculty
              </p>
            </div>
            <div className="space-y-3 p-6">
              <label className="block text-xs text-slate-500">
                Visitor type
                <select
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  value={visitorForm.visitorType}
                  onChange={(e) =>
                    setVisitorForm({
                      ...visitorForm,
                      visitorType: e.target.value as (typeof VISITOR_TYPES)[number],
                    })
                  }
                >
                  {VISITOR_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                className="border-slate-200 bg-white"
                placeholder="Full name"
                value={visitorForm.fullName}
                onChange={(e) => setVisitorForm({ ...visitorForm, fullName: e.target.value })}
              />
              <Input
                className="border-slate-200 bg-white"
                placeholder="Mobile"
                value={visitorForm.mobile}
                onChange={(e) => setVisitorForm({ ...visitorForm, mobile: e.target.value })}
              />
              <Input
                className="border-slate-200 bg-white"
                placeholder="Organization (optional)"
                value={visitorForm.institution}
                onChange={(e) => setVisitorForm({ ...visitorForm, institution: e.target.value })}
              />
              <Input
                className="border-slate-200 bg-white"
                placeholder="Purpose of visit"
                value={visitorForm.purpose}
                onChange={(e) => setVisitorForm({ ...visitorForm, purpose: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
              <Button
                variant="ghost"
                className="text-slate-600"
                onClick={() => setVisitorOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-sky-700 font-semibold hover:bg-sky-800"
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
