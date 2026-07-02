import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import { studentTheme } from '@/components/student-portal/theme';
import { fetchStudentAcademics } from '@/services/academics';
import type { StudentAcademicsPayload } from '@/types/academics';

export default function StudentTimetableScreen() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StudentAcademicsPayload | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await fetchStudentAcademics();
      setData(payload);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const todayClasses = data?.todayClasses ?? [];
  const weeklyDays = (data?.weeklyTimetable ?? []).filter((day) => day.slots.length > 0);

  return (
    <StudentScreenShell title="Timetable" subtitle="Your weekly class schedule">
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      >
        {loading && !data ? (
          <ActivityIndicator color={studentTheme.primary} style={{ marginTop: 24 }} />
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Today's Classes</Text>
              {todayClasses.length === 0 ? (
                <Text style={styles.muted}>No classes scheduled for today.</Text>
              ) : (
                todayClasses.map((slot) => (
                  <View
                    key={`${slot.time}-${slot.title}`}
                    style={[styles.slotRow, slot.isCurrent && styles.slotRowCurrent]}
                  >
                    <Text style={styles.slotTime}>{slot.time}</Text>
                    <View style={styles.slotBody}>
                      <Text style={styles.slotTitle}>{slot.title}</Text>
                      {slot.room ? <Text style={styles.slotMeta}>Room {slot.room}</Text> : null}
                      {slot.isCurrent ? <Text style={styles.liveBadge}>Now</Text> : null}
                    </View>
                  </View>
                ))
              )}
            </View>

            <Text style={styles.sectionTitle}>Weekly Schedule</Text>
            {weeklyDays.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.muted}>
                  No published timetable slots found for your registered sections.
                </Text>
              </View>
            ) : (
              weeklyDays.map((day) => (
                <View key={day.day} style={styles.card}>
                  <Text style={styles.dayTitle}>{day.day}</Text>
                  {day.slots.map((slot) => (
                    <View key={`${day.day}-${slot.time}-${slot.title}`} style={styles.slotRow}>
                      <Text style={styles.slotTime}>{slot.time}</Text>
                      <View style={styles.slotBody}>
                        <Text style={styles.slotTitle}>{slot.title}</Text>
                        {slot.room ? <Text style={styles.slotMeta}>Room {slot.room}</Text> : null}
                      </View>
                    </View>
                  ))}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </StudentScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 28 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: studentTheme.text },
  card: {
    backgroundColor: studentTheme.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: studentTheme.border,
    gap: 8,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: studentTheme.text },
  muted: { fontSize: 13, color: studentTheme.textMuted },
  dayTitle: { fontSize: 14, fontWeight: '800', color: studentTheme.primaryLight, marginBottom: 4 },
  slotRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  slotRowCurrent: {
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 0,
  },
  slotTime: { width: 88, fontSize: 12, fontWeight: '700', color: studentTheme.primaryLight },
  slotBody: { flex: 1, gap: 2 },
  slotTitle: { fontSize: 14, fontWeight: '700', color: studentTheme.text },
  slotMeta: { fontSize: 12, color: studentTheme.textMuted },
  liveBadge: {
    alignSelf: 'flex-start',
    marginTop: 2,
    fontSize: 10,
    fontWeight: '800',
    color: studentTheme.success,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
});
