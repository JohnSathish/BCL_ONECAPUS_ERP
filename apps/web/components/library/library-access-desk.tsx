'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { useAuth } from '@/hooks/use-auth';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useLibraryRealtime } from '@/hooks/use-library-realtime';
import { broadcastSessionMessage } from '@/lib/auth/session-broadcast';
import { tokenRefreshManager } from '@/lib/auth/token-refresh-manager';
import { logout } from '@/services/auth';
import {
  fetchLibraryAccessDeskDashboard,
  registerLibraryVisitor,
  scanLibraryAccess,
} from '@/services/library';
import type { ScanResult } from '@/types/library';
import { useAuthStore } from '@/store/auth-store';
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

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  glow,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: typeof Users;
  glow?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-white/10 bg-slate-900/80 p-4 shadow-lg backdrop-blur',
        glow,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-white">{value}</p>
          {sub ? <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p> : null}
        </div>
        <div className="rounded-lg bg-white/5 p-2">
          <Icon className="h-5 w-5 text-cyan-400" />
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
  data,
  totalScans,
}: {
  data: { hour: number; count: number }[];
  totalScans: number;
}) {
  const slice = data.slice(8, 19);
  const max = Math.max(1, ...slice.map((d) => d.count));
  const peak = slice.reduce((best, d) => (d.count > best.count ? d : best), slice[0]!);

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Hourly Footfall Today</h3>
        <span className="text-xs text-slate-400">{totalScans} scans</span>
      </div>
      <div className="flex h-28 items-end gap-1">
        {slice.map((b) => (
          <div key={b.hour} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-gradient-to-t from-cyan-600 to-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.35)]"
              style={{ height: `${Math.max(6, (b.count / max) * 100)}%` }}
              title={`${b.hour}:00 — ${b.count}`}
            />
            <span className="text-[9px] text-slate-500">{b.hour}</span>
          </div>
        ))}
      </div>
      {peak ? (
        <p className="mt-2 text-xs text-cyan-300/80">
          Peak: {peak.hour}:00–{peak.hour + 1}:00 ({peak.count} entries)
        </p>
      ) : null}
    </div>
  );
}

const SIDEBAR = [
  { icon: LayoutDashboard, label: 'Dashboard', active: true },
  { icon: ScanLine, label: 'Live Entry/Exit' },
  { icon: Users, label: 'Visitors Log', href: '/admin/library/visits' },
  { icon: User, label: 'Students Inside' },
  { icon: BookOpen, label: 'Reports', href: '/admin/library/analytics' },
  { icon: Bell, label: 'Alerts' },
  { icon: Settings, label: 'Settings', href: '/admin/library/settings' },
];

export function LibraryAccessDesk() {
  const qc = useQueryClient();
  const router = useRouter();
  const enabled = useAuthQueryEnabled();
  const { session } = useAuth();
  const now = useLiveClock();
  const inputRef = useRef<HTMLInputElement>(null);
  const scanKeyTimesRef = useRef<number[]>([]);
  const scanAutoTimerRef = useRef<number>();
  const scanResetTimerRef = useRef<number>();
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
    broadcastSessionMessage({ type: 'LOGOUT' });
    tokenRefreshManager.clearSchedule();
    useAuthStore.getState().clear();
    try {
      await logout();
    } catch {
      /* ignore */
    }
    router.replace('/library-desk/login');
  };

  return (
    <div
      className={cn('flex min-h-screen bg-[#0a0f1e] text-white', fullscreen && 'kiosk-fullscreen')}
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
          'hidden w-56 shrink-0 flex-col border-r border-white/10 bg-[#070b14] lg:flex',
          fullscreen && 'lg:hidden',
        )}
      >
        <div className="border-b border-white/10 p-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-cyan-400" />
            <span className="text-sm font-bold">Library I/O</span>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {SIDEBAR.map(({ icon: Icon, label, active, href }) =>
            href ? (
              <Link
                key={label}
                href={href}
                target="_blank"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white"
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
                    ? 'bg-cyan-500/15 text-cyan-300'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ),
          )}
        </nav>
        <div className="border-t border-white/10 p-2">
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
        <div className="border-t border-white/10 p-4 text-xs text-slate-500">
          <p>Library Hours</p>
          <p className="mt-1 font-medium text-slate-300">8:00 AM – 6:00 PM</p>
          <span className="mt-2 inline-block rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
            OPEN
          </span>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top header */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0d1324]/90 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-xs text-slate-400">Don Bosco College Tura</p>
            <h1 className={cn('font-bold tracking-tight', fullscreen ? 'text-2xl' : 'text-lg')}>
              Library In-Out Management System
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <Wifi className="h-3.5 w-3.5" />
              System Online
            </span>
            <div className="text-right">
              <p className="font-mono text-lg font-semibold tabular-nums">
                {now ? now.toLocaleTimeString('en-IN', { hour12: true }) : '--:--:-- --'}
              </p>
              <p className="text-[11px] text-slate-400">
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
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-bold text-cyan-300">
                {librarianName.slice(0, 2).toUpperCase()}
              </div>
              <div className="text-xs">
                <p className="font-medium capitalize">{librarianName}</p>
                <p className="text-slate-500">Gate Operator</p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0 border-white/15 bg-white/5 text-slate-200 hover:bg-red-500/10 hover:text-red-200"
              onClick={() => void handleLogout()}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
            <Button
              type="button"
              size="sm"
              className={cn(
                'shrink-0 border-0 bg-gradient-to-r from-cyan-500 to-violet-600 px-4 font-semibold text-white shadow-lg shadow-cyan-500/25 transition hover:from-cyan-400 hover:to-violet-500 hover:shadow-cyan-400/40',
                fullscreen && 'from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400',
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
          <div className="mx-4 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
            <span>Dashboard stats unavailable: {dashboardError}</span>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-400/40 text-amber-100"
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
                  label="Entries Today (IN)"
                  value={stats?.entriesToday ?? '—'}
                  icon={LogIn}
                  glow="shadow-cyan-500/5"
                />
                <KpiCard label="Exits Today (OUT)" value={stats?.exitsToday ?? '—'} icon={LogOut} />
                <KpiCard
                  label="Currently Inside"
                  value={stats?.currentlyInside ?? '—'}
                  sub="Live in library"
                  icon={Users}
                  glow="shadow-emerald-500/10"
                />
                <KpiCard
                  label="Visitors Today"
                  value={stats?.visitorsToday ?? '—'}
                  sub="Total footfall"
                  icon={UserPlus}
                />
                <KpiCard
                  label="Avg. Stay Time"
                  value={stats ? formatStay(stats.avgStayMinutes) : '—'}
                  icon={Clock}
                />
                <KpiCard label="Scans Today" value={stats?.scansToday ?? '—'} icon={ScanLine} />
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
              <HourlyFootfallChart data={occ.hourlyFootfall} totalScans={stats?.scansToday ?? 0} />
            ) : null}
          </div>

          <aside className={cn('w-full shrink-0 space-y-4 xl:w-80', fullscreen && 'xl:w-72')}>
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
              <h3 className="mb-3 text-sm font-semibold">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  className="h-auto flex-col gap-1 border-0 bg-gradient-to-br from-cyan-600/80 to-cyan-800 py-3 text-[10px] font-medium text-white shadow-md hover:from-cyan-500 hover:to-cyan-700"
                  onClick={() => setVisitorOpen(true)}
                >
                  <UserPlus className="h-5 w-5" />
                  Visitor Pass
                </Button>
                <Button
                  type="button"
                  className="h-auto flex-col gap-1 border border-cyan-500/30 bg-cyan-950/40 py-3 text-[10px] font-medium text-cyan-100 hover:bg-cyan-900/50"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          data-kiosk-modal
        >
          <div className="w-full max-w-md overflow-hidden rounded-xl border border-cyan-500/30 bg-slate-900 text-white shadow-2xl shadow-cyan-500/10">
            <div className="bg-gradient-to-r from-cyan-600 to-violet-700 px-6 py-4">
              <h2 className="text-lg font-semibold">Register Visitor Pass</h2>
              <p className="text-xs text-cyan-100/80">
                Parent · Guest · Alumni · Vendor · External faculty
              </p>
            </div>
            <div className="space-y-3 p-6">
              <label className="block text-xs text-slate-400">
                Visitor Type
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white"
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
                className="border-white/10 bg-slate-800"
                placeholder="Full name"
                value={visitorForm.fullName}
                onChange={(e) => setVisitorForm({ ...visitorForm, fullName: e.target.value })}
              />
              <Input
                className="border-white/10 bg-slate-800"
                placeholder="Mobile"
                value={visitorForm.mobile}
                onChange={(e) => setVisitorForm({ ...visitorForm, mobile: e.target.value })}
              />
              <Input
                className="border-white/10 bg-slate-800"
                placeholder="Organization (optional)"
                value={visitorForm.institution}
                onChange={(e) => setVisitorForm({ ...visitorForm, institution: e.target.value })}
              />
              <Input
                className="border-white/10 bg-slate-800"
                placeholder="Purpose of visit"
                value={visitorForm.purpose}
                onChange={(e) => setVisitorForm({ ...visitorForm, purpose: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-white/10 bg-slate-950/50 px-6 py-4">
              <Button
                variant="ghost"
                className="text-slate-300 hover:text-white"
                onClick={() => setVisitorOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-gradient-to-r from-cyan-500 to-violet-600 font-semibold hover:from-cyan-400 hover:to-violet-500"
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
