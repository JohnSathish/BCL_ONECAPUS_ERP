import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FacultyScreenShell } from '@/components/faculty-portal/faculty-screen-shell';
import { facultyTheme } from '@/components/faculty-portal/theme';
import {
  fetchFacultyWeekTimetable,
  formatTimetableTime,
  groupTimetableByDay,
  type FacultyTimetableSlot,
} from '@/services/faculty-timetable';

function SlotCard({ slot }: { slot: FacultyTimetableSlot }) {
  return (
    <View style={styles.slotCard}>
      <Text style={styles.slotTime}>
        {formatTimetableTime(slot.startTime)} – {formatTimetableTime(slot.endTime)}
      </Text>
      <Text style={styles.slotSubject}>{slot.subject}</Text>
      <Text style={styles.slotMeta}>
        {slot.semesterNo ? `Sem ${slot.semesterNo}` : ''}
        {slot.sectionCode ? ` · Sec ${slot.sectionCode}` : ''}
        {slot.classroom ? ` · ${slot.classroom}` : ''}
        {slot.shiftName ? ` · ${slot.shiftName}` : ''}
      </Text>
    </View>
  );
}

export default function FacultyTimetableScreen() {
  const [loading, setLoading] = useState(true);
  const [planName, setPlanName] = useState<string | null>(null);
  const [days, setDays] = useState<ReturnType<typeof groupTimetableByDay>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchFacultyWeekTimetable();
      setPlanName(data.plan?.name ?? null);
      setDays(groupTimetableByDay(data));
    } catch {
      setPlanName(null);
      setDays([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <FacultyScreenShell title="My Timetable" subtitle="Weekly teaching schedule">
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      >
        {planName ? <Text style={styles.planLabel}>{planName}</Text> : null}

        {loading && days.length === 0 ? (
          <ActivityIndicator color={facultyTheme.primaryLight} style={{ marginTop: 24 }} />
        ) : days.length === 0 ? (
          <Text style={styles.empty}>No published timetable slots found for your account.</Text>
        ) : (
          days.map((day) => (
            <View key={day.dayOfWeek} style={styles.dayBlock}>
              <Text style={styles.dayTitle}>{day.label}</Text>
              {day.slots.map((slot) => (
                <SlotCard key={slot.id} slot={slot} />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </FacultyScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14, paddingBottom: 28 },
  planLabel: { fontSize: 12, fontWeight: '700', color: facultyTheme.primaryLight },
  empty: { fontSize: 13, color: facultyTheme.textMuted, marginTop: 8 },
  dayBlock: { gap: 8 },
  dayTitle: { fontSize: 14, fontWeight: '800', color: facultyTheme.text },
  slotCard: {
    backgroundColor: facultyTheme.surface,
    borderRadius: 14,
    padding: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: facultyTheme.border,
  },
  slotTime: { fontSize: 12, fontWeight: '700', color: facultyTheme.primaryLight },
  slotSubject: { fontSize: 15, fontWeight: '800', color: facultyTheme.text },
  slotMeta: { fontSize: 12, color: facultyTheme.textMuted },
});
