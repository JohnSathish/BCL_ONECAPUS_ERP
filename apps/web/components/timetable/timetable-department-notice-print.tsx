'use client';

import { useMemo } from 'react';
import type { TimetableContext, TimetableMatrix, TimetablePlan } from '@/services/timetable';
import type { BrandingDocumentContext } from '@/lib/branding-document';
import { collectTimetableStaffDirectory } from '@/lib/timetable/entry-display';
import {
  NOTICE_DAY_ORDER,
  entriesForNoticeCell,
  formatNoticeCell,
  noticeDayLabel,
  noticeSemesterRows,
  saturdayNoticeColumns,
  weekdayNoticeColumns,
  type NoticePeriodColumn,
} from '@/lib/timetable/department-notice';

const LEGEND = [
  { code: 'MAJOR', label: 'Major / Core' },
  { code: 'MINOR', label: 'Minor' },
  { code: 'MDC', label: 'Multidisciplinary' },
  { code: 'AEC', label: 'Ability Enhancement' },
  { code: 'SEC', label: 'Skill Enhancement' },
  { code: 'VAC', label: 'Value Added' },
  { code: 'VTC', label: 'Vocational Training' },
];

export function TimetableDepartmentNoticePrint({
  matrix,
  plan,
  context,
  branding,
  generatedAt = new Date(),
}: {
  matrix?: TimetableMatrix;
  plan?: TimetablePlan;
  context?: TimetableContext;
  branding?: BrandingDocumentContext | null;
  generatedAt?: Date;
}) {
  const semesterMode = String(
    matrix?.summary?.semesterMode ??
      (plan?.metadata as { semesterMode?: string } | undefined)?.semesterMode ??
      context?.currentAcademicMode ??
      'ODD',
  ).toUpperCase();
  const semesters = useMemo(() => noticeSemesterRows(matrix, semesterMode), [matrix, semesterMode]);
  const weekColumns = useMemo(() => weekdayNoticeColumns(matrix), [matrix]);
  const saturdayColumns = useMemo(() => saturdayNoticeColumns(matrix), [matrix]);
  const staffDirectory = useMemo(() => {
    const entries = (matrix?.rows ?? []).flatMap((row) => row.entries ?? []);
    return collectTimetableStaffDirectory(entries);
  }, [matrix]);

  const shiftName = resolveShiftName(plan, context);
  const departmentName =
    matrix?.summary?.streamName ??
    (plan?.metadata as { streamName?: string } | undefined)?.streamName ??
    'Department';
  const academicYearName = resolveAcademicYearName(matrix, context);
  const institutionName = branding?.institutionName ?? 'Don Bosco College Tura';
  const campusLine = [branding?.campusName, branding?.address].filter(Boolean).join(' · ');
  const semesterList = formatSemesterList(semesters);
  const rangeLabel = formatEffectiveRange(plan?.effectiveFrom, plan?.effectiveTo);

  return (
    <article className="timetable-print-document timetable-print-notice">
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
        </div>
      </header>

      <h2 className="timetable-print-title">Class Routine for {semesterList} Semester</h2>
      <p className="timetable-print-notice-dept">
        Dept. of {departmentName}
        {shiftName ? ` · ${shiftName}` : ''}
        {academicYearName ? ` · ${academicYearName}` : ''}
        {rangeLabel ? ` · ${rangeLabel}` : ''}
      </p>

      {NOTICE_DAY_ORDER.map((day) => {
        const columns = day === 6 ? saturdayColumns : weekColumns;
        return (
          <DayTable
            key={day}
            dayOfWeek={day}
            columns={columns}
            semesters={semesters}
            matrix={matrix}
          />
        );
      })}

      <section className="timetable-print-legend">
        <p className="timetable-print-legend-title">Category legend</p>
        <div className="timetable-print-legend-items">
          {LEGEND.map((item) => (
            <span key={item.code} className="timetable-print-legend-item">
              {item.code} — {item.label}
            </span>
          ))}
        </div>
      </section>

      {staffDirectory.length ? (
        <section className="timetable-print-staff-directory">
          <p className="timetable-print-legend-title">Staff initials</p>
          <div className="timetable-print-staff-directory-items">
            {staffDirectory.map((staff) => (
              <span key={staff.shortCode} className="timetable-print-staff-directory-item">
                <strong>{staff.shortCode}</strong>
                <span aria-hidden> – </span>
                {staff.fullName}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <div className="timetable-print-notice-sign">
        <div>
          <p>Head of Department</p>
          <p className="timetable-print-notice-sign-line">Dept. of {departmentName}</p>
        </div>
        <div>
          <p>Principal</p>
          <p className="timetable-print-notice-sign-line">{institutionName}</p>
        </div>
      </div>

      <footer className="timetable-print-footer">
        <span>
          Generated {formatDateTime(generatedAt)} · {institutionName} · Department notice board
        </span>
        <span className="timetable-print-page-number">FYUGP {semesterMode}</span>
      </footer>
    </article>
  );
}

function DayTable({
  dayOfWeek,
  columns,
  semesters,
  matrix,
}: {
  dayOfWeek: number;
  columns: NoticePeriodColumn[];
  semesters: number[];
  matrix?: TimetableMatrix;
}) {
  const dayName = noticeDayLabel(dayOfWeek);
  return (
    <div className="timetable-print-notice-day">
      <table className="timetable-print-table timetable-print-notice-table">
        <thead>
          <tr>
            <th className="notice-day-col">Day</th>
            <th className="notice-sem-col">Course</th>
            {columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {semesters.map((semester, index) => (
            <tr key={semester}>
              {index === 0 ? (
                <td className="notice-day-cell" rowSpan={semesters.length}>
                  {dayName}
                </td>
              ) : null}
              <td className="notice-sem-cell">{semester} Sem</td>
              {columns.map((col) => {
                if (col.isBreak) {
                  return index === 0 ? (
                    <td key={col.key} className="break-row" rowSpan={semesters.length}>
                      Break
                    </td>
                  ) : null;
                }
                const text = formatNoticeCell(
                  entriesForNoticeCell(matrix, dayOfWeek, semester, col),
                );
                return (
                  <td key={col.key} className={isPoolLabel(text) ? 'notice-pool-cell' : undefined}>
                    {text || '—'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function isPoolLabel(text: string) {
  return /^(MDC|SEC|VAC|VTC|AEC)\b/i.test(text);
}

function resolveShiftName(plan?: TimetablePlan, context?: TimetableContext) {
  const shiftId = plan?.shiftId;
  if (!shiftId) return 'Day Shift';
  const match = context?.shifts.find((shift) => shift.id === shiftId);
  if (match?.name) return match.name;
  if (/morning/i.test(match?.code ?? '')) return 'Shift 1';
  if (/day/i.test(match?.code ?? '')) return 'Shift 2';
  return match?.code ?? 'Day Shift';
}

function resolveAcademicYearName(matrix?: TimetableMatrix, context?: TimetableContext) {
  const yearId = matrix?.summary?.academicYearId;
  if (yearId && context?.academicYears?.length) {
    const match = context.academicYears.find((year) => year.id === yearId);
    if (match) return match.name;
  }
  return context?.academicYears?.find((year) => year.status === 'ACTIVE')?.name ?? '2026-27';
}

function formatSemesterList(semesters: number[]) {
  if (semesters.length === 3) return `${semesters[0]}, ${semesters[1]} & ${semesters[2]}th`;
  if (semesters.length === 1) return `${semesters[0]}`;
  const last = semesters[semesters.length - 1];
  return `${semesters.slice(0, -1).join(', ')} & ${last}th`;
}

function formatEffectiveRange(from?: string | null, to?: string | null) {
  if (!from && !to) return '';
  const start = formatDate(from);
  const end = formatDate(to);
  if (start && end && start !== '—') return `${start} – ${end}`;
  return start !== '—' ? start : end;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
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
