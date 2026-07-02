import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FacultyScreenShell } from '@/components/faculty-portal/faculty-screen-shell';
import { facultyTheme } from '@/components/faculty-portal/theme';
import {
  fetchFacultyTodaySessions,
  type FacultyAttendanceSession,
} from '@/services/faculty-attendance';

function sessionLabel(session: FacultyAttendanceSession) {
  const course = session.course?.title ?? session.course?.code ?? 'Class';
  const time =
    session.startTime && session.endTime ? `${session.startTime} – ${session.endTime}` : 'Time TBD';
  const room = session.location?.roomName ?? session.location?.roomCode;
  return { course, time, room, section: session.section?.sectionCode };
}

export default function FacultyAttendanceScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<FacultyAttendanceSession[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchFacultyTodaySessions();
      setSessions(rows);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = sessions.filter((s) => s.status === 'OPEN' || s.status === 'open').length;

  return (
    <FacultyScreenShell title="Attendance" subtitle="Mark & review class attendance">
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.summary}>
          <Text style={styles.summaryValue}>{pending || sessions.length}</Text>
          <Text style={styles.summaryLabel}>
            {pending > 0 ? 'Sessions pending today' : 'Sessions scheduled today'}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={facultyTheme.primaryLight} style={{ marginTop: 24 }} />
        ) : sessions.length === 0 ? (
          <Text style={styles.empty}>No attendance sessions for today.</Text>
        ) : (
          sessions.map((session) => {
            const meta = sessionLabel(session);
            const counts = session.counts;
            return (
              <Pressable
                key={session.id}
                style={styles.card}
                onPress={() => router.push(`/(staff)/mark-attendance/${session.id}` as never)}
              >
                <Text style={styles.time}>{meta.time}</Text>
                <Text style={styles.title}>{meta.course}</Text>
                <Text style={styles.meta}>
                  {meta.section ? `Section ${meta.section}` : ''}
                  {meta.room ? ` · Room ${meta.room}` : ''}
                </Text>
                {counts ? (
                  <Text style={styles.counts}>
                    Present {counts.present ?? 0} · Absent {counts.absent ?? 0} · Total{' '}
                    {counts.total ?? 0}
                  </Text>
                ) : null}
                <Text style={styles.action}>Take attendance →</Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </FacultyScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10, paddingBottom: 28 },
  summary: {
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  summaryValue: { fontSize: 28, fontWeight: '800', color: facultyTheme.urgent },
  summaryLabel: { fontSize: 12, color: facultyTheme.textMuted, marginTop: 4 },
  empty: { fontSize: 13, color: facultyTheme.textMuted, marginTop: 12 },
  card: {
    backgroundColor: facultyTheme.surface,
    borderRadius: 14,
    padding: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: facultyTheme.border,
  },
  time: { fontSize: 12, fontWeight: '700', color: facultyTheme.primaryLight },
  title: { fontSize: 15, fontWeight: '800', color: facultyTheme.text },
  meta: { fontSize: 12, color: facultyTheme.textMuted },
  counts: { fontSize: 11, color: facultyTheme.textMuted, marginTop: 2 },
  action: { fontSize: 12, fontWeight: '700', color: facultyTheme.primaryLight, marginTop: 6 },
});
