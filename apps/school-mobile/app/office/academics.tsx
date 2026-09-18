import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { apiFetch } from '@/api/client';
import { colors } from '@/theme/tokens';
import { Kpi, OfficeShell, RowCard } from '@/ui/office-shell';

type ClassRow = {
  id: string;
  label: string;
  grade: string;
  students: number;
  classTeacher?: string | null;
};

export default function OfficeAcademics() {
  const router = useRouter();
  const [year, setYear] = useState('');
  const [subjects, setSubjects] = useState(0);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      apiFetch<{ year?: { name: string }; subjects: number; classes: ClassRow[] }>(
        '/v1/school-mobile/principal/academics',
      )
        .then((data) => {
          setYear(data.year?.name ?? '');
          setSubjects(data.subjects ?? 0);
          setClasses(data.classes ?? []);
          setError(null);
        })
        .catch((err: Error) => setError(err.message))
        .finally(() => setLoading(false));
    }, []),
  );

  const students = classes.reduce((s, c) => s + (c.students ?? 0), 0);

  return (
    <OfficeShell
      title="Academics"
      subtitle={year || 'Classes, sections and teachers'}
      loading={loading}
      error={error}
      action={
        <Pressable onPress={() => router.push('/timetable')}>
          <Text style={styles.link}>Timetable</Text>
        </Pressable>
      }
    >
      <View style={styles.kpis}>
        <Kpi label="Classes" value={String(classes.length)} tint="#fff7ed" />
        <Kpi label="Students" value={String(students)} tint="#eff6ff" />
        <Kpi label="Subjects" value={String(subjects)} tint="#ecfdf5" />
      </View>
      {classes.map((row) => (
        <RowCard
          key={row.id}
          title={row.label}
          meta={`${row.students} students${row.classTeacher ? ` · ${row.classTeacher}` : ''}`}
          onPress={() => router.push('/office/students')}
        />
      ))}
    </OfficeShell>
  );
}

const styles = StyleSheet.create({
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  link: { color: '#fff', fontWeight: '700' },
});
