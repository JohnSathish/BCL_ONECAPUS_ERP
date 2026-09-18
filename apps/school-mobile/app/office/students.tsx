import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiFetch } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { colors } from '@/theme/tokens';
import { Kpi, OfficeShell } from '@/ui/office-shell';

type Student = {
  id: string;
  fullName: string;
  admissionNumber: string;
  photoUrl?: string | null;
  classLabel: string;
  rollNumber?: string | null;
  phone?: string | null;
  gender?: string | null;
};
type Grade = { id: string; name: string };

export default function OfficeStudents() {
  const [q, setQ] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [grades, setGrades] = useState<Grade[]>([]);
  const [items, setItems] = useState<Student[]>([]);
  const [picked, setPicked] = useState<Student | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback((query: string, grade: string) => {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (grade) params.set('gradeId', grade);
    setLoading(true);
    apiFetch<{ grades: Grade[]; items: Student[] }>(
      `/v1/school-mobile/principal/students?${params.toString()}`,
    )
      .then((data) => {
        setGrades(data.grades ?? []);
        setItems(data.items ?? []);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q, gradeId), 280);
    return () => clearTimeout(t);
  }, [q, gradeId, load]);

  return (
    <OfficeShell
      title="Students"
      subtitle={`${items.length} on this list`}
      loading={loading && !items.length}
      error={error}
    >
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Search name or admission no."
        placeholderTextColor={colors.muted}
        style={styles.search}
      />
      <View style={styles.chips}>
        <Pressable onPress={() => setGradeId('')} style={[styles.chip, !gradeId && styles.chipOn]}>
          <Text style={[styles.chipText, !gradeId && styles.chipTextOn]}>All classes</Text>
        </Pressable>
        {grades.map((g) => (
          <Pressable
            key={g.id}
            onPress={() => setGradeId(g.id)}
            style={[styles.chip, gradeId === g.id && styles.chipOn]}
          >
            <Text style={[styles.chipText, gradeId === g.id && styles.chipTextOn]}>{g.name}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.kpis}>
        <Kpi label="Showing" value={String(items.length)} tint="#eff6ff" />
      </View>
      {picked ? (
        <View style={styles.detail}>
          <Text style={styles.detailName}>{picked.fullName}</Text>
          <Text style={styles.meta}>
            {picked.admissionNumber} · {picked.classLabel}
            {picked.rollNumber ? ` · Roll ${picked.rollNumber}` : ''}
          </Text>
          {picked.phone ? <Text style={styles.meta}>Phone {picked.phone}</Text> : null}
          <Pressable onPress={() => setPicked(null)}>
            <Text style={styles.link}>Close profile</Text>
          </Pressable>
        </View>
      ) : null}
      {items.map((row) => (
        <Pressable key={row.id} onPress={() => setPicked(row)} style={styles.card}>
          {row.photoUrl ? (
            <Image source={{ uri: mediaUrl(row.photoUrl) }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.letter}>{row.fullName.charAt(0)}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{row.fullName}</Text>
            <Text style={styles.meta}>
              {row.classLabel} · {row.admissionNumber}
            </Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </Pressable>
      ))}
    </OfficeShell>
  );
}

const styles = StyleSheet.create({
  search: {
    backgroundColor: '#fff',
    borderRadius: 14,
    height: 46,
    paddingHorizontal: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipOn: { backgroundColor: colors.navy },
  chipText: { fontWeight: '700', color: colors.muted, fontSize: 12 },
  chipTextOn: { color: '#fff' },
  kpis: { flexDirection: 'row' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: { color: colors.navy, fontWeight: '800' },
  name: { fontWeight: '800', color: colors.ink },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  chev: { color: '#c5cbe0', fontSize: 22 },
  detail: { backgroundColor: '#fff', borderRadius: 18, padding: 16 },
  detailName: { fontWeight: '800', fontSize: 18, color: colors.ink },
  link: { color: colors.navy, fontWeight: '700', marginTop: 10 },
});
