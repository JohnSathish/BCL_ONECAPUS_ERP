'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Loader2,
  ScanLine,
  Search,
  User,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchStaffCommand, fetchStudentCommand } from '@/services/principal-desk';
import { StaffCommandCardView } from '@/components/principal-desk/staff-command-card';
import { StudentCommandCardView } from '@/components/principal-desk/student-command-card';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import type { StudentCommandCard } from '@/types/principal-desk';
import { money } from '@/components/dashboard/command-center-ui';

const SCAN_AUTO_MS = 120;
const SCAN_GAP_MS = 80;
const MIN_AUTO_LEN = 3;

type ScanMode = 'student' | 'staff' | 'search';

function isFastScan(keyTimes: number[], len: number) {
  if (len < MIN_AUTO_LEN || keyTimes.length < 3) return false;
  const gaps = keyTimes.slice(1).map((t, i) => t - keyTimes[i]!);
  const recent = gaps.slice(-Math.min(gaps.length, len - 1));
  return recent.length >= 2 && recent.every((g) => g < SCAN_GAP_MS);
}

function CompactStudentResult({
  data,
  onClose,
  onExpand,
}: {
  data: StudentCommandCard;
  onClose: () => void;
  onExpand: () => void;
}) {
  const att = data.attendance.percentage;
  const attTone =
    data.attendance.band === 'red'
      ? 'text-rose-400'
      : data.attendance.band === 'orange'
        ? 'text-amber-400'
        : 'text-emerald-400';

  return (
    <motion.div
      initial={{ x: 80, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 80, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      className="overflow-hidden rounded-2xl border border-indigo-400/30 bg-gradient-to-br from-slate-900/95 to-indigo-950/95 p-5 shadow-2xl shadow-indigo-500/20 backdrop-blur-xl"
    >
      <div className="mb-4 flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-indigo-300">
          Identity Verified
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex gap-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 border-indigo-400/40 shadow-lg">
          {data.basic.photoUrl ? (
            <Image
              src={data.basic.photoUrl}
              alt={data.basic.fullName}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-indigo-900 text-2xl font-bold text-indigo-300">
              {data.basic.fullName.charAt(0)}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-black text-white">{data.basic.fullName}</h3>
          <p className="text-xs text-indigo-200">
            {data.academic.department ?? data.academic.programme}
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-slate-400">
            {data.basic.enrollmentNumber}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white/5 px-3 py-2">
          <p className="text-[10px] uppercase text-slate-400">Attendance</p>
          <p className={cn('text-lg font-black', attTone)}>{att != null ? `${att}%` : '—'}</p>
        </div>
        <div className="rounded-xl bg-white/5 px-3 py-2">
          <p className="text-[10px] uppercase text-slate-400">Fee Due</p>
          <p className="text-lg font-black text-rose-300">
            {data.fees.outstandingAmount > 0 ? money(data.fees.outstandingAmount) : 'Clear'}
          </p>
        </div>
        <div className="rounded-xl bg-white/5 px-3 py-2">
          <p className="text-[10px] uppercase text-slate-400">Library</p>
          <p className="flex items-center gap-1 text-sm font-bold text-white">
            <BookOpen className="h-3.5 w-3.5 text-sky-400" />
            {data.library.booksCurrentlyHeld} held
            {data.library.dueBooks > 0 && (
              <span className="text-rose-400">· {data.library.dueBooks} due</span>
            )}
          </p>
        </div>
        <div className="rounded-xl bg-white/5 px-3 py-2">
          <p className="text-[10px] uppercase text-slate-400">Admit Card</p>
          <p className="flex items-center gap-1 text-sm font-bold">
            {data.admitCard.eligible ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-emerald-300">Eligible</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-amber-400" />
                <span className="text-amber-300">Blocked</span>
              </>
            )}
          </p>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-4 w-full border-indigo-400/40 bg-indigo-500/10 text-indigo-100 hover:bg-indigo-500/20"
        onClick={onExpand}
      >
        View Full Command Card
      </Button>
    </motion.div>
  );
}

export function PrincipalMissionScanner() {
  const [mode, setMode] = useState<ScanMode>('student');
  const [value, setValue] = useState('');
  const [keyTimes, setKeyTimes] = useState<number[]>([]);
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const studentMutation = useMutation({
    mutationFn: (q: string) => fetchStudentCommand(q),
  });
  const staffMutation = useMutation({
    mutationFn: (q: string) => fetchStaffCommand(q),
  });

  const activeMutation = mode === 'staff' ? staffMutation : studentMutation;
  const loading = activeMutation.isPending;
  const error = activeMutation.error;

  const submit = useCallback(
    (raw: string, scanMode: ScanMode) => {
      const q = raw.trim();
      if (!q || q.length < MIN_AUTO_LEN) return;
      setValue('');
      setKeyTimes([]);
      setExpanded(false);
      if (scanMode === 'staff') {
        staffMutation.mutate(q);
        studentMutation.reset();
      } else {
        studentMutation.mutate(q);
        staffMutation.reset();
      }
    },
    [staffMutation, studentMutation],
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit(value, mode === 'search' ? 'student' : mode);
      return;
    }
    const now = Date.now();
    const nextTimes = [...keyTimes, now].slice(-40);
    setKeyTimes(nextTimes);
    if (isFastScan(nextTimes, value.length + 1)) {
      setTimeout(() => {
        const el = inputRef.current;
        if (el?.value.trim()) submit(el.value, mode === 'search' ? 'student' : mode);
      }, SCAN_AUTO_MS);
    }
  };

  const scanLabel =
    mode === 'staff' ? 'SCAN STAFF ID' : mode === 'search' ? 'QUICK SEARCH' : 'SCAN STUDENT ID';

  return (
    <section className="relative overflow-hidden rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-[#0c1222] via-[#111827] to-[#1e1b4b] p-1 shadow-2xl shadow-indigo-900/40">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(99,102,241,0.15)_0%,_transparent_70%)]" />
      <div className="absolute left-0 right-0 top-1/2 h-px animate-pulse bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />

      <div className="relative grid gap-4 p-5 lg:grid-cols-[1fr_340px] lg:items-start">
        <div>
          <div className="mb-4 flex flex-wrap gap-2">
            {(
              [
                { id: 'student' as const, label: 'Student', icon: ScanLine },
                { id: 'staff' as const, label: 'Staff', icon: Users },
                { id: 'search' as const, label: 'Search', icon: Search },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all',
                  mode === id
                    ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          <div className="text-center lg:text-left">
            <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-cyan-400/80">
              {scanLabel}
            </p>
            <div className="relative mx-auto my-6 flex h-28 w-full max-w-lg items-center justify-center lg:mx-0">
              <div className="absolute inset-0 rounded-2xl border border-dashed border-indigo-400/30" />
              <div className="absolute inset-4 rounded-xl border border-cyan-400/20" />
              <motion.div
                className="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_rgba(34,211,238,0.8)]"
                animate={{ top: ['15%', '85%', '15%'] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              />
              {loading ? (
                <Loader2 className="h-10 w-10 animate-spin text-cyan-400" />
              ) : (
                <ScanLine className="h-12 w-12 text-indigo-400/60" />
              )}
            </div>
            <p className="text-sm text-slate-400">
              Scan RFID / Barcode / Enrollment No — auto-submits on hardware scan
            </p>
          </div>

          <div className="relative mt-4">
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={
                mode === 'staff'
                  ? 'Staff ID · RFID · Employee code…'
                  : 'Enrollment · RFID · Mobile · Roll…'
              }
              className="h-14 w-full rounded-xl border border-indigo-500/30 bg-black/40 px-4 pr-28 font-mono text-lg tracking-wider text-white placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
              autoComplete="off"
              disabled={loading}
            />
            <Button
              type="button"
              size="sm"
              disabled={loading || value.trim().length < MIN_AUTO_LEN}
              onClick={() => submit(value, mode === 'search' ? 'student' : mode)}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-indigo-600 hover:bg-indigo-500"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <User className="mr-1 h-4 w-4" />
                  Lookup
                </>
              )}
            </Button>
          </div>

          {error && (
            <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
              {apiErrorMessage(error, 'Lookup failed')}
            </div>
          )}
        </div>

        <div className="min-h-[120px]">
          <AnimatePresence mode="wait">
            {studentMutation.data && mode !== 'staff' && !expanded && (
              <CompactStudentResult
                key={studentMutation.data.studentId}
                data={studentMutation.data}
                onClose={() => studentMutation.reset()}
                onExpand={() => setExpanded(true)}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {expanded && studentMutation.data && mode !== 'staff' && (
        <div className="relative border-t border-indigo-500/20 p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-300">
              Full Student Command Card
            </p>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Collapse
            </button>
          </div>
          <div className="rounded-2xl bg-white/95 p-1">
            <StudentCommandCardView data={studentMutation.data} />
          </div>
        </div>
      )}

      {staffMutation.data && mode === 'staff' && (
        <div className="relative border-t border-indigo-500/20 p-5">
          <StaffCommandCardView data={staffMutation.data} />
        </div>
      )}
    </section>
  );
}
