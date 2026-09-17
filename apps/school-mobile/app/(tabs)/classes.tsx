import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { fetchHome } from '@/auth/login';
import { Card, EmptyState, Feed, Loader, Screen } from '@/ui/kit';
import { colors } from '@/theme/tokens';

type ClassRow = { id: string; label: string; students: number; percent: number | null };

export default function ClassesScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHome()
      .then((home) => {
        const desk = (home.desk ?? {}) as { classes?: ClassRow[] };
        setRows(desk.classes ?? []);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Screen title="My Classes" light>
      {loading ? <Loader /> : null}
      {!loading && !rows.length ? (
        <EmptyState
          title="No classes assigned"
          body="Class teacher and subject allocations will appear here."
        />
      ) : null}
      <Feed>
        {rows.map((row) => (
          <Pressable key={row.id} onPress={() => router.push('/attendance')}>
            <Card>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{row.label}</Text>
                  <Text style={styles.meta}>{row.students} students</Text>
                </View>
                <Text style={styles.pct}>
                  {row.percent == null ? '—' : `${Math.round(row.percent)}%`}
                </Text>
              </View>
            </Card>
          </Pressable>
        ))}
      </Feed>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontWeight: '800', color: colors.ink, fontSize: 16 },
  meta: { color: colors.muted, marginTop: 2 },
  pct: { color: colors.navy, fontWeight: '800' },
});
