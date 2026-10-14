import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FacultyScreenShell } from '@/components/faculty-portal/faculty-screen-shell';
import { facultyTheme } from '@/components/faculty-portal/theme';
import { fetchMyExamDuties, shareMyExamDutySlip, type MyExamDuty } from '@/services/exam-duties';

export default function ExamDutiesScreen() {
  const [duties, setDuties] = useState<MyExamDuty[]>([]);
  const [examName, setExamName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchMyExamDuties();
      setDuties(data.duties);
      setExamName(data.duties[0]?.examName ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load exam duties');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <FacultyScreenShell title="My Exam Duties" subtitle={examName || 'Published duties only'}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      >
        {loading && !duties.length ? <ActivityIndicator color={facultyTheme.accent} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && !duties.length ? (
          <Text style={styles.empty}>No published invigilation duties are assigned to you.</Text>
        ) : null}
        {duties.map((duty) => (
          <View key={duty.assignmentId} style={styles.card}>
            <Text style={styles.date}>{duty.date}</Text>
            <Text style={styles.session}>
              {duty.session} · {duty.time}
            </Text>
            <Text style={styles.hall}>Hall {duty.hall}</Text>
            <Text style={styles.meta}>Reporting time: {duty.reportingTime || '—'}</Text>
            {duty.instructions ? <Text style={styles.meta}>{duty.instructions}</Text> : null}
          </View>
        ))}
        {duties.length ? (
          <Pressable
            style={styles.button}
            onPress={() =>
              void shareMyExamDutySlip().catch((err) => setError(String(err.message ?? err)))
            }
          >
            <Text style={styles.buttonText}>Download duty slip</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </FacultyScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: '#fff',
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  date: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  session: { marginTop: 4, color: '#1e3a8a', fontWeight: '600' },
  hall: { marginTop: 4, color: '#0f172a' },
  meta: { marginTop: 4, color: '#64748b', fontSize: 13 },
  empty: { margin: 16, color: '#64748b' },
  error: { margin: 16, color: '#b91c1c' },
  button: {
    margin: 16,
    borderRadius: 12,
    backgroundColor: '#0f3c89',
    padding: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700' },
});
