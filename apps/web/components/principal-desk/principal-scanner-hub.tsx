'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, ScanLine, Search, User, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchStaffCommand, fetchStudentCommand } from '@/services/principal-desk';
import { StaffCommandCardView } from '@/components/principal-desk/staff-command-card';
import { StudentCommandCardView } from '@/components/principal-desk/student-command-card';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

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

export function PrincipalScannerHub({
  defaultMode = 'student',
  compact = false,
}: {
  defaultMode?: ScanMode;
  compact?: boolean;
}) {
  const [mode, setMode] = useState<ScanMode>(defaultMode);
  const [value, setValue] = useState('');
  const [keyTimes, setKeyTimes] = useState<number[]>([]);
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

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'rounded-2xl border-2 border-dashed p-4 transition-colors',
          mode === 'student'
            ? 'border-indigo-300 bg-indigo-50/40'
            : mode === 'staff'
              ? 'border-violet-300 bg-violet-50/40'
              : 'border-slate-300 bg-slate-50/40',
          compact ? 'p-3' : 'p-6',
        )}
      >
        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === 'student' ? 'default' : 'outline'}
            onClick={() => setMode('student')}
          >
            <ScanLine className="mr-1 h-4 w-4" />
            Student Scanner
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'staff' ? 'default' : 'outline'}
            onClick={() => setMode('staff')}
          >
            <Users className="mr-1 h-4 w-4" />
            Staff Scanner
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'search' ? 'default' : 'outline'}
            onClick={() => setMode('search')}
          >
            <Search className="mr-1 h-4 w-4" />
            Quick Search
          </Button>
        </div>

        <div className="relative">
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              mode === 'staff'
                ? 'Scan staff ID, RFID, or employee code…'
                : 'Scan student card, enrollment, mobile, or RFID…'
            }
            className={cn(
              'h-14 border-2 pr-24 text-lg font-mono tracking-wide',
              !compact && 'h-16 text-xl',
            )}
            autoComplete="off"
            disabled={loading}
          />
          <Button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2"
            size="sm"
            disabled={loading || value.trim().length < MIN_AUTO_LEN}
            onClick={() => submit(value, mode === 'search' ? 'student' : mode)}
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
        <p className="mt-2 text-xs text-slate-500">
          Barcode / RFID auto-submits. Supports enrollment, mobile, roll number, employee code.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {apiErrorMessage(error, 'Lookup failed')}
        </div>
      )}

      {studentMutation.data && mode !== 'staff' && (
        <StudentCommandCardView data={studentMutation.data} />
      )}
      {staffMutation.data && mode === 'staff' && <StaffCommandCardView data={staffMutation.data} />}
    </div>
  );
}
