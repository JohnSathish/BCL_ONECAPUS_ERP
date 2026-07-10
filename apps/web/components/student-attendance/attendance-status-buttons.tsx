'use client';

import type { LucideIcon } from 'lucide-react';
import { Building2, Check, MoreHorizontal, Pause, X } from 'lucide-react';

import {
  ATTENDANCE_STATUS_MAP,
  EXTENDED_ATTENDANCE_STATUSES,
  PRIMARY_ATTENDANCE_STATUSES,
  isExtendedAttendanceStatus,
  type AttendanceStatusCode,
} from '@/components/student-attendance/attendance-status-config';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/utils/cn';

const STATUS_ICONS: Record<AttendanceStatusCode, LucideIcon> = {
  P: Check,
  A: X,
  L: Pause,
  OD: Building2,
  ML: Pause,
  SPORTS: Pause,
  NSS: Pause,
  NCC: Pause,
  EXEMPTED: Pause,
};

const PRIMARY_MIN_WIDTH: Partial<Record<AttendanceStatusCode, string>> = {
  P: 'min-w-[5.75rem]',
  A: 'min-w-[5.5rem]',
  L: 'min-w-[4.75rem]',
  OD: 'min-w-[3.5rem]',
};

type AttendanceStatusButtonBarProps = {
  value: string;
  disabled?: boolean;
  onChange: (status: string) => void;
};

export function AttendanceStatusButtonBar({
  value,
  disabled,
  onChange,
}: AttendanceStatusButtonBarProps) {
  return (
    <div className="shrink-0">
      {/* Desktop / tablet: single compact row */}
      <div className="hidden items-center gap-1.5 sm:flex">
        {PRIMARY_ATTENDANCE_STATUSES.map((code) => (
          <StatusButton
            key={code}
            code={code}
            active={value === code}
            disabled={disabled}
            onClick={() => onChange(code)}
            showLabel
          />
        ))}
        <ExtendedStatusMenu value={value} disabled={disabled} onSelect={onChange} />
      </div>

      {/* Mobile: two rows */}
      <div className="flex flex-col gap-1 sm:hidden">
        <div className="flex items-center gap-1">
          {PRIMARY_ATTENDANCE_STATUSES.slice(0, 2).map((code) => (
            <StatusButton
              key={code}
              code={code}
              active={value === code}
              disabled={disabled}
              onClick={() => onChange(code)}
              className="flex-1"
            />
          ))}
        </div>
        <div className="flex items-center gap-1">
          {PRIMARY_ATTENDANCE_STATUSES.slice(2).map((code) => (
            <StatusButton
              key={code}
              code={code}
              active={value === code}
              disabled={disabled}
              onClick={() => onChange(code)}
              className="flex-1"
            />
          ))}
          <ExtendedStatusMenu
            value={value}
            disabled={disabled}
            onSelect={onChange}
            className="flex-1"
          />
        </div>
      </div>
    </div>
  );
}

function StatusButton({
  code,
  active,
  disabled,
  onClick,
  showLabel = false,
  className,
}: {
  code: AttendanceStatusCode;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  showLabel?: boolean;
  className?: string;
}) {
  const meta = ATTENDANCE_STATUS_MAP[code];
  const Icon = STATUS_ICONS[code];
  const buttonLabel = showLabel ? (code === 'OD' ? meta.shortLabel : meta.label) : meta.shortLabel;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={meta.label}
      aria-pressed={active}
      aria-label={meta.label}
      className={cn(
        'inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-[10px] border text-xs font-semibold transition',
        showLabel ? cn('px-2.5', PRIMARY_MIN_WIDTH[code]) : 'min-w-[3.5rem] px-2',
        active ? meta.activeClass : meta.inactiveClass,
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
      <span className="whitespace-nowrap">{buttonLabel}</span>
    </button>
  );
}

function ExtendedStatusMenu({
  value,
  disabled,
  onSelect,
  className,
}: {
  value: string;
  disabled?: boolean;
  onSelect: (status: string) => void;
  className?: string;
}) {
  const extendedActive = isExtendedAttendanceStatus(value);
  const activeMeta = extendedActive ? ATTENDANCE_STATUS_MAP[value as AttendanceStatusCode] : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          title="More statuses"
          aria-label="More attendance statuses"
          className={cn(
            'inline-flex h-9 w-14 items-center justify-center gap-0.5 rounded-[10px] border px-2 text-xs font-semibold transition',
            extendedActive && activeMeta
              ? activeMeta.activeClass
              : 'border-border bg-transparent text-muted-foreground hover:bg-muted/50',
            disabled && 'cursor-not-allowed opacity-60',
            className,
          )}
        >
          {extendedActive && activeMeta ? (
            <span className="truncate">{activeMeta.shortLabel}</span>
          ) : (
            <MoreHorizontal className="h-4 w-4" strokeWidth={2.5} />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {EXTENDED_ATTENDANCE_STATUSES.map((code) => {
          const meta = ATTENDANCE_STATUS_MAP[code];
          return (
            <DropdownMenuItem
              key={code}
              onClick={() => onSelect(code)}
              className={cn(value === code && 'bg-muted font-semibold')}
            >
              <span className={cn('mr-2 inline-flex h-2 w-2 rounded-full', meta.chipClass)} />
              {meta.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
