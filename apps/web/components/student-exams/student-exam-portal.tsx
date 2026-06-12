'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Download, Printer, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchMyExamAdmitCard } from '@/services/examinations';

export function StudentExamPortal() {
  const admit = useQuery({
    queryKey: ['student', 'exam-admit-card'],
    queryFn: () => fetchMyExamAdmitCard(),
  });
  const student = admit.data?.student;
  const seats = admit.data?.seats ?? [];
  const papers = admit.data?.papers ?? [];
  const rooms = admit.data?.rooms ?? [];
  const rows = useMemo(
    () =>
      seats.map((seat: any) => ({
        seat,
        paper: papers.find((paper: any) => paper.id === seat.paperId),
        room: rooms.find((room: any) => room.id === seat.classroomId),
      })),
    [papers, rooms, seats],
  );

  const downloadCsv = () => {
    const header = ['Paper Code', 'Paper Name', 'Date', 'Time', 'Room', 'Seat'];
    const body = rows.map(({ seat, paper, room }: any) => [
      paper?.paperCode ?? '',
      paper?.paperName ?? '',
      dateOnly(paper?.examDate),
      `${timeOnly(paper?.startTime)}-${timeOnly(paper?.endTime)}`,
      room ? `${room.code} ${room.name}` : seat.classroomId,
      seat.seatNumber,
    ]);
    const csv = [header, ...body]
      .map((line) =>
        line.map((value: unknown) => `"${String(value).replace(/"/g, '""')}"`).join(','),
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-exam-admit-card.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (admit.isLoading) {
    return (
      <div className="rounded-3xl border border-border/60 bg-card p-6 text-sm text-muted-foreground">
        Loading exam admit card...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-background p-5 shadow-xl shadow-primary/5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Student Examinations
            </p>
            <h1 className="mt-1 text-2xl font-bold">My Admit Card / Hall Ticket</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Your exam timetable, seating room, seat number, and examination instructions.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
            <Button variant="outline" onClick={downloadCsv}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-border/60 bg-card p-5 print:border-0">
        <div className="border-b border-border/60 pb-4 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">BCL OneCampus ERP</p>
          <h2 className="text-2xl font-bold">Examination Admit Card</h2>
          <p className="text-sm text-muted-foreground">
            {admit.data?.session?.name ?? 'Current Examination'}
          </p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Info
            label="Student Name"
            value={student?.masterProfile?.fullName ?? student?.user?.displayName ?? '—'}
          />
          <Info label="Admission No" value={student?.admissionNumber ?? '—'} />
          <Info label="Roll No" value={student?.rollNumber ?? '—'} />
          <Info label="Programme" value={student?.program?.name ?? '—'} />
        </div>

        <div className="mt-5 overflow-auto rounded-2xl border border-border/60">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Paper</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Room</th>
                <th className="px-3 py-2">Seat</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ seat, paper, room }: any) => (
                <tr key={seat.id} className="border-t border-border/60">
                  <td className="px-3 py-2">
                    <p className="font-medium">{paper?.paperCode ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">
                      {paper?.paperName ?? 'Paper pending'}
                    </p>
                  </td>
                  <td className="px-3 py-2">{dateOnly(paper?.examDate)}</td>
                  <td className="px-3 py-2">
                    {timeOnly(paper?.startTime)} - {timeOnly(paper?.endTime)}
                  </td>
                  <td className="px-3 py-2">
                    {room ? `${room.code} · ${room.name}` : seat.classroomId}
                  </td>
                  <td className="px-3 py-2 font-semibold">{seat.seatNumber}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length ? (
            <p className="p-4 text-sm text-muted-foreground">
              No exam seating has been published for you yet.
            </p>
          ) : null}
        </div>

        <div className="mt-5 rounded-2xl border border-border/60 bg-muted/20 p-4">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <Ticket className="h-4 w-4" />
            Instructions
          </div>
          <p className="text-sm text-muted-foreground">{admit.data?.instructions}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Bring your college ID card. Report at least 30 minutes before exam start time. Mobile
            phones and unauthorized materials are not allowed.
          </p>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <Kpi icon={<CalendarDays />} label="Papers" value={rows.length} />
        <Kpi icon={<Ticket />} label="Seats" value={seats.length} />
        <Kpi icon={<Printer />} label="Printable Admit Card" value="Ready" />
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-3xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
        <span className="rounded-2xl bg-primary/10 p-3 text-primary">{icon}</span>
      </div>
    </div>
  );
}

function dateOnly(value?: string) {
  return value ? String(value).slice(0, 10) : '—';
}

function timeOnly(value?: string) {
  if (!value) return '—';
  if (/^\d{2}:\d{2}/.test(String(value))) return String(value).slice(0, 5);
  return new Date(value).toISOString().slice(11, 16);
}
