'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Calculator,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  FlaskConical,
  GraduationCap,
  Leaf,
  MapPin,
  Monitor,
  Palette,
  PenLine,
  Users,
} from 'lucide-react';
import { fetchSchoolPortalTimetable } from '@/services/school-sis-portal';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { cn } from '@/utils/cn';
import { usePortalData } from './portal-data';
import { asList, asRecord, asText, clock12, hhmmToMinutes } from './portal-utils';

const DAYS = [
  { n: 1, short: 'Mon' },
  { n: 2, short: 'Tue' },
  { n: 3, short: 'Wed' },
  { n: 4, short: 'Thu' },
  { n: 5, short: 'Fri' },
  { n: 6, short: 'Sat' },
] as const;

const SUBJECT_TONES = [
  { card: 'sls-tt-tone-emerald', cell: 'sls-tt-cell-emerald' },
  { card: 'sls-tt-tone-blue', cell: 'sls-tt-cell-blue' },
  { card: 'sls-tt-tone-violet', cell: 'sls-tt-cell-violet' },
  { card: 'sls-tt-tone-amber', cell: 'sls-tt-cell-amber' },
  { card: 'sls-tt-tone-cyan', cell: 'sls-tt-cell-cyan' },
  { card: 'sls-tt-tone-orange', cell: 'sls-tt-cell-orange' },
  { card: 'sls-tt-tone-rose', cell: 'sls-tt-cell-rose' },
];

type Slot = {
  id: string;
  dayOfWeek: number;
  subject: string;
  classLabel: string;
  sectionId: string;
  start: string;
  end: string;
  sort: number;
  room: string;
  kind: string;
};

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIso(value: string) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function mondayOf(d: Date) {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, n: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function toneFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash + name.charCodeAt(i) * (i + 1)) % 997;
  return SUBJECT_TONES[hash % SUBJECT_TONES.length];
}

function subjectIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes('math')) return Calculator;
  if (n.includes('sci')) return FlaskConical;
  if (n.includes('art') || n.includes('draw')) return Palette;
  if (n.includes('comp') || n.includes('ict')) return Monitor;
  if (n.includes('evs') || n.includes('enviro')) return Leaf;
  if (n.includes('garo') || n.includes('khasi') || n.includes('lang')) return PenLine;
  if (n.includes('read') || n.includes('english') || n.includes('liter')) return BookOpen;
  return BookOpen;
}

function monthStartPad(year: number, month: number) {
  const dow = new Date(year, month, 1).getDay();
  return dow === 0 ? 6 : dow - 1;
}

function classLabel(slot: Record<string, unknown>) {
  const section = asRecord(slot.section);
  const grade = asRecord(section.grade);
  return `${asText(grade.name, '')} ${asText(section.name, '')}`.trim() || 'Class';
}

function mapSlot(raw: Record<string, unknown>): Slot {
  const bell = asRecord(raw.bell);
  const subject = asRecord(raw.subject);
  return {
    id: asText(raw.id, `${raw.dayOfWeek}-${bell.startTime}`),
    dayOfWeek: Number(raw.dayOfWeek) || 0,
    subject: asText(subject.name ?? raw.printedSubject, 'Period'),
    classLabel: classLabel(raw),
    sectionId: asText(asRecord(raw.section).id, ''),
    start: asText(bell.startTime, ''),
    end: asText(bell.endTime, ''),
    sort: Number(bell.sortOrder) || hhmmToMinutes(asText(bell.startTime, '00:00')),
    room: asText(raw.roomLabel, ''),
    kind: asText(bell.kind, 'PERIOD'),
  };
}

export function StaffTimetablePage() {
  const authed = useAuthQueryEnabled();
  const { home } = usePortalData();
  const [date, setDate] = useState(isoDate(new Date()));
  const [sectionId, setSectionId] = useState('all');
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  const [weekOffset, setWeekOffset] = useState(0);

  const q = useQuery({
    queryKey: ['staff-tt'],
    queryFn: () => fetchSchoolPortalTimetable(),
    enabled: authed,
  });

  const allSlots = useMemo(() => {
    const fromGrid = asList(asRecord(q.data).slots).map((row) => mapSlot(asRecord(row)));
    if (fromGrid.length) return fromGrid.filter((slot) => slot.kind !== 'BREAK');
    return asList(asRecord(home?.desk).todaySchedule).map((row, i) => {
      const item = asRecord(row);
      return {
        id: asText(item.id, String(i)),
        dayOfWeek: new Date().getDay() || 7,
        subject: asText(item.subject, 'Period'),
        classLabel: asText(item.classLabel, 'Class'),
        sectionId: asText(item.id, ''),
        start: asText(item.start, ''),
        end: asText(item.end, ''),
        sort: i,
        room: '',
        kind: 'PERIOD',
      } satisfies Slot;
    });
  }, [q.data, home?.desk]);

  const classes = useMemo(() => {
    const map = new Map<string, string>();
    for (const slot of allSlots) {
      if (slot.sectionId) map.set(slot.sectionId, slot.classLabel);
    }
    return [...map.entries()].map(([id, label]) => ({ id, label }));
  }, [allSlots]);

  const selected = parseIso(date);
  const weekStart = addDays(mondayOf(selected), weekOffset * 7);
  const weekDays = DAYS.map((day, i) => ({
    ...day,
    date: addDays(weekStart, i),
  }));
  const selectedDow = selected.getDay() === 0 ? 7 : selected.getDay();

  const slots = sectionId === 'all' ? allSlots : allSlots.filter((s) => s.sectionId === sectionId);
  const todaySlots = slots
    .filter((slot) => slot.dayOfWeek === selectedDow)
    .sort((a, b) => a.sort - b.sort);
  const bells = useMemo(() => {
    const map = new Map<string, { start: string; end: string; sort: number }>();
    for (const slot of slots) {
      const key = `${slot.start}-${slot.end}`;
      if (!map.has(key)) map.set(key, { start: slot.start, end: slot.end, sort: slot.sort });
    }
    return [...map.values()].sort((a, b) => a.sort - b.sort);
  }, [slots]);

  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
  const isToday = date === isoDate(new Date()) && weekOffset === 0;
  const subjects = new Set(todaySlots.map((s) => s.subject));
  const currentRoom =
    todaySlots.find(
      (slot) =>
        isToday && hhmmToMinutes(slot.start) <= nowMins && nowMins < hhmmToMinutes(slot.end),
    )?.room ||
    todaySlots[0]?.room ||
    '—';
  const classChip =
    sectionId === 'all'
      ? (classes[0]?.label ?? 'All classes')
      : (classes.find((c) => c.id === sectionId)?.label ?? '');

  const cell = (day: number, start: string, end: string) =>
    slots.find((s) => s.dayOfWeek === day && s.start === start && s.end === end);

  return (
    <div className="sls-tt">
      <div className="sls-tt-head">
        <div>
          <h1>Timetable</h1>
          <p>View your class timetable and upcoming classes</p>
        </div>
        <div className="sls-tt-tools">
          <label className="sls-tt-date">
            <CalendarDays className="h-4 w-4" />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value || date)} />
          </label>
          <select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
            <option value="all">All classes</option>
            {classes.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
          </select>
          <div className="sls-tt-views">
            {(['day', 'week', 'month'] as const).map((key) => (
              <button
                key={key}
                type="button"
                className={cn(view === key && 'is-on')}
                onClick={() => setView(key)}
              >
                {key[0].toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view !== 'month' ? (
        <section className="sls-tt-hero">
          <div>
            <p className="sls-tt-kicker">
              <CalendarDays className="h-4 w-4" /> Today’s Timetable
            </p>
            <p className="sls-tt-when">
              {selected.toLocaleDateString('en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
            {classChip ? <span className="sls-tt-class-pill">{classChip}</span> : null}
          </div>
          <p className="sls-tt-quote">“A good education is a foundation for a better tomorrow.”</p>
          <div className="sls-tt-hero-art" aria-hidden>
            <BookOpen />
          </div>
        </section>
      ) : null}

      {view !== 'month' ? (
        <div className="sls-tt-today">
          {todaySlots.length ? (
            todaySlots.map((slot, i) => {
              const current =
                isToday &&
                hhmmToMinutes(slot.start) <= nowMins &&
                nowMins < hhmmToMinutes(slot.end);
              const tone = toneFor(slot.subject);
              const Icon = subjectIcon(slot.subject);
              return (
                <article
                  key={slot.id}
                  className={cn('sls-tt-period', tone.card, current && 'is-current')}
                >
                  <div className="sls-tt-num">{i + 1}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3>{slot.subject}</h3>
                      {current ? <span className="sls-tt-live">Current</span> : null}
                    </div>
                    <p className="sls-tt-meta">
                      {clock12(slot.start)} – {clock12(slot.end)}
                    </p>
                    <p className="sls-tt-meta">
                      <Users className="h-3.5 w-3.5" />
                      {slot.classLabel}
                    </p>
                    {slot.room ? (
                      <p className="sls-tt-meta">
                        <MapPin className="h-3.5 w-3.5" />
                        {slot.room}
                      </p>
                    ) : null}
                  </div>
                  <Icon className="sls-tt-subj-ico" />
                </article>
              );
            })
          ) : (
            <p className="portal-empty portal-card w-full">No periods on this day.</p>
          )}
        </div>
      ) : null}

      {view !== 'month' ? (
        <section className="sls-tt-week portal-card">
          <div className="sls-tt-week-head">
            <div>
              <h2>Weekly Timetable</h2>
              <p>View your complete weekly schedule</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="sls-tt-chip">This Week</span>
              <button
                type="button"
                aria-label="Previous week"
                onClick={() => setWeekOffset((n) => n - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Next week"
                onClick={() => setWeekOffset((n) => n + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="sls-tt-grid-wrap">
            <table className="sls-tt-grid">
              <thead>
                <tr>
                  <th>Time</th>
                  {weekDays.map((day) => (
                    <th
                      key={day.n}
                      className={cn(day.n === selectedDow && weekOffset === 0 && 'is-today')}
                    >
                      <span>{day.short}</span>
                      <em>
                        {day.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </em>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bells.map((bell) => (
                  <tr key={`${bell.start}-${bell.end}`}>
                    <th>
                      {bell.start.slice(0, 5)} – {bell.end.slice(0, 5)}
                    </th>
                    {weekDays.map((day) => {
                      const hit = cell(day.n, bell.start, bell.end);
                      if (!hit) return <td key={day.n} />;
                      const tone = toneFor(hit.subject);
                      return (
                        <td key={day.n}>
                          <div className={cn('sls-tt-cell', tone.cell)}>
                            <strong>{hit.subject}</strong>
                            <span>{hit.classLabel}</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {view === 'month' ? (
        <section className="portal-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Monthly overview</h2>
          <div className="grid grid-cols-7 gap-2 text-center text-xs">
            {DAYS.map((day) => (
              <div key={day.n} className="font-semibold text-slate-500">
                {day.short}
              </div>
            ))}
            {Array.from({ length: monthStartPad(selected.getFullYear(), selected.getMonth()) }).map(
              (_, i) => (
                <div key={`pad-${i}`} />
              ),
            )}
            {Array.from({
              length: new Date(selected.getFullYear(), selected.getMonth() + 1, 0).getDate(),
            }).map((_, i) => {
              const d = new Date(selected.getFullYear(), selected.getMonth(), i + 1);
              const dow = d.getDay() === 0 ? 7 : d.getDay();
              const count = slots.filter((s) => s.dayOfWeek === dow).length;
              const on = isoDate(d) === date;
              return (
                <button
                  key={i}
                  type="button"
                  className={cn('rounded-xl border px-1 py-2', on && 'border-sky-400 bg-sky-50')}
                  onClick={() => setDate(isoDate(d))}
                >
                  <div className="font-semibold">{i + 1}</div>
                  <div className="text-[10px] text-slate-500">{count} classes</div>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="sls-tt-stats">
        <div className="sls-tt-stat">
          <span className="sls-tt-stat-ico sls-tt-stat-blue">
            <Clock className="h-4 w-4" />
          </span>
          <div>
            <p>Total Classes Today</p>
            <strong>{todaySlots.length}</strong>
            <em>Scheduled classes</em>
          </div>
        </div>
        <div className="sls-tt-stat">
          <span className="sls-tt-stat-ico sls-tt-stat-green">
            <Calculator className="h-4 w-4" />
          </span>
          <div>
            <p>Subjects</p>
            <strong>{subjects.size}</strong>
            <em>Different subjects</em>
          </div>
        </div>
        <div className="sls-tt-stat">
          <span className="sls-tt-stat-ico sls-tt-stat-navy">
            <MapPin className="h-4 w-4" />
          </span>
          <div>
            <p>Classroom</p>
            <strong>{currentRoom === '—' ? '—' : currentRoom}</strong>
            <em>Current location</em>
          </div>
        </div>
        <div className="sls-tt-stat sls-tt-stat-quote">
          <GraduationCap className="h-5 w-5" />
          “Discipline today leads to success tomorrow.”
        </div>
      </div>
    </div>
  );
}
