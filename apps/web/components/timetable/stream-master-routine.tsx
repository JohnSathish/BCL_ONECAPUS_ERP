'use client';

import type { StreamMasterRoutine } from '@/services/timetable';
import { cn } from '@/utils/cn';

const categoryClass: Record<string, string> = {
  MAJOR: 'bg-blue-500/10 text-blue-800 dark:text-blue-100',
  MINOR: 'bg-violet-500/10 text-violet-800 dark:text-violet-100',
  MDC: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-100',
  AEC: 'bg-amber-500/10 text-amber-800 dark:text-amber-100',
  SEC: 'bg-cyan-500/10 text-cyan-800 dark:text-cyan-100',
  VAC: 'bg-rose-500/10 text-rose-800 dark:text-rose-100',
  VTC: 'bg-indigo-500/10 text-indigo-800 dark:text-indigo-100',
  LAB: 'bg-slate-500/10 text-slate-800 dark:text-slate-100',
};

export function StreamMasterRoutineView({ routine }: { routine?: StreamMasterRoutine }) {
  if (!routine) {
    return (
      <div className="rounded-3xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Select or generate a timetable plan to view the consolidated stream master routine.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {routine.streams.map((stream) => (
        <section key={stream.code} className="overflow-hidden rounded-3xl border bg-card shadow-sm">
          <div className="border-b bg-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              {routine.semesterMode} mode · Sem {routine.semesterRows.join(', ')}
            </p>
            <h2 className="mt-1 text-xl font-semibold">{stream.name} Master Routine</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Departments: {stream.departments.join(', ')} · Entries {stream.summary.totalEntries}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] border-collapse text-xs">
              <thead>
                <tr className="bg-muted/40">
                  <th className="w-36 border px-3 py-2 text-left">Time</th>
                  <th className="w-24 border px-3 py-2 text-left">Semester</th>
                  {routine.days.map((day) => (
                    <th key={day.value} className="border px-3 py-2 text-left">
                      {day.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stream.rows.map((block) =>
                  block.semesters.map((semester, index) => (
                    <tr
                      key={`${block.id}-${semester.semester}`}
                      className={cn(block.isBreak || block.isLunch ? 'bg-amber-500/10' : '')}
                    >
                      {index === 0 ? (
                        <td
                          rowSpan={block.semesters.length}
                          className="border px-3 py-2 align-top font-semibold"
                        >
                          <div>
                            {block.startTime}-{block.endTime}
                          </div>
                          <div className="text-[10px] uppercase text-muted-foreground">
                            {block.label}
                          </div>
                          {block.allowedCategories?.length ? (
                            <div className="mt-1 rounded-full bg-primary/10 px-2 py-1 text-[10px] text-primary">
                              {block.allowedCategories.join(', ')} only
                            </div>
                          ) : null}
                        </td>
                      ) : null}
                      <td className="border px-3 py-2 font-medium">{semester.label}</td>
                      {semester.days.map((day) => (
                        <td key={day.dayOfWeek} className="border px-2 py-2 align-top">
                          <div className="space-y-1">
                            {day.entries.length ? (
                              day.entries.map((entry) => (
                                <div
                                  key={entry.id}
                                  className={cn(
                                    'rounded-xl border border-border/60 p-2',
                                    categoryClass[String(entry.category ?? '').toUpperCase()] ??
                                      'bg-muted/30',
                                  )}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold">{entry.courseCode}</span>
                                    <span>{entry.facultyInitial}</span>
                                  </div>
                                  <div className="mt-1 line-clamp-2 text-[11px]">
                                    {entry.courseTitle}
                                  </div>
                                  <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                                    {entry.category ? <span>{entry.category}</span> : null}
                                    {entry.roomCode ? <span>{entry.roomCode}</span> : null}
                                    {entry.isCombined ? <span>Combined</span> : null}
                                    {entry.parallelGroupId ? <span>Parallel</span> : null}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </td>
                      ))}
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
