'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useMemo, type RefObject } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, ScanLine, ShieldAlert, UserX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import type { ScanResult } from '@/types/library';
import { cn } from '@/utils/cn';

export type ScannerPhase =
  | 'idle'
  | 'detecting'
  | 'verifying'
  | 'entry'
  | 'exit'
  | 'too-soon'
  | 'duplicate'
  | 'not-found'
  | 'blocked';

type Props = {
  phase: ScannerPhase;
  lastScan: ScanResult | null;
  errorMessage?: string;
  scanInput: string;
  inputRef: RefObject<HTMLInputElement | null>;
  isPending: boolean;
  /** Duration of success screen — used for auto-dismiss progress bar */
  resultDisplayMs?: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
  onBlurRefocus: () => void;
};

const PHASE_COPY: Record<
  ScannerPhase,
  { title: string; sub: string; accent: string; border: string; bg: string }
> = {
  idle: {
    title: 'Ready to Scan Student ID Card',
    sub: 'Show your ID card to enter or exit the library',
    accent: 'text-slate-900',
    border: 'border-sky-100',
    bg: 'from-white via-sky-50/60 to-white',
  },
  detecting: {
    title: 'Card Detected',
    sub: 'Reading barcode — hold steady…',
    accent: 'text-sky-800',
    border: 'border-sky-200',
    bg: 'from-sky-50 to-white',
  },
  verifying: {
    title: 'Verifying Student Information',
    sub: 'Checking membership and entry rules',
    accent: 'text-violet-800',
    border: 'border-violet-200',
    bg: 'from-violet-50 to-white',
  },
  entry: {
    title: 'ENTRY ALLOWED',
    sub: 'Welcome to Don Bosco Library.',
    accent: 'text-emerald-800',
    border: 'border-emerald-200',
    bg: 'from-emerald-50 to-white',
  },
  exit: {
    title: 'EXIT RECORDED',
    sub: 'Thank you for visiting Don Bosco Library. Visit again!',
    accent: 'text-sky-800',
    border: 'border-sky-200',
    bg: 'from-sky-50 to-white',
  },
  'too-soon': {
    title: 'PLEASE WAIT',
    sub: 'You have just entered the library. Please wait at least 1 minute before exiting.',
    accent: 'text-orange-800',
    border: 'border-orange-200',
    bg: 'from-orange-50 to-white',
  },
  duplicate: {
    title: 'Ready to Scan Student ID Card',
    sub: 'Duplicate scan detected. Please wait.',
    accent: 'text-amber-800',
    border: 'border-amber-200',
    bg: 'from-amber-50 to-white',
  },
  'not-found': {
    title: 'Student Not Found',
    sub: 'Invalid barcode · not registered · card not assigned',
    accent: 'text-red-800',
    border: 'border-red-200',
    bg: 'from-red-50 to-white',
  },
  blocked: {
    title: 'Access Restricted',
    sub: 'Membership suspended · fines · disciplinary hold',
    accent: 'text-orange-800',
    border: 'border-orange-200',
    bg: 'from-orange-50 to-white',
  },
};

function formatDuration(minutes?: number | null) {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} Minutes`;
  return `${h} Hour${h > 1 ? 's' : ''} ${m} Minutes`;
}

function ScannerParticles() {
  const dots = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        left: `${(i * 17 + 5) % 100}%`,
        top: `${(i * 23 + 11) % 100}%`,
        delay: (i % 6) * 0.4,
        size: 2 + (i % 3),
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {dots.map((d) => (
        <motion.span
          key={d.id}
          className="absolute rounded-full bg-sky-300/50"
          style={{ left: d.left, top: d.top, width: d.size, height: d.size }}
          animate={{ opacity: [0.15, 0.7, 0.15], y: [0, -8, 0] }}
          transition={{ duration: 3 + (d.id % 4), repeat: Infinity, delay: d.delay }}
        />
      ))}
    </div>
  );
}

function CornerBracket({ className }: { className: string }) {
  return (
    <motion.span
      className={cn('absolute h-8 w-8 border-sky-400', className)}
      animate={{ opacity: [0.35, 1, 0.35] }}
      transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

function MemberPhotoLarge({ name, photoUrl }: { name: string; photoUrl?: string | null }) {
  const src = resolveUploadAssetUrl(photoUrl);
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className="h-40 w-32 rounded-xl border-2 border-slate-200 object-cover shadow-sm"
      />
    );
  }
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('');
  return (
    <div className="flex h-40 w-32 items-center justify-center rounded-xl border-2 border-slate-200 bg-slate-100 text-2xl font-bold text-slate-600">
      {initials || '?'}
    </div>
  );
}

function VerifyChip({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-md border px-2 py-1.5 text-center',
        warn ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white',
      )}
    >
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={cn('text-xs font-semibold', warn ? 'text-amber-800' : 'text-slate-900')}>
        {value}
      </p>
    </div>
  );
}

function LibrarianVerifyStrip({ scan, displayMs }: { scan: ScanResult; displayMs: number }) {
  const ctx = scan.deskContext;
  const fineAmount = ctx?.unpaidFines ?? 0;
  const loans = ctx?.activeLoans ?? 0;
  const attendance = ctx?.attendancePercent;
  const feeStatus = ctx?.feeStatus ?? '—';
  const feeWarn = feeStatus === 'DUE' || feeStatus === 'OVERDUE' || feeStatus === 'PARTIAL';
  const attendanceWarn = attendance != null && attendance < 75;

  return (
    <div className="relative mt-4 w-full overflow-hidden rounded-lg border border-sky-100 bg-sky-50">
      <motion.div
        className="absolute inset-y-0 left-0 bg-sky-200/40"
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: displayMs / 1000, ease: 'linear' }}
      />
      <div className="relative px-3 py-2">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-sky-800">
          Librarian verify · auto-ready for next scan
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          <VerifyChip
            label="Membership"
            value={ctx?.membershipStatus ?? 'Active'}
            warn={ctx?.membershipStatus?.toLowerCase() === 'inactive'}
          />
          <VerifyChip
            label="Attendance"
            value={attendance != null ? `${attendance}%` : '—'}
            warn={attendanceWarn}
          />
          <VerifyChip label="Fee status" value={feeStatus} warn={feeWarn} />
          <VerifyChip label="Active loans" value={String(loans)} warn={loans > 0} />
          <VerifyChip
            label="Lib. fines"
            value={fineAmount > 0 ? `₹${fineAmount.toFixed(0)}` : 'None'}
            warn={fineAmount > 0}
          />
          <VerifyChip label="ABC ID" value={ctx?.abcId ?? '—'} />
          <VerifyChip label="RFID" value={ctx?.rfidNumber ?? '—'} />
          <VerifyChip label="Mobile" value={ctx?.mobile ?? '—'} />
        </div>
      </div>
    </div>
  );
}

export function LibraryScannerStage({
  phase,
  lastScan,
  errorMessage,
  scanInput,
  inputRef,
  isPending,
  resultDisplayMs = 3500,
  onChange,
  onKeyDown,
  onSubmit,
  onBlurRefocus,
}: Props) {
  const copy = PHASE_COPY[phase];
  const showResult = (phase === 'entry' || phase === 'exit' || phase === 'too-soon') && lastScan;
  const isActiveScan = phase === 'detecting' || phase === 'verifying';
  const isError = phase === 'not-found' || phase === 'blocked';

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-3xl border bg-gradient-to-br p-6 shadow-sm transition-all duration-500',
        copy.border,
        copy.bg,
        isError && 'animate-pulse',
      )}
    >
      <ScannerParticles />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.08),transparent_60%)]" />

      <CornerBracket className="left-3 top-3 border-l-2 border-t-2" />
      <CornerBracket className="right-3 top-3 border-r-2 border-t-2" />
      <CornerBracket className="bottom-3 left-3 border-b-2 border-l-2" />
      <CornerBracket className="bottom-3 right-3 border-b-2 border-r-2" />

      <h2
        className={cn(
          'relative text-center text-xs font-bold uppercase tracking-[0.2em]',
          copy.accent,
        )}
      >
        Smart Library Access · BCL OneCampus
      </h2>

      <AnimatePresence mode="wait">
        {showResult ? (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="relative mt-6 flex flex-col items-center gap-4 lg:flex-row lg:items-start"
          >
            <MemberPhotoLarge
              name={lastScan.profile.fullName}
              photoUrl={lastScan.profile.photoUrl}
            />
            <div className="min-w-0 flex-1 text-center lg:text-left">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={cn(
                  'mb-3 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold',
                  phase === 'entry'
                    ? 'bg-emerald-500 text-white'
                    : phase === 'exit'
                      ? 'bg-sky-600 text-white'
                      : 'bg-orange-500 text-white',
                )}
              >
                <CheckCircle2 className="h-4 w-4" />
                {copy.title}
              </motion.div>
              <p className="text-2xl font-bold uppercase tracking-wide">
                {lastScan.profile.fullName}
              </p>
              <p className="text-sm text-slate-500">{lastScan.profile.registrationNumber}</p>
              <p
                className={cn(
                  'mt-2 text-sm font-medium',
                  phase === 'entry' && 'text-emerald-800',
                  phase === 'exit' && 'text-sky-800',
                  phase === 'too-soon' && 'text-orange-800',
                )}
              >
                {phase === 'too-soon' ? lastScan.message || copy.sub : copy.sub}
              </p>
              <dl className="mt-4 grid gap-1 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Programme</dt>
                  <dd>{lastScan.profile.programme ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Department</dt>
                  <dd>{lastScan.profile.department ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Semester</dt>
                  <dd>{lastScan.profile.semester ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Mobile</dt>
                  <dd>{lastScan.deskContext?.mobile ?? '—'}</dd>
                </div>
                {phase === 'entry' ? (
                  <div className="sm:col-span-2">
                    <dt className="text-slate-500">Entry Time</dt>
                    <dd className="font-mono text-emerald-700">
                      {new Date(lastScan.visit.entryAt).toLocaleTimeString('en-IN', {
                        hour12: true,
                      })}
                    </dd>
                  </div>
                ) : phase === 'too-soon' ? (
                  <div className="sm:col-span-2">
                    <dt className="text-slate-500">Wait remaining</dt>
                    <dd className="font-semibold text-orange-800">
                      {lastScan.remainingSeconds ?? 60} seconds
                    </dd>
                  </div>
                ) : (
                  <>
                    <div>
                      <dt className="text-slate-500">Entry Time</dt>
                      <dd className="font-mono">
                        {new Date(lastScan.visit.entryAt).toLocaleTimeString('en-IN', {
                          hour12: true,
                        })}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Exit Time</dt>
                      <dd className="font-mono text-sky-700">
                        {lastScan.visit.exitAt
                          ? new Date(lastScan.visit.exitAt).toLocaleTimeString('en-IN', {
                              hour12: true,
                            })
                          : '—'}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-slate-500">Duration</dt>
                      <dd className="font-semibold text-sky-800">
                        {formatDuration(lastScan.visit.durationMinutes)}
                      </dd>
                    </div>
                  </>
                )}
              </dl>
              {phase === 'too-soon' ? null : (
                <LibrarianVerifyStrip scan={lastScan} displayMs={resultDisplayMs} />
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={phase}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative mt-6 flex flex-col items-center py-2"
          >
            <div className="relative mb-5 flex h-36 w-56 items-center justify-center">
              {isActiveScan ? (
                <motion.div
                  className="absolute inset-0 rounded-2xl border border-violet-400/40"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                  style={{
                    background:
                      'conic-gradient(from 0deg, transparent, rgba(139,92,246,0.35), transparent)',
                  }}
                />
              ) : null}
              <motion.div
                animate={
                  phase === 'idle'
                    ? { scale: [1, 1.05, 1], opacity: [0.7, 1, 0.7] }
                    : { scale: 1, opacity: 1 }
                }
                transition={{ duration: 2.5, repeat: phase === 'idle' ? Infinity : 0 }}
              >
                {phase === 'verifying' ? (
                  <Loader2 className="h-20 w-20 animate-spin text-violet-400" />
                ) : isError ? (
                  phase === 'blocked' ? (
                    <ShieldAlert className="h-20 w-20 text-orange-400" />
                  ) : (
                    <UserX className="h-20 w-20 text-red-400" />
                  )
                ) : (
                  <ScanLine className="h-20 w-20 text-sky-600" />
                )}
              </motion.div>
              {(phase === 'detecting' || phase === 'verifying' || phase === 'idle') && (
                <motion.div
                  className="absolute inset-x-4 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_12px_red]"
                  animate={{ top: ['20%', '80%', '20%'] }}
                  transition={{
                    duration: phase === 'idle' ? 2.8 : 1.1,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
              )}
            </div>

            <p className={cn('text-xl font-semibold', copy.accent)}>{copy.title}</p>
            <p className="mt-1 max-w-md text-center text-sm text-slate-400">{copy.sub}</p>

            {phase === 'duplicate' ? (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900">
                Duplicate scan detected. Please wait.
              </p>
            ) : null}
            {errorMessage && isError ? (
              <p className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {errorMessage}
              </p>
            ) : null}

            {phase === 'verifying' ? (
              <div className="mt-4 flex gap-2 text-xs text-violet-300/80">
                {['Student exists', 'Active status', 'Membership', 'Entry/Exit'].map((step, i) => (
                  <motion.span
                    key={step}
                    initial={{ opacity: 0.3 }}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                    className="rounded-full border border-violet-500/30 px-2 py-0.5"
                  >
                    {step}
                  </motion.span>
                ))}
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      <form
        className="relative mt-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <Input
          ref={inputRef}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          name="scanCode"
          className="h-12 border-slate-200 bg-white text-lg text-slate-900 ring-sky-200 placeholder:text-slate-400 focus-visible:ring-sky-400"
          placeholder="Scanner auto-capture · manual type + Enter"
          value={scanInput}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onBlur={onBlurRefocus}
        />
        <Button
          type="submit"
          className="h-12 shrink-0 bg-sky-600 px-6 hover:bg-sky-700"
          disabled={!scanInput.trim() || isPending}
        >
          {isPending ? '…' : 'Scan'}
        </Button>
      </form>
    </div>
  );
}
