import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { fetchAttendanceRoster, submitAttendanceRoster } from '@/api/school-mobile';
import { SchoolCard, SchoolEmpty, SchoolShell } from '@/components/school-sis/school-shell';
import { schoolUi } from '@/theme/school-ui';

const MARKS = ['PRESENT', 'ABSENT', 'LATE', 'LEAVE'] as const;
const LABELS: Record<string, string> = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  LATE: 'Late',
  LEAVE: 'Leave',
};
const SHORT: Record<string, string> = {
  PRESENT: 'P',
  ABSENT: 'A',
  LATE: 'L',
  LEAVE: 'LV',
};

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function TakeAttendanceRosterScreen() {
  const { sectionId } = useLocalSearchParams<{ sectionId: string }>();
  const date = todayIso();
  const [marks, setMarks] = useState<Record<string, string>>({});
  const roster = useQuery({
    queryKey: ['roster', sectionId, date],
    queryFn: () => fetchAttendanceRoster({ date, sectionId: String(sectionId) }),
    enabled: Boolean(sectionId),
  });

  const students = useMemo(() => {
    const rows = Array.isArray(roster.data?.students)
      ? (roster.data!.students as Record<string, unknown>[])
      : [];
    return rows;
  }, [roster.data]);

  const submit = useMutation({
    mutationFn: async () => {
      const academicYearId = String(
        (roster.data?.academicYear as { id?: string } | undefined)?.id ?? '',
      );
      const records = students.map((s) => {
        const id = String(s.studentId ?? s.id);
        return {
          studentId: id,
          statusCode: marks[id] || String(s.status ?? 'PRESENT'),
        };
      });
      return submitAttendanceRoster({
        academicYearId,
        date,
        sectionId: String(sectionId),
        records,
      });
    },
    onSuccess: () => Alert.alert('Submitted', 'Attendance was saved by the school ERP.'),
    onError: (e) =>
      Alert.alert('Could not submit', e instanceof Error ? e.message : 'Please try again.'),
  });

  function setAll(code: string) {
    const next: Record<string, string> = {};
    for (const s of students) next[String(s.studentId ?? s.id)] = code;
    setMarks(next);
  }

  const counts = students.reduce(
    (acc: { total: number; p: number; a: number; l: number; other: number }, s) => {
      const id = String(s.studentId ?? s.id);
      const code = marks[id] || String(s.status ?? 'PRESENT');
      acc.total += 1;
      if (code === 'PRESENT') acc.p += 1;
      else if (code === 'ABSENT') acc.a += 1;
      else if (code === 'LATE') acc.l += 1;
      else acc.other += 1;
      return acc;
    },
    { total: 0, p: 0, a: 0, l: 0, other: 0 },
  );

  return (
    <SchoolShell title="Mark attendance" loading={roster.isLoading}>
      {students.length === 0 ? (
        <SchoolEmpty title="No students in this section" />
      ) : (
        <>
          <View style={styles.row}>
            <Pressable style={styles.btn} onPress={() => setAll('PRESENT')}>
              <Text style={styles.btnText}>All present</Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={() => setAll('ABSENT')}>
              <Text style={styles.btnText}>All absent</Text>
            </Pressable>
          </View>
          {students.map((s) => {
            const id = String(s.studentId ?? s.id);
            const code = marks[id] || String(s.status ?? 'PRESENT');
            return (
              <SchoolCard key={id}>
                <Text style={styles.name}>{String(s.fullName ?? s.name ?? 'Student')}</Text>
                <View style={styles.row}>
                  {MARKS.map((m) => (
                    <Pressable
                      key={m}
                      onPress={() => setMarks((prev) => ({ ...prev, [id]: m }))}
                      style={[styles.mark, code === m && styles.markOn]}
                    >
                      <Text style={[styles.markText, code === m && styles.markTextOn]}>
                        {SHORT[m]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </SchoolCard>
            );
          })}
          <Pressable
            style={styles.submit}
            onPress={() => {
              Alert.alert(
                'Submit attendance',
                `${counts.total} students · ${counts.p} present · ${counts.a} absent · ${counts.l} late`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Submit', onPress: () => submit.mutate() },
                ],
              );
            }}
          >
            <Text style={styles.submitText}>
              {submit.isPending ? 'Saving…' : 'Submit attendance'}
            </Text>
          </Pressable>
          <Text style={styles.legend}>
            {MARKS.map((m) => `${SHORT[m]} ${LABELS[m]}`).join(' · ')}
          </Text>
        </>
      )}
    </SchoolShell>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  btn: { backgroundColor: '#eef2ff', borderRadius: 12, padding: 10 },
  btnText: { fontWeight: '700', color: schoolUi.colors.primary },
  name: { fontWeight: '800', color: schoolUi.colors.text },
  mark: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  markOn: { backgroundColor: schoolUi.colors.primary },
  markText: { fontWeight: '800', color: schoolUi.colors.text },
  markTextOn: { color: '#fff' },
  submit: {
    backgroundColor: schoolUi.colors.primary,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitText: { color: '#fff', fontWeight: '800' },
  legend: { textAlign: 'center', color: schoolUi.colors.muted, marginTop: 8 },
});
