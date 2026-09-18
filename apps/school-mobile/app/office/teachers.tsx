import { useCallback, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiFetch } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { colors } from '@/theme/tokens';
import { Kpi, OfficeShell } from '@/ui/office-shell';

type Teacher = {
  id: string;
  fullName: string;
  employeeCode: string;
  designation?: string | null;
  department?: string | null;
  phone?: string | null;
  email?: string | null;
  photoUrl?: string | null;
  classAssigned?: string | null;
  teachingExperience?: string | null;
  academicQualification?: string | null;
};

export default function OfficeTeachers() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Teacher[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback((query: string) => {
    const params = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
    setLoading(true);
    apiFetch<{ items: Teacher[] }>(`/v1/school-mobile/principal/teachers${params}`)
      .then((data) => {
        setItems(data.items ?? []);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(q);
    }, [load, q]),
  );

  return (
    <OfficeShell
      title="Teachers"
      subtitle="Teaching staff of St. Luke’s"
      loading={loading && !items.length}
      error={error}
    >
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Search teacher, designation or code"
        placeholderTextColor={colors.muted}
        style={styles.search}
      />
      <View style={styles.kpis}>
        <Kpi label="Teachers" value={String(items.length)} tint="#ecfdf5" />
      </View>
      {items.map((row) => (
        <View key={row.id} style={styles.card}>
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
              {[row.designation, row.department, row.classAssigned].filter(Boolean).join(' · ') ||
                row.employeeCode}
            </Text>
            {row.academicQualification ? (
              <Text style={styles.meta}>{row.academicQualification}</Text>
            ) : null}
            <View style={styles.links}>
              {row.phone ? (
                <Pressable onPress={() => void Linking.openURL(`tel:${row.phone}`)}>
                  <Text style={styles.link}>Call</Text>
                </Pressable>
              ) : null}
              {row.email ? (
                <Pressable onPress={() => void Linking.openURL(`mailto:${row.email}`)}>
                  <Text style={styles.link}>Email</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
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
  kpis: { flexDirection: 'row' },
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#f5f3ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: { color: '#7c3aed', fontWeight: '800', fontSize: 18 },
  name: { fontWeight: '800', color: colors.ink, fontSize: 16 },
  meta: { color: colors.muted, marginTop: 3, fontSize: 12 },
  links: { flexDirection: 'row', gap: 14, marginTop: 8 },
  link: { color: colors.navy, fontWeight: '800', fontSize: 13 },
});
