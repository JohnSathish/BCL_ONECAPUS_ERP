'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  GraduationCap,
  KeyRound,
  MessageSquare,
  NotebookPen,
  Users,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { PortalAvatar } from './portal-widgets';
import { usePortalData, portalDisplayName, portalMe } from './portal-data';
import { asList, asNumber, asRecord, asText, formatDay, initials } from './portal-utils';

const BASE = '/school-sis-portal/staff';
const MOTTO = "Teaching is not a job, it's a life that touches forever.";
const QUOTE = 'Education is the most powerful weapon which you can use to change the world.';
const FOOTER_QUOTE =
  'A good teacher can inspire hope, ignite the imagination, and instill a love of learning.';

const SUBJECT_TONES = ['rose', 'emerald', 'amber', 'orange', 'violet', 'sky'] as const;

function greetingNow() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function dueLabel(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const due = new Date(y, (m || 1) - 1, d || 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days === 2) return 'Due in 2 days';
  return `Due ${due.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`;
}

function toneFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash + name.charCodeAt(i) * (i + 1)) % 997;
  return SUBJECT_TONES[hash % SUBJECT_TONES.length];
}

function noticeKind(row: Record<string, unknown>) {
  const raw =
    `${asText(row.kind, '')} ${asText(row.category, '')} ${asText(row.title, '')}`.toLowerCase();
  if (raw.includes('event') || raw.includes('meeting')) return { label: 'Event', tone: 'amber' };
  if (raw.includes('exam') || raw.includes('academic') || raw.includes('class')) {
    return { label: 'Academic', tone: 'emerald' };
  }
  return { label: 'School Notice', tone: 'sky' };
}

function monthMatrix(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ day: number; inMonth: boolean }> = [];
  for (let i = 0; i < startPad; i += 1) cells.push({ day: 0, inMonth: false });
  for (let d = 1; d <= days; d += 1) cells.push({ day: d, inMonth: true });
  while (cells.length % 7) cells.push({ day: 0, inMonth: false });
  return cells;
}

export function StaffPortalHome() {
  const { home, loading } = usePortalData();
  const me = portalMe(home);
  const staff = asRecord(me.staff);
  const desk = asRecord(home?.desk);
  const site = asRecord(home?.site);
  const name = portalDisplayName(home, 'Staff');
  const greeting = asText(home?.greeting, greetingNow());
  const schoolName = asText(site.displayName, "St. Luke's Secondary School, Tura");
  const classes = asList(desk.classes).map(asRecord);
  const [classId, setClassId] = useState('');
  const selected = classes.find((row) => asText(row.id, '') === classId) ?? classes[0] ?? null;
  const [cal, setCal] = useState(() => {
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth() };
  });

  const periods = asList(desk.todaySchedule).map(asRecord);
  const homework = asList(desk.recentHomework).map(asRecord);
  const notices = asList(home?.notices).map(asRecord);
  const eventDays = useMemo(() => {
    const set = new Set<string>();
    for (const row of asList(home?.events).map(asRecord)) {
      const raw = asText(row.startsAt ?? row.startDate ?? row.date, '');
      if (raw) set.add(raw.slice(0, 10));
    }
    return set;
  }, [home?.events]);

  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const weekday = today.toLocaleDateString('en-IN', { weekday: 'long' });
  const rest = today.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const dateLabel = `${weekday}, ${rest}`;
  const percent = Math.round(asNumber(selected?.percent));
  const cells = monthMatrix(cal.y, cal.m);

  if (loading && !home) {
    return <p className="portal-empty">Loading your desk…</p>;
  }

  return (
    <div className="sls-dash">
      <section className="sls-dash-hero">
        <div className="sls-dash-hello">
          <PortalAvatar src={asText(staff.photoUrl, '') || null} name={name} size={72} />
          <div>
            <p className="sls-dash-greet">
              {greeting}, <strong>{name}</strong>
            </p>
            <p className="sls-dash-role">
              {asText(staff.designation, 'Teacher')} | {schoolName}
            </p>
            <p className="sls-dash-motto">“{MOTTO}”</p>
          </div>
        </div>
        <SchoolArt />
        <div className="sls-dash-date">
          <span className="sls-dash-date-ico">
            <CalendarDays className="h-4 w-4" />
          </span>
          <div>
            <strong>{dateLabel.replace(/^(\w+)/, '$1,')}</strong>
            <p>Have a great day!</p>
          </div>
        </div>
        <blockquote className="sls-dash-quote">
          <span>“</span>
          {QUOTE}
          <cite>— Nelson Mandela</cite>
        </blockquote>
      </section>

      <div className="sls-dash-kpis">
        <Kpi
          href={`${BASE}/attendance`}
          tone="sky"
          icon={Users}
          value={asNumber(desk.classCount)}
          label="My Classes"
          hint="Classes assigned"
        />
        <Kpi
          href={`${BASE}/attendance`}
          tone="emerald"
          icon={GraduationCap}
          value={asNumber(desk.studentCount)}
          label="Total Students"
          hint="Across my classes"
        />
        <Kpi
          href={`${BASE}/homework`}
          tone="violet"
          icon={BookOpen}
          value={asNumber(desk.homeworkActive)}
          label="Homework"
          hint="Active assignments"
        />
        <Kpi
          href={`${BASE}/marks`}
          tone="amber"
          icon={FileText}
          value={asNumber(desk.pendingMarkEntry)}
          label="Pending Mark Entry"
          hint="Examinations"
        />
        <Kpi
          href={`${BASE}/leave`}
          tone="rose"
          icon={CalendarDays}
          value={asNumber(desk.leaveRemaining)}
          label="Leave Balance"
          hint="Days remaining"
        />
      </div>

      <div className="sls-dash-grid">
        <section className="portal-card sls-dash-card">
          <div className="sls-dash-card-head">
            <h2>Quick Actions</h2>
          </div>
          <div className="sls-dash-actions">
            <Action
              href={`${BASE}/attendance/mark`}
              icon={ClipboardCheck}
              label="Mark Attendance"
              tone="emerald"
            />
            <Action href={`${BASE}/marks`} icon={FileText} label="Enter Marks" tone="sky" />
            <Action
              href={`${BASE}/homework`}
              icon={NotebookPen}
              label="Create Homework"
              tone="violet"
            />
            <Action
              href={`${BASE}/messages`}
              icon={MessageSquare}
              label="Send Message"
              tone="orange"
            />
            <Action
              href={`${BASE}/timetable`}
              icon={CalendarDays}
              label="View Timetable"
              tone="amber"
            />
            <Action href={`${BASE}/leave`} icon={KeyRound} label="Apply Leave" tone="rose" />
          </div>
        </section>

        <section className="portal-card sls-dash-card">
          <div className="sls-dash-card-head">
            <h2>Today’s Timetable</h2>
            <Link href={`${BASE}/timetable`}>View Full</Link>
          </div>
          {periods.length ? (
            <ol className="sls-dash-periods">
              {periods.slice(0, 6).map((row, i) => (
                <li key={asText(row.id, String(i))}>
                  <span
                    className={cn(
                      'sls-dash-period-n',
                      `is-${toneFor(asText(row.subject, String(i)))}`,
                    )}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <strong>
                      {asText(row.start)} – {asText(row.end)}
                    </strong>
                    <p>{asText(row.subject, 'Period')}</p>
                  </div>
                  <span className="sls-dash-period-meta">
                    {asText(row.classLabel)}
                    {asText(row.room, '') ? ` · ${asText(row.room)}` : ''}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="portal-empty px-0 py-3">No periods scheduled today.</p>
          )}
        </section>

        <section className="portal-card sls-dash-card">
          <div className="sls-dash-card-head">
            <h2>
              {new Date(cal.y, cal.m, 1).toLocaleDateString('en-IN', {
                month: 'long',
                year: 'numeric',
              })}
            </h2>
            <span className="sls-dash-cal-nav">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() =>
                  setCal((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }))
                }
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <Link href={`${BASE}/calendar`}>View All</Link>
              <button
                type="button"
                aria-label="Next month"
                onClick={() =>
                  setCal((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }))
                }
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </span>
          </div>
          <div className="sls-dash-cal">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <span key={d} className="is-head">
                {d}
              </span>
            ))}
            {cells.map((cell, i) => {
              const iso =
                cell.inMonth && cell.day
                  ? `${cal.y}-${String(cal.m + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`
                  : '';
              return (
                <span
                  key={`${iso}-${i}`}
                  className={cn(
                    cell.inMonth && 'is-day',
                    iso === todayIso && 'is-today',
                    eventDays.has(iso) && 'is-event',
                  )}
                >
                  {cell.inMonth ? cell.day : ''}
                </span>
              );
            })}
          </div>
        </section>

        <section className="portal-card sls-dash-card">
          <div className="sls-dash-card-head">
            <h2>Recent Homework</h2>
            <Link href={`${BASE}/homework`}>View All</Link>
          </div>
          {homework.length ? (
            <ul className="sls-dash-hw">
              {homework.map((row) => {
                const tone = toneFor(asText(row.subjectName));
                return (
                  <li key={asText(row.id)}>
                    <span className={cn('sls-dash-hw-ico', `is-${tone}`)}>
                      {initials(asText(row.subjectName, 'HW')).slice(0, 1)}
                    </span>
                    <div>
                      <strong>{asText(row.subjectName)}</strong>
                      <p>{asText(row.title)}</p>
                    </div>
                    <span className="sls-dash-hw-meta">
                      <b>{asText(row.classLabel)}</b>
                      <em>{dueLabel(asText(row.dueDate, ''))}</em>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="portal-empty px-0 py-3">No homework assigned yet.</p>
          )}
        </section>

        <section className="portal-card sls-dash-card">
          <div className="sls-dash-card-head">
            <h2>Class Performance</h2>
            <Link href={`${BASE}/performance`}>View Details</Link>
          </div>
          {selected ? (
            <div className="sls-dash-perf">
              <div
                className="sls-dash-ring"
                style={{ ['--pct' as string]: `${Math.max(0, Math.min(100, percent))}` }}
              >
                <strong>{percent || 0}%</strong>
                <span>Average Attendance</span>
              </div>
              <div className="sls-dash-perf-side">
                <label>
                  <select
                    value={asText(selected.id, '')}
                    onChange={(e) => setClassId(e.target.value)}
                  >
                    {classes.map((row) => (
                      <option key={asText(row.id, '')} value={asText(row.id, '')}>
                        {asText(row.label)}
                      </option>
                    ))}
                  </select>
                </label>
                <ul>
                  <li>
                    <span>Total Students</span>
                    <b>{asNumber(selected.students)}</b>
                  </li>
                  <li className="is-present">
                    <span>Present Today</span>
                    <b>{asNumber(selected.present)}</b>
                  </li>
                  <li className="is-absent">
                    <span>Absent Today</span>
                    <b>{asNumber(selected.absent)}</b>
                  </li>
                  <li className="is-late">
                    <span>Late Today</span>
                    <b>{asNumber(selected.late)}</b>
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <p className="portal-empty px-0 py-3">No class assignments yet.</p>
          )}
        </section>

        <section className="portal-card sls-dash-card">
          <div className="sls-dash-card-head">
            <h2>Notices & Announcements</h2>
            <Link href={`${BASE}/notices`}>View All</Link>
          </div>
          {notices.length ? (
            <ul className="sls-dash-notices">
              {notices.slice(0, 4).map((row, i) => {
                const kind = noticeKind(row);
                return (
                  <li key={asText(row.id ?? row.slug, String(i))}>
                    <span className={cn('sls-dash-chip', `is-${kind.tone}`)}>{kind.label}</span>
                    <div>
                      <strong>{asText(row.title ?? row.name, 'Notice')}</strong>
                      <p>{asText(row.body ?? row.summary ?? row.excerpt, '')}</p>
                    </div>
                    <time>
                      {formatDay(asText(row.publishedAt ?? row.createdAt ?? row.date, ''))}
                    </time>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="portal-empty px-0 py-3">No notices yet.</p>
          )}
        </section>
      </div>

      <p className="sls-dash-foot">
        “{FOOTER_QUOTE}” <cite>— Brad Henry</cite>
      </p>
    </div>
  );
}

function Kpi({
  href,
  tone,
  icon: Icon,
  value,
  label,
  hint,
}: {
  href: string;
  tone: 'sky' | 'emerald' | 'violet' | 'amber' | 'rose';
  icon: typeof Users;
  value: number;
  label: string;
  hint: string;
}) {
  return (
    <Link href={href} className={cn('sls-dash-kpi', `is-${tone}`)}>
      <span className="sls-dash-kpi-ico">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <strong>{value}</strong>
        <p>{label}</p>
        <em>{hint}</em>
      </div>
      <span className="sls-dash-kpi-go">›</span>
    </Link>
  );
}

function Action({
  href,
  icon: Icon,
  label,
  tone,
}: {
  href: string;
  icon: typeof ClipboardCheck;
  label: string;
  tone: string;
}) {
  return (
    <Link href={href} className={cn('sls-dash-action', `is-${tone}`)}>
      <span>
        <Icon className="h-4 w-4" />
      </span>
      {label}
    </Link>
  );
}

function SchoolArt() {
  return (
    <svg className="sls-dash-art" viewBox="0 0 220 120" aria-hidden>
      <rect x="0" y="78" width="220" height="42" fill="#dcfce7" />
      <circle cx="178" cy="28" r="14" fill="#fde68a" />
      <rect x="70" y="38" width="88" height="52" rx="4" fill="#93c5fd" />
      <rect x="98" y="18" width="32" height="22" fill="#60a5fa" />
      <polygon points="92,18 114,4 136,18" fill="#2563eb" />
      <rect x="84" y="50" width="14" height="14" fill="#eff6ff" />
      <rect x="107" y="50" width="14" height="14" fill="#eff6ff" />
      <rect x="130" y="50" width="14" height="14" fill="#eff6ff" />
      <rect x="107" y="70" width="16" height="20" fill="#1d4ed8" />
      <circle cx="42" cy="68" r="16" fill="#86efac" />
      <circle cx="58" cy="72" r="12" fill="#4ade80" />
      <circle cx="188" cy="70" r="14" fill="#86efac" />
      <circle cx="202" cy="76" r="10" fill="#4ade80" />
    </svg>
  );
}
