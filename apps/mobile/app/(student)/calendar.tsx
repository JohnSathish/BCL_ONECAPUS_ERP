import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import { useStudentPortal } from '@/components/student-portal/student-portal-context';
import { studentTheme } from '@/components/student-portal/theme';

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export default function StudentCalendarScreen() {
  const { home } = useStudentPortal();
  const events = home?.calendarEvents ?? [];

  const grouped = useMemo(() => {
    const map = new Map<string, typeof events>();
    for (const event of events) {
      const key = event.date?.slice(0, 10) || 'Upcoming';
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [events]);

  return (
    <StudentScreenShell title="Academic Calendar" subtitle="Events, holidays & dues">
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.section}>Upcoming</Text>
          {grouped.length === 0 ? (
            <Text style={styles.muted}>
              No published calendar events yet. Events appear after Academics → Academic Calendar is
              published.
            </Text>
          ) : (
            grouped.map(([date, list]) => (
              <View key={date} style={styles.dayBlock}>
                <Text style={styles.dayLabel}>{formatDate(date)}</Text>
                {list.map((event) => (
                  <View key={event.id} style={styles.eventRow}>
                    <Text style={styles.eventType}>{event.type ?? 'Event'}</Text>
                    <Text style={styles.rowTitle}>{event.title}</Text>
                    {event.subtitle ? <Text style={styles.rowMeta}>{event.subtitle}</Text> : null}
                  </View>
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </StudentScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 32 },
  card: {
    backgroundColor: studentTheme.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: studentTheme.border,
    gap: 10,
  },
  section: { fontSize: 15, fontWeight: '800', color: studentTheme.text },
  muted: { fontSize: 13, color: studentTheme.textMuted, lineHeight: 18 },
  dayBlock: { gap: 8, paddingTop: 4 },
  dayLabel: { fontSize: 12, fontWeight: '800', color: studentTheme.primary },
  eventRow: {
    borderLeftWidth: 3,
    borderLeftColor: studentTheme.primary,
    paddingLeft: 10,
    gap: 2,
  },
  eventType: {
    fontSize: 10,
    fontWeight: '800',
    color: studentTheme.textSubtle,
    textTransform: 'uppercase',
  },
  rowTitle: { fontSize: 14, fontWeight: '700', color: studentTheme.text },
  rowMeta: { fontSize: 12, color: studentTheme.textMuted },
});
