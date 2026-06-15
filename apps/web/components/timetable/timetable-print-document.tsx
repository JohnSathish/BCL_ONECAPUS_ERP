'use client';

import { useMemo } from 'react';
import type { TimetableContext, TimetableMatrix, TimetablePlan } from '@/services/timetable';
import type { BrandingDocumentContext } from '@/lib/branding-document';

const LEGEND = [
  { code: 'MAJOR', label: 'Major / Core' },
  { code: 'MINOR', label: 'Minor / Core' },
  { code: 'MDC', label: 'Multidisciplinary' },
  { code: 'AEC', label: 'Ability Enhancement' },
  { code: 'SEC', label: 'Skill Enhancement' },
  { code: 'VAC', label: 'Value Added' },
  { code: 'VTC', label: 'Vocational Training' },
  { code: 'INTERNSHIP', label: 'Internship' },
  { code: 'LAB', label: 'Laboratory' },
];

export type TimetablePrintDocumentProps = {
  matrix?: TimetableMatrix;
  plan?: TimetablePlan;
  context?: TimetableContext;
  branding?: BrandingDocumentContext | null;
  semesterFilter?: number;
  sectionFilter?: string;
  generatedAt?: Date;
};

export function TimetablePrintDocument({
  matrix,
  plan,
  context,
  branding,
  semesterFilter,
  sectionFilter,
  generatedAt = new Date(),
}: TimetablePrintDocumentProps) {
  const rows = matrix?.rows ?? [];
  const days = matrix?.days ?? [];
  const timeRows = useMemo(() => groupRowsByTime(rows), [rows]);

  const shiftName = resolveShiftName(plan, context);
  const streamName =
    matrix?.summary?.streamName ??
    (plan?.metadata as { streamName?: string } | undefined)?.streamName ??
    'All Streams';
  const semesterMode =
    matrix?.summary?.semesterMode ??
    (plan?.metadata as { semesterMode?: string } | undefined)?.semesterMode ??
    context?.currentAcademicMode ??
    'ODD';
  const allowedSemesters =
    (plan?.metadata as { allowedSemesters?: number[] } | undefined)?.allowedSemesters ??
    context?.allowedSemesters ??
    [];
  const academicYearName = resolveAcademicYearName(matrix, context, plan);
  const institutionName = branding?.institutionName ?? 'Don Bosco College Tura';
  const campusLine = [branding?.campusName, branding?.address].filter(Boolean).join(' · ');
  const documentTitle = matrix?.summary?.title ?? plan?.name ?? 'Weekly Class Routine';
  const statusLabel = plan?.status ? plan.status.toUpperCase() : 'DRAFT';

  return (
    <article className="timetable-print-document">
      <header className="timetable-print-header">
        {branding?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={branding.logoUrl} alt="" className="timetable-print-logo" />
        ) : (
          <div className="timetable-print-logo-placeholder" aria-hidden>
            {institutionName
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => w[0])
              .join('')}
          </div>
        )}
        <div>
          <h1 className="timetable-print-institution-name">{institutionName}</h1>
          {campusLine ? <p className="timetable-print-institution-sub">{campusLine}</p> : null}
          {branding?.tagline ? (
            <p className="timetable-print-institution-sub">{branding.tagline}</p>
          ) : null}
        </div>
      </header>

      <h2 className="timetable-print-title">Class Routine — {documentTitle}</h2>

      <dl className="timetable-print-meta">
        <div>
          <dt>Academic Year</dt>
          <dd>{academicYearName}</dd>
        </div>
        <div>
          <dt>Semester Mode</dt>
          <dd>
            {semesterMode} Semesters
            {allowedSemesters.length ? ` (${allowedSemesters.join(', ')})` : ''}
          </dd>
        </div>
        <div>
          <dt>Stream / Programme</dt>
          <dd>{streamName}</dd>
        </div>
        <div>
          <dt>Shift</dt>
          <dd>{shiftName}</dd>
        </div>
        <div>
          <dt>Semester Filter</dt>
          <dd>{semesterFilter ? `Semester ${semesterFilter}` : 'All semesters in plan'}</dd>
        </div>
        <div>
          <dt>Section / Class</dt>
          <dd>{sectionFilter?.trim() || 'All sections'}</dd>
        </div>
        <div>
          <dt>Plan Status</dt>
          <dd>{statusLabel}</dd>
        </div>
        <div>
          <dt>Effective From</dt>
          <dd>{formatDate(plan?.effectiveFrom ?? matrix?.summary?.effectiveFrom)}</dd>
        </div>
      </dl>

      <div className="timetable-print-table-wrap">
        <table className="timetable-print-table">
          <thead>
            <tr>
              <th className="time-col">Period / Time</th>
              {days.map((day) => (
                <th key={day.value}>{day.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeRows.map((timeRow) =>
              timeRow.isBreak || timeRow.isLunch ? (
                <tr key={timeRow.key} className="break-row">
                  <td className="time-col">{timeRow.label}</td>
                  <td colSpan={days.length}>LUNCH BREAK</td>
                </tr>
              ) : (
                <tr key={timeRow.key}>
                  <td className="time-col">{timeRow.label}</td>
                  {days.map((day) => (
                    <td key={`${timeRow.key}-${day.value}`}>
                      {renderPrintCell(timeRow, day.value)}
                    </td>
                  ))}
                </tr>
              ),
            )}
            {!timeRows.length ? (
              <tr>
                <td colSpan={days.length + 1} className="timetable-print-empty">
                  No timetable slots scheduled for this plan.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <section className="timetable-print-legend">
        <p className="timetable-print-legend-title">Category Legend (NEHU FYUGP)</p>
        <div className="timetable-print-legend-items">
          {LEGEND.map((item) => (
            <span key={item.code} className="timetable-print-legend-item">
              {item.code} — {item.label}
            </span>
          ))}
        </div>
      </section>

      <footer className="timetable-print-footer">
        <span>
          Generated {formatDateTime(generatedAt)} · {institutionName} · Confidential — for academic
          use
        </span>
        <span className="timetable-print-page-number" />
      </footer>
    </article>
  );
}

function renderPrintCell(timeRow: ReturnType<typeof groupRowsByTime>[number], dayValue: number) {
  const rows = timeRow.byDay.get(dayValue) ?? [];
  if (!rows.length && dayValue === 6) {
    return <span className="timetable-print-empty">Half Day</span>;
  }
  const entries = rows.flatMap((row) => row.entries);
  if (!entries.length) {
    return <span className="timetable-print-empty">—</span>;
  }
  return (
    <div>
      {entries.map((entry) => {
        const category = (entry.fyugpCategory || entry.slotType || 'GENERAL').toUpperCase();
        const overlay = entry.replacementOverlay;
        return (
          <div key={entry.id} className="timetable-print-slot">
            <div className="timetable-print-slot-head">
              <span>{entry.course?.code ?? entry.slotType}</span>
              <span className="timetable-print-slot-cat">{category}</span>
            </div>
            <p className="timetable-print-slot-title">{entry.course?.title ?? 'Scheduled slot'}</p>
            <p className="timetable-print-slot-meta">
              Sem {entry.semesterSequence ?? '-'}
              {entry.sectionCode ? ` · Sec ${entry.sectionCode}` : ''}
              {overlay ? (
                <>
                  {' · '}
                  Original Faculty: {overlay.originalStaffName}
                  {' · '}
                  Handled By: {overlay.handledByName}
                  {' · '}
                  {overlay.reasonLabel}
                </>
              ) : (
                <>
                  {' · '}
                  {entry.staffProfile?.shortCode ?? entry.staffProfile?.fullName ?? 'Faculty TBA'}
                </>
              )}
              {' · '}
              {entry.classroom?.code ?? 'Room TBA'}
              {entry.isCombined ? ' · Combined' : ''}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function groupRowsByTime(rows: TimetableMatrix['rows']) {
  const map = new Map<
    string,
    {
      key: string;
      label: string;
      isBreak: boolean;
      isLunch: boolean;
      byDay: Map<number, TimetableMatrix['rows']>;
    }
  >();
  for (const row of rows) {
    const key = `${row.startTime}-${row.endTime}`;
    const existing = map.get(key) ?? {
      key,
      label:
        row.isBreak || row.isLunch
          ? `Break · ${row.startTime.slice(0, 5)}–${row.endTime.slice(0, 5)}`
          : `${row.label} · ${row.startTime.slice(0, 5)}–${row.endTime.slice(0, 5)}`,
      isBreak: Boolean(row.isBreak),
      isLunch: Boolean(row.isLunch),
      byDay: new Map<number, TimetableMatrix['rows']>(),
    };
    existing.byDay.set(row.dayOfWeek, [...(existing.byDay.get(row.dayOfWeek) ?? []), row]);
    map.set(key, existing);
  }
  return Array.from(map.values());
}

function resolveShiftName(plan?: TimetablePlan, context?: TimetableContext) {
  const shiftId = plan?.shiftId;
  if (!shiftId) return 'Day Shift';
  return context?.shifts.find((shift) => shift.id === shiftId)?.name ?? 'Day Shift';
}

function resolveAcademicYearName(
  matrix?: TimetableMatrix,
  context?: TimetableContext,
  plan?: TimetablePlan,
) {
  const yearId = matrix?.summary?.academicYearId;
  if (yearId && context?.academicYears?.length) {
    const match = context.academicYears.find((year) => year.id === yearId);
    if (match) return match.name;
  }
  const active = context?.academicYears?.find((year) => year.status === 'ACTIVE');
  return active?.name ?? '2026-27';
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(value: Date) {
  return value.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
