'use client';

import type { EnhancedStudentSummary } from '@/types/students';
import { cn } from '@/utils/cn';

function MiniDonut({
  segments,
  size = 56,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let offset = 0;
  const r = 16;
  const c = 2 * Math.PI * r;

  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className="shrink-0 -rotate-90">
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.08}
        strokeWidth="6"
      />
      {segments.map((seg) => {
        const frac = seg.value / total;
        const dash = frac * c;
        const el = (
          <circle
            key={seg.label}
            cx="20"
            cy="20"
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth="6"
            strokeDasharray={`${dash} ${c - dash}`}
            strokeDashoffset={-offset}
            strokeLinecap="round"
          />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
}

function StatChip({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/60 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-lg font-bold leading-tight">{value}</p>
      {sub ? <p className="text-[10px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

export function DirectoryAnalyticsPanel({ summary }: { summary?: EnhancedStudentSummary }) {
  if (!summary) return null;

  const male = summary.byGender?.Male ?? 0;
  const female = summary.byGender?.Female ?? 0;
  const genderTotal =
    male + female + (summary.byGender?.Unknown ?? 0) + (summary.byGender?.Other ?? 0);

  const streamEntries = Object.entries(summary.byStream ?? {});
  const artsLike = streamEntries
    .filter(([n]) => /art|humanities|social/i.test(n))
    .reduce((s, [, v]) => s + v, 0);
  const scienceLike = streamEntries
    .filter(([n]) => /science|commerce|stem/i.test(n))
    .reduce((s, [, v]) => s + v, 0);

  const programmeEntries = Object.entries(summary.byProgramme ?? {}).slice(0, 5);
  const maxProg = Math.max(...programmeEntries.map(([, v]) => v), 1);

  const rfidPct =
    summary.total > 0
      ? `${((100 * (summary.rfidAssigned ?? 0)) / summary.total).toFixed(1)}%`
      : '0%';

  return (
    <div className="grid gap-3 lg:grid-cols-12">
      <div className="glass-card col-span-12 rounded-2xl border border-border/50 p-3 lg:col-span-4">
        <div className="flex items-center gap-3">
          <MiniDonut
            segments={[
              { label: 'Male', value: male, color: '#3b82f6' },
              { label: 'Female', value: female, color: '#ec4899' },
            ]}
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold">Gender distribution</p>
            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
              <span>
                Male: <strong>{male}</strong>
              </span>
              <span>
                Female: <strong>{female}</strong>
              </span>
              {genderTotal > 0 ? (
                <span className="col-span-2 text-muted-foreground">
                  {Math.round((male / genderTotal) * 100)}% /{' '}
                  {Math.round((female / genderTotal) * 100)}%
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card col-span-12 rounded-2xl border border-border/50 p-3 lg:col-span-4">
        <p className="text-xs font-semibold">Stream mix</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <StatChip label="Arts / Humanities" value={artsLike || '—'} />
          <StatChip label="Science / Commerce" value={scienceLike || '—'} />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {streamEntries.slice(0, 4).map(([name, count]) => (
            <span key={name} className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px]">
              {name}: {count}
            </span>
          ))}
        </div>
      </div>

      <div className="glass-card col-span-12 rounded-2xl border border-border/50 p-3 lg:col-span-4">
        <p className="text-xs font-semibold">Programme distribution</p>
        <div className="mt-2 space-y-1.5">
          {programmeEntries.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No programme data</p>
          ) : (
            programmeEntries.map(([name, count]) => (
              <div key={name} className="space-y-0.5">
                <div className="flex justify-between gap-2 text-[10px]">
                  <span className="truncate">{name}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{count}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width: `${Math.max(8, (count / maxProg) * 100)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="col-span-12 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatChip label="RFID coverage" value={summary.rfidAssigned ?? 0} sub={rfidPct} />
        <StatChip label="Fee defaulters" value={summary.feeDefaulters ?? 0} />
        <StatChip label="Hostellers" value={summary.hostelResidents ?? 0} />
        <StatChip label="Attendance at risk" value={summary.attendanceShortage ?? 0} />
      </div>
    </div>
  );
}
