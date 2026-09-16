import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pressable, Text } from 'react-native';
import { fetchSchoolCalendar } from '@/api/school-mobile';
import { SchoolCard, SchoolEmpty, SchoolShell } from '@/components/school-sis/school-shell';
import { schoolUi } from '@/theme/school-ui';

export default function SchoolCalendarScreen() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const q = useQuery({
    queryKey: ['school-cal', year, month],
    queryFn: () => fetchSchoolCalendar(year, month),
  });
  const days = Array.isArray(q.data?.days) ? (q.data!.days as Record<string, unknown>[]) : [];
  const events = Array.isArray(q.data?.events) ? (q.data!.events as Record<string, unknown>[]) : [];
  return (
    <SchoolShell title="Academic calendar" loading={q.isLoading} onRefresh={() => void q.refetch()}>
      <SchoolCard>
        <Text style={{ fontWeight: '800', fontSize: 18 }}>
          {now.toLocaleString('en-IN', { month: 'long' })} {year}
        </Text>
        <Pressable
          onPress={() => {
            if (month === 1) {
              setMonth(12);
              setYear((y) => y - 1);
            } else setMonth((m) => m - 1);
          }}
        >
          <Text style={{ color: schoolUi.colors.primary, marginTop: 8 }}>Previous month</Text>
        </Pressable>
      </SchoolCard>
      {events.length === 0 && days.length === 0 ? (
        <SchoolEmpty title="No events this month" />
      ) : (
        events.slice(0, 30).map((e, i) => (
          <SchoolCard key={i}>
            <Text style={{ fontWeight: '700' }}>{String(e.title ?? e.name ?? 'Event')}</Text>
            <Text style={{ color: schoolUi.colors.muted }}>
              {String(e.date ?? e.startsAt ?? '')}
            </Text>
          </SchoolCard>
        ))
      )}
    </SchoolShell>
  );
}
