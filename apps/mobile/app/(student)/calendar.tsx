import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import { useStudentPortal } from '@/components/student-portal/student-portal-context';
import { studentTheme } from '@/components/student-portal/theme';
import { calendarTypeTone } from '@/components/student-portal/category-tones';

function formatDateBlock(iso: string) {
  const d = new Date(iso.includes('T') ? iso : `${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return { day: '--', mon: '—', week: '' };
  }
  return {
    day: String(d.getDate()).padStart(2, '0'),
    mon: d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase(),
    week: d.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase(),
  };
}

export default function StudentCalendarScreen() {
  const { home } = useStudentPortal();
  const events = [...(home?.calendarEvents ?? [])].sort((a, b) =>
    String(a.date).localeCompare(String(b.date)),
  );

  return (
    <StudentScreenShell title="Academic Calendar" subtitle="Events, holidays & dues">
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.section}>Upcoming</Text>
          {events.length === 0 ? (
            <Text style={styles.muted}>
              No published calendar events yet. Events appear after Academics → Academic Calendar is
              published.
            </Text>
          ) : (
            events.map((event, index) => {
              const date = formatDateBlock(event.date);
              const tone = calendarTypeTone(event.type);
              const last = index === events.length - 1;
              return (
                <View key={event.id} style={styles.row}>
                  <View style={styles.dateCol}>
                    <Text style={styles.dateDay}>{date.day}</Text>
                    <Text style={styles.dateMon}>
                      {date.mon} {date.week}
                    </Text>
                    {!last ? <View style={styles.rail} /> : null}
                  </View>
                  <View style={[styles.dot, { backgroundColor: tone.fg }]} />
                  <View style={styles.body}>
                    <View style={styles.bodyTop}>
                      <Text style={styles.eventIcon}>{tone.icon}</Text>
                      <Text style={styles.eventTitle}>{event.title}</Text>
                    </View>
                    {event.subtitle ? <Text style={styles.eventMeta}>{event.subtitle}</Text> : null}
                  </View>
                  <View style={[styles.typePill, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.typePillText, { color: tone.fg }]}>{tone.label}</Text>
                  </View>
                </View>
              );
            })
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
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: studentTheme.border,
    gap: 4,
  },
  section: { fontSize: 16, fontWeight: '800', color: studentTheme.text, marginBottom: 10 },
  muted: { fontSize: 13, color: studentTheme.textMuted, lineHeight: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingBottom: 16,
    minHeight: 64,
  },
  dateCol: { width: 52, position: 'relative' },
  dateDay: { fontSize: 16, fontWeight: '800', color: studentTheme.text, lineHeight: 18 },
  dateMon: {
    fontSize: 9,
    fontWeight: '700',
    color: studentTheme.textMuted,
    marginTop: 2,
  },
  rail: {
    position: 'absolute',
    left: 8,
    top: 36,
    bottom: -16,
    width: 2,
    backgroundColor: '#e2e8f0',
    borderRadius: 1,
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  body: { flex: 1, gap: 2 },
  bodyTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  eventIcon: { fontSize: 14, marginTop: 1 },
  eventTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: studentTheme.text,
    lineHeight: 19,
  },
  eventMeta: { fontSize: 12, color: studentTheme.textMuted, marginLeft: 20, lineHeight: 16 },
  typePill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  typePillText: { fontSize: 10, fontWeight: '800' },
});
