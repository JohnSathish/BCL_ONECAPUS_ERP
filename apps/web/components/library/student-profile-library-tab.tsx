'use client';

import { useQuery } from '@tanstack/react-query';

import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchStudentLibraryVisits } from '@/services/library';

type Props = { studentId: string };

export function StudentProfileLibraryTab({ studentId }: Props) {
  const enabled = useAuthQueryEnabled();
  const visits = useQuery({
    queryKey: ['library', 'student', studentId, 'visits'],
    queryFn: () => fetchStudentLibraryVisits(studentId),
    enabled: enabled && Boolean(studentId),
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Total visits: {visits.data?.totalVisits ?? 0}</p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left">Date</th>
              <th className="p-2 text-left">Time In</th>
              <th className="p-2 text-left">Time Out</th>
              <th className="p-2 text-left">Duration</th>
            </tr>
          </thead>
          <tbody>
            {visits.data?.items.map((v) => (
              <tr key={v.id} className="border-t">
                <td className="p-2">{new Date(v.entryAt).toLocaleDateString()}</td>
                <td className="p-2">{new Date(v.entryAt).toLocaleTimeString()}</td>
                <td className="p-2">
                  {v.exitAt ? new Date(v.exitAt).toLocaleTimeString() : 'Inside'}
                </td>
                <td className="p-2">{v.durationMinutes ? `${v.durationMinutes} min` : '—'}</td>
              </tr>
            ))}
            {!visits.data?.items.length ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-muted-foreground">
                  No library visits recorded
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
