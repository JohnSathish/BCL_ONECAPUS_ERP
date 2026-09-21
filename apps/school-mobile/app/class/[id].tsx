import { useCallback, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { apiFetch } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { EmptyState, Loader, Screen } from '@/ui/kit';
import { colors, radii, space } from '@/theme/tokens';

type Pack = {
  id: string;
  label: string;
  classTeacher?: boolean;
  students: number;
  subjects?: Array<{ id: string; name: string }>;
  submitted?: boolean;
  percent?: number | null;
  present?: number;
  absent?: number;
  roster?: Array<{
    studentId: string;
    fullName: string;
    admissionNumber?: string | null;
    rollNumber?: string | null;
    photoUrl?: string | null;
  }>;
};

function ringColor(percent: number | null | undefined) {
  if (percent == null) return '#94a3b8';
  if (percent >= 90) return '#16a34a';
  if (percent >= 75) return '#ca8a04';
  return '#dc2626';
}

export default function ClassDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const sectionId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [pack, setPack] = useState<Pack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!sectionId) throw new Error('Class not found');
    const data = await apiFetch<Pack>(
      `/v1/school-mobile/teacher/class?sectionId=${encodeURIComponent(sectionId)}`,
    );
    setPack(data);
    setError(null);
  }, [sectionId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load()
        .catch((err: Error) => setError(err.message))
        .finally(() => setLoading(false));
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh class.');
    } finally {
      setRefreshing(false);
    }
  };

  const marked = Boolean(pack?.submitted) && pack?.percent != null;
  const pctColor = ringColor(pack?.percent);

  return (
    <Screen title={pack?.label || 'Class'} onBack>
      {loading ? <Loader /> : null}
      {error && !pack ? <EmptyState title="Class unavailable" body={error} /> : null}
      {!loading && pack ? (
        <ScrollView
          contentContainerStyle={styles.feed}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
          }
        >
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Text style={{ fontSize: 22 }}>🎓</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroName}>{pack.label}</Text>
              <Text style={styles.heroMeta}>
                {pack.classTeacher ? 'Class Teacher' : 'Subject Teacher'} · {pack.students} students
              </Text>
            </View>
            <View style={styles.heroPct}>
              <Text style={[styles.heroPctN, { color: pctColor }]}>
                {pack.percent == null ? '—' : `${Math.round(pack.percent)}%`}
              </Text>
              <Text style={styles.heroPctL}>{pack.percent == null ? 'No data' : 'Today'}</Text>
            </View>
          </View>

          <View style={styles.quick}>
            <Quick
              icon="📅"
              label={marked ? 'Today’s attendance' : 'Mark attendance'}
              tint="#fee2e2"
              onPress={() =>
                router.push(`/take-attendance?sectionId=${encodeURIComponent(pack.id)}`)
              }
            />
            <Quick
              icon="🗓️"
              label="Timetable"
              tint="#dbeafe"
              onPress={() => router.push('/timetable')}
            />
            <Quick
              icon="📝"
              label="Homework"
              tint="#ffedd5"
              onPress={() => router.push('/homework')}
            />
          </View>

          {pack.subjects?.length ? (
            <View style={styles.block}>
              <Text style={styles.blockTitle}>Subjects ({pack.subjects.length})</Text>
              <View style={styles.chips}>
                {pack.subjects.map((row) => (
                  <View key={row.id} style={styles.chip}>
                    <Text style={styles.chipTxt}>{row.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.block}>
            <Text style={styles.blockTitle}>Students ({pack.roster?.length ?? pack.students})</Text>
            {(pack.roster ?? []).map((row) => {
              const photo = mediaUrl(row.photoUrl);
              return (
                <View key={row.studentId} style={styles.student}>
                  {photo ? (
                    <Image source={{ uri: photo }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarLetter}>{row.fullName.charAt(0)}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.studentName}>{row.fullName}</Text>
                    <Text style={styles.studentMeta}>
                      {[row.rollNumber ? `Roll ${row.rollNumber}` : null, row.admissionNumber]
                        .filter(Boolean)
                        .join(' · ') || 'Enrolled'}
                    </Text>
                  </View>
                </View>
              );
            })}
            {!(pack.roster ?? []).length ? (
              <Text style={styles.empty}>No students enrolled in this class yet.</Text>
            ) : null}
          </View>
        </ScrollView>
      ) : null}
    </Screen>
  );
}

function Quick({
  icon,
  label,
  tint,
  onPress,
}: {
  icon: string;
  label: string;
  tint: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.quickBtn, { backgroundColor: tint }]}>
      <Text style={{ fontSize: 16 }}>{icon}</Text>
      <Text style={styles.quickTxt}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  feed: { padding: space.md, gap: 12, paddingBottom: 48 },
  hero: {
    backgroundColor: '#fff',
    borderRadius: radii.lg,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroName: { fontWeight: '800', color: colors.navy, fontSize: 18 },
  heroMeta: { color: colors.muted, fontWeight: '600', marginTop: 2 },
  heroPct: { alignItems: 'flex-end' },
  heroPctN: { fontWeight: '800', fontSize: 18 },
  heroPctL: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  quick: { flexDirection: 'row', gap: 8 },
  quickBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
  },
  quickTxt: { fontWeight: '800', color: colors.ink, fontSize: 11, textAlign: 'center' },
  block: {
    backgroundColor: '#fff',
    borderRadius: radii.lg,
    padding: 14,
    gap: 8,
  },
  blockTitle: { fontWeight: '800', color: colors.navy, fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#eef2ff',
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipTxt: { fontWeight: '700', color: colors.navy, fontSize: 12 },
  student: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontWeight: '800', color: colors.navy },
  studentName: { fontWeight: '800', color: colors.ink },
  studentMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  empty: { color: colors.muted, fontWeight: '600' },
});
