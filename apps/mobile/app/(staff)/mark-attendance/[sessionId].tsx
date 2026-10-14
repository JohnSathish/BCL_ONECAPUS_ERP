import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AttendanceIdScanner,
  type AttendanceScanFeedback,
} from '@/components/faculty-portal/attendance-id-scanner';
import { FacultyScreenShell } from '@/components/faculty-portal/faculty-screen-shell';
import { facultyTheme } from '@/components/faculty-portal/theme';
import {
  fetchAttendanceRoster,
  markAttendanceSession,
  type AttendanceRosterStudent,
} from '@/services/faculty-attendance';
import { resolveAttendanceScan } from '@/utils/attendance-scan-resolve';

const STATUS_CYCLE = ['P', 'A', 'L'] as const;

export default function MarkAttendanceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('Class');
  const [students, setStudents] = useState<AttendanceRosterStudent[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lastScanNote, setLastScanNote] = useState<string | null>(null);
  const studentsRef = useRef(students);
  studentsRef.current = students;

  const load = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const roster = await fetchAttendanceRoster(sessionId);
      const course = roster.session.course?.title ?? roster.session.course?.code ?? 'Class';
      const section = roster.session.section?.sectionCode;
      setSessionTitle(section ? `${course} · ${section}` : course);
      setStudents(
        roster.students.map((s) => ({
          ...s,
          status: s.status ?? 'P',
        })),
      );
    } catch (e) {
      Alert.alert('Could not load roster', e instanceof Error ? e.message : 'Try again');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [router, sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleStatus(studentId: string) {
    setStudents((rows) =>
      rows.map((row) => {
        if (row.id !== studentId) return row;
        const idx = STATUS_CYCLE.indexOf((row.status ?? 'P') as (typeof STATUS_CYCLE)[number]);
        const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
        return { ...row, status: next };
      }),
    );
  }

  function markAllPresent() {
    setStudents((rows) => rows.map((row) => ({ ...row, status: 'P' })));
  }

  const onScanId = useCallback((raw: string): AttendanceScanFeedback => {
    const matched = resolveAttendanceScan(raw, studentsRef.current);
    if (!matched) {
      return { kind: 'miss', message: 'Student not in this class.' };
    }
    setStudents((rows) =>
      rows.map((row) => (row.id === matched.id ? { ...row, status: 'P' } : row)),
    );
    const note = `Present: ${matched.fullName ?? 'Student'}${
      matched.rollNumber ? ` · ${matched.rollNumber}` : ''
    }`;
    setLastScanNote(note);
    return { kind: 'hit', message: note };
  }, []);

  async function onSave(mode: 'QUICK_PRESENT' | 'MANUAL') {
    if (!sessionId) return;
    setSaving(true);
    try {
      await markAttendanceSession(sessionId, {
        mode,
        entries: students.map((s) => ({
          studentId: s.id,
          status: s.status ?? 'P',
        })),
      });
      Alert.alert('Saved', 'Attendance submitted successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={facultyTheme.primaryLight} />
      </View>
    );
  }

  return (
    <FacultyScreenShell title="Take Attendance" subtitle={sessionTitle}>
      <View style={styles.toolbar}>
        <View style={styles.toolRow}>
          <Pressable style={styles.toolBtn} onPress={markAllPresent}>
            <Text style={styles.toolBtnText}>Mark all present</Text>
          </Pressable>
          <Pressable style={[styles.toolBtn, styles.scanBtn]} onPress={() => setScannerOpen(true)}>
            <Text style={styles.toolBtnText}>Scan ID</Text>
          </Pressable>
        </View>
        <Text style={styles.count}>{students.length} students</Text>
      </View>

      {lastScanNote ? (
        <View style={styles.scanNote}>
          <Text style={styles.scanNoteText}>{lastScanNote}</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}>
        {students.map((student) => (
          <Pressable key={student.id} style={styles.row} onPress={() => toggleStatus(student.id)}>
            <View style={styles.rowText}>
              <Text style={styles.name}>{student.fullName ?? 'Student'}</Text>
              <Text style={styles.roll}>{student.rollNumber ?? '—'}</Text>
            </View>
            <View style={[styles.statusPill, statusStyle(student.status ?? 'P')]}>
              <Text style={styles.statusText}>{student.status ?? 'P'}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={() => void onSave('MANUAL')}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Submit Attendance'}</Text>
        </Pressable>
      </View>

      <AttendanceIdScanner
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={onScanId}
      />
    </FacultyScreenShell>
  );
}

function statusStyle(status: string) {
  if (status === 'P') return { backgroundColor: '#DCFCE7' };
  if (status === 'A') return { backgroundColor: '#FEE2E2' };
  return { backgroundColor: '#FEF3C7' };
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: facultyTheme.background,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  toolRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  toolBtn: {
    backgroundColor: facultyTheme.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  scanBtn: { backgroundColor: facultyTheme.primaryDark },
  toolBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  count: { fontSize: 12, color: facultyTheme.textMuted, fontWeight: '600' },
  scanNote: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#DCFCE7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  scanNoteText: { color: '#166534', fontWeight: '700', fontSize: 13 },
  list: { paddingHorizontal: 16, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: facultyTheme.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: facultyTheme.border,
  },
  rowText: { flex: 1, gap: 2 },
  name: { fontSize: 14, fontWeight: '700', color: facultyTheme.text },
  roll: { fontSize: 12, color: facultyTheme.textMuted },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 36,
    alignItems: 'center',
  },
  statusText: { fontWeight: '800', color: facultyTheme.text },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: facultyTheme.surface,
    borderTopWidth: 1,
    borderTopColor: facultyTheme.border,
  },
  saveBtn: {
    backgroundColor: facultyTheme.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
