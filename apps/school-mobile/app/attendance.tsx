import { StyleSheet, Text, View } from 'react-native';
import { EmptyState, Feed, Screen } from '@/ui/kit';
import { colors, radii } from '@/theme/tokens';

const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AttendanceScreen() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];

  return (
    <Screen title="Attendance" onBack>
      <Feed>
        <Text style={styles.month}>
          {now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
        </Text>
        <View style={styles.stats}>
          <View style={[styles.stat, { backgroundColor: '#e9f8ee' }]}>
            <Text style={[styles.statN, { color: '#1b7a3d' }]}>—</Text>
            <Text style={styles.statL}>Present</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: '#fdecec' }]}>
            <Text style={[styles.statN, { color: '#c0392b' }]}>—</Text>
            <Text style={styles.statL}>Absent</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: '#fff6db' }]}>
            <Text style={[styles.statN, { color: '#b8860b' }]}>—</Text>
            <Text style={styles.statL}>Leave</Text>
          </View>
        </View>
        <View style={styles.cal}>
          {WEEK.map((d) => (
            <Text key={d} style={styles.wd}>
              {d}
            </Text>
          ))}
          {cells.map((day, i) => (
            <View key={i} style={styles.cell}>
              {day ? <Text style={styles.day}>{day}</Text> : null}
            </View>
          ))}
        </View>
        <EmptyState
          title="Attendance will appear here"
          body="Class attendance is marked in the school ERP. Daily present / absent / leave will fill this calendar once it is enabled."
        />
      </Feed>
    </Screen>
  );
}

const styles = StyleSheet.create({
  month: { fontSize: 18, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, borderRadius: radii.lg, padding: 12, alignItems: 'center' },
  statN: { fontSize: 22, fontWeight: '800' },
  statL: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  cal: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#fff',
    borderRadius: radii.lg,
    padding: 8,
  },
  wd: {
    width: '14.28%',
    textAlign: 'center',
    color: colors.muted,
    fontWeight: '700',
    paddingVertical: 6,
    fontSize: 11,
  },
  cell: { width: '14.28%', height: 36, alignItems: 'center', justifyContent: 'center' },
  day: { color: colors.ink, fontWeight: '600' },
});
