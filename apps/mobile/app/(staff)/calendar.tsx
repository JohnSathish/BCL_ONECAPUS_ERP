import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { FacultyScreenShell } from '@/components/faculty-portal/faculty-screen-shell';
import { useFacultyPortal } from '@/components/faculty-portal/faculty-portal-context';
import { facultyTheme } from '@/components/faculty-portal/theme';

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export default function FacultyCalendarScreen() {
  const { home } = useFacultyPortal();
  const { width } = useWindowDimensions();
  const events = home?.calendarEvents ?? [];
  const todayClasses = home?.todayClasses ?? [];

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
    <FacultyScreenShell title="My Calendar" subtitle="Classes, events & deadlines">
      <ScrollView
        contentContainerStyle={[styles.container, { paddingHorizontal: width < 360 ? 12 : 16 }]}
      >
        <View style={styles.card}>
          <Text style={styles.section}>Today&apos;s Classes</Text>
          {todayClasses.length === 0 ? (
            <Text style={styles.muted}>No classes scheduled for today.</Text>
          ) : (
            todayClasses.map((c) => (
              <View key={c.id} style={styles.row}>
                <View style={styles.timePill}>
                  <Text style={styles.timeText}>
                    {c.startTime}–{c.endTime}
                  </Text>
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{c.subject}</Text>
                  <Text style={styles.rowMeta}>
                    {[c.sectionCode, c.classroom, c.shiftName].filter(Boolean).join(' · ') || '—'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Upcoming Events</Text>
          {grouped.length === 0 ? (
            <Text style={styles.muted}>No calendar events from the portal yet.</Text>
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
    </FacultyScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 16, gap: 12, paddingBottom: 32 },
  card: {
    backgroundColor: facultyTheme.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: facultyTheme.border,
    gap: 10,
  },
  section: { fontSize: 15, fontWeight: '800', color: facultyTheme.text },
  muted: { fontSize: 13, color: facultyTheme.textMuted },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  timePill: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: 88,
  },
  timeText: { fontSize: 11, fontWeight: '800', color: facultyTheme.primary },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: facultyTheme.text },
  rowMeta: { fontSize: 12, color: facultyTheme.textMuted },
  dayBlock: { gap: 8, paddingTop: 4 },
  dayLabel: { fontSize: 12, fontWeight: '800', color: facultyTheme.primaryLight },
  eventRow: {
    borderLeftWidth: 3,
    borderLeftColor: facultyTheme.primary,
    paddingLeft: 10,
    gap: 2,
  },
  eventType: {
    fontSize: 10,
    fontWeight: '800',
    color: facultyTheme.textSubtle,
    textTransform: 'uppercase',
  },
});
