import { useQuery } from '@tanstack/react-query';
import { Text } from 'react-native';
import { fetchSchoolTimetable } from '@/api/school-mobile';
import { SchoolCard, SchoolEmpty, SchoolShell } from '@/components/school-sis/school-shell';
import { useSchoolSession } from '@/store/school-session';
import { schoolUi } from '@/theme/school-ui';

export default function SchoolTimetableScreen() {
  const childId = useSchoolSession((s) => s.childId);
  const q = useQuery({
    queryKey: ['school-timetable', childId],
    queryFn: () => fetchSchoolTimetable(childId),
  });
  const data = (q.data ?? {}) as Record<string, unknown>;
  const days = Array.isArray(data.days) ? (data.days as Record<string, unknown>[]) : [];
  const slots = Array.isArray(data.slots) ? (data.slots as Record<string, unknown>[]) : [];

  return (
    <SchoolShell title="Timetable" loading={q.isLoading} onRefresh={() => void q.refetch()}>
      {days.length === 0 && slots.length === 0 ? (
        <SchoolEmpty title="No timetable published" body="Your class timetable will appear here." />
      ) : null}
      {days.map((day, i) => (
        <SchoolCard key={i}>
          <Text style={{ fontWeight: '800', color: schoolUi.colors.primary }}>
            {String(day.label ?? day.day ?? `Day ${i + 1}`)}
          </Text>
          {(Array.isArray(day.slots) ? (day.slots as Record<string, unknown>[]) : []).map(
            (s, j) => (
              <Text key={j} style={{ marginTop: 8, fontWeight: '600' }}>
                {String(s.start ?? s.time ?? '')} {String(s.subject ?? '')} {String(s.room ?? '')}
              </Text>
            ),
          )}
        </SchoolCard>
      ))}
      {slots.map((s, i) => (
        <SchoolCard key={`s-${i}`}>
          <Text style={{ fontWeight: '700' }}>
            {String(s.start ?? s.time ?? '')} {String(s.subject ?? s.label ?? '')}
          </Text>
        </SchoolCard>
      ))}
    </SchoolShell>
  );
}
