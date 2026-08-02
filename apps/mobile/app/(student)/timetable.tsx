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
import { WeeklyTimetablePanel } from '@/components/student-portal/weekly-timetable-panel';
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

  const shift = data?.header?.shift?.trim();
  const sem = data?.header?.semesterLabel;

  return (
    <StudentScreenShell title="My Timetable" subtitle="Weekly class schedule">
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        showsVerticalScrollIndicator={false}
      >
        {loading && !data ? (
          <ActivityIndicator color={studentTheme.primary} style={{ marginTop: 24 }} />
        ) : (
          <>
            {(shift || sem) && (
              <View style={styles.metaCard}>
                {sem ? <Text style={styles.metaPrimary}>{sem}</Text> : null}
                {shift ? <Text style={styles.metaSecondary}>{shift}</Text> : null}
              </View>
            )}

            <Text style={styles.sectionTitle}>Weekly Timetable</Text>
            <WeeklyTimetablePanel
              weeklyTimetable={data?.weeklyTimetable ?? []}
              todayClasses={data?.todayClasses}
            />
          </>
        )}
      </ScrollView>
    </StudentScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 36 },
  metaCard: {
    backgroundColor: studentTheme.primary,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
  },
  metaPrimary: { color: '#fff', fontSize: 15, fontWeight: '800' },
  metaSecondary: { color: '#bfdbfe', fontSize: 12, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: studentTheme.text },
});
