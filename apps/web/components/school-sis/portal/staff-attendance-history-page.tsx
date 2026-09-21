'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, CheckCircle2, Download, Eye, Info, Users, UserRound } from 'lucide-react';
import { fetchSchoolAttendanceHistory } from '@/services/school-sis-portal';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { cn } from '@/utils/cn';
import { asNumber, asText } from './portal-utils';

const BASE = '/school-sis-portal/staff';
const BADGE_TONES = ['sky', 'emerald', 'violet', 'amber', 'rose', 'navy'] as const;

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthOptions(count = 18) {
  const out: Array<{ value: string; label: string }> = [];
  const now = new Date();
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({
      value,
      label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    });
  }
  return out;
}

function classBadge(label: string) {
  const parts = label.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[parts.length - 2]} ${parts[parts.length - 1]}`.trim();
  return label.slice(0, 8);
}

export function StaffAttendanceHistoryPage() {
  const authed = useAuthQueryEnabled();
  const [month, setMonth] = useState(currentMonthKey);
  const months = useMemo(() => monthOptions(), []);

  const q = useQuery({
    queryKey: ['school-attendance-history', month],
    queryFn: () => fetchSchoolAttendanceHistory(month),
    enabled: authed,
  });

  const classes = q.data?.classes ?? [];
  const avg = asNumber(q.data?.avgAttendance);
  const monthLabel = months.find((m) => m.value === month)?.label ?? asText(q.data?.month, month);

  function exportPdf() {
    const rows = classes
      .map(
        (row, i) =>
          `<tr>
            <td>${i + 1}</td>
            <td>${asText(row.label)}</td>
            <td>${asNumber(row.students)}</td>
            <td>${asNumber(row.present)}</td>
            <td>${asNumber(row.absent)}</td>
            <td>${asNumber(row.percent)}%</td>
          </tr>`,
      )
      .join('');
    const html = `<!doctype html><html><head><title>Attendance history ${monthLabel}</title>
      <style>
        body{font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#0f172a}
        h1{font-size:20px;margin:0 0 4px} p{margin:0 0 16px;color:#64748b}
        table{width:100%;border-collapse:collapse;font-size:13px}
        th,td{border:1px solid #e2e8f0;padding:8px 10px;text-align:left}
        th{background:#f8fafc}
      </style></head><body>
      <h1>Class-wise Attendance Summary</h1>
      <p>${monthLabel} · ${asNumber(q.data?.classCount)} classes · ${asNumber(q.data?.workingDays)} working days</p>
      <table><thead><tr><th>#</th><th>Class</th><th>Total Students</th><th>Present</th><th>Absent</th><th>Attendance %</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6">No classes</td></tr>'}</tbody></table>
      </body></html>`;
    const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <div className="sls-ath">
      <div className="sls-ath-head">
        <div className="sls-ath-title">
          <span className="sls-ath-title-ico">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <h1>Attendance history</h1>
            <p>Class-wise summary from your assigned sections.</p>
          </div>
        </div>
        <label className="sls-ath-month">
          <CalendarDays className="h-4 w-4" />
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            aria-label="Select month"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="sls-ath-kpis">
        <article className="sls-ath-kpi is-sky">
          <span className="sls-ath-kpi-ico">
            <Users className="h-4 w-4" />
          </span>
          <div>
            <p>Total Classes</p>
            <strong>{asNumber(q.data?.classCount)}</strong>
            <em>Assigned sections</em>
          </div>
        </article>
        <article className="sls-ath-kpi is-green">
          <span className="sls-ath-kpi-ico">
            <CheckCircle2 className="h-4 w-4" />
          </span>
          <div>
            <p>Average Attendance</p>
            <strong>{avg}%</strong>
            <em>This month</em>
            <span className="sls-ath-meter" aria-hidden>
              <i style={{ width: `${Math.max(0, Math.min(100, avg))}%` }} />
            </span>
          </div>
        </article>
        <article className="sls-ath-kpi is-blue">
          <span className="sls-ath-kpi-ico">
            <UserRound className="h-4 w-4" />
          </span>
          <div>
            <p>Total Students</p>
            <strong>{asNumber(q.data?.studentCount)}</strong>
            <em>Across all classes</em>
          </div>
        </article>
        <article className="sls-ath-kpi is-violet">
          <span className="sls-ath-kpi-ico">
            <CalendarDays className="h-4 w-4" />
          </span>
          <div>
            <p>Working Days</p>
            <strong>{asNumber(q.data?.workingDays)}</strong>
            <em>This month</em>
          </div>
        </article>
      </div>

      <section className="portal-card sls-ath-panel">
        <div className="sls-ath-panel-head">
          <div>
            <h2>Class-wise Attendance Summary</h2>
            <p>{monthLabel}</p>
          </div>
          <button
            type="button"
            className="sls-ath-export"
            onClick={exportPdf}
            disabled={!classes.length}
          >
            <Download className="h-4 w-4" />
            Export as PDF
          </button>
        </div>

        {q.isLoading ? (
          <p className="portal-empty">Loading attendance history…</p>
        ) : q.isError ? (
          <p className="portal-empty">Could not load attendance history.</p>
        ) : !classes.length ? (
          <p className="portal-empty">No assigned classes yet.</p>
        ) : (
          <div className="sls-ath-table-wrap">
            <table className="sls-ath-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Class</th>
                  <th>Total Students</th>
                  <th>Present</th>
                  <th>Absent</th>
                  <th>Attendance %</th>
                  <th>Progress</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((row, i) => {
                  const pct = asNumber(row.percent);
                  const tone = BADGE_TONES[i % BADGE_TONES.length];
                  return (
                    <tr key={asText(row.id, String(i))}>
                      <td>{i + 1}</td>
                      <td>
                        <span className="sls-ath-class">
                          <b>{asText(row.label)}</b>
                          <em className={cn('sls-ath-badge', `is-${tone}`)}>
                            {classBadge(asText(row.label))}
                          </em>
                        </span>
                      </td>
                      <td>{asNumber(row.students)}</td>
                      <td className="is-present">{asNumber(row.present)}</td>
                      <td className="is-absent">{asNumber(row.absent)}</td>
                      <td>{pct}%</td>
                      <td>
                        <span className="sls-ath-progress">
                          <span className="sls-ath-progress-track">
                            <i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
                          </span>
                          <em>{pct}%</em>
                        </span>
                      </td>
                      <td>
                        <Link
                          href={`${BASE}/attendance/mark`}
                          className="sls-ath-view"
                          title="Open mark attendance"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View Details
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="sls-ath-foot">
          <span>
            Showing {classes.length} class{classes.length === 1 ? '' : 'es'}.
          </span>
          <p>
            <Info className="h-3.5 w-3.5" />
            Attendance percentage is calculated from marked days in the selected month.
          </p>
        </div>
      </section>
    </div>
  );
}
