import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { apiFetch } from '@/api/client';
import { Card, Chips, EmptyState, Feed, Loader, Screen } from '@/ui/kit';
import { colors } from '@/theme/tokens';

type EventRow = {
  slug: string;
  title: string;
  venue?: string | null;
  startsAt?: string | null;
};

export default function EventsScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<EventRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('Upcoming');

  useEffect(() => {
    apiFetch<EventRow[]>('/v1/school-mobile/events')
      .then(setRows)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const shown = useMemo(() => {
    const now = Date.now();
    return rows.filter((row) => {
      const t = row.startsAt ? new Date(row.startsAt).getTime() : now;
      return tab === 'Upcoming' ? t >= now - 60 * 60 * 1000 : t < now;
    });
  }, [rows, tab]);

  return (
    <Screen title="Events">
      <Chips options={['Upcoming', 'Past']} value={tab} onChange={setTab} />
      {loading ? <Loader /> : null}
      {!loading && error ? <EmptyState title="Could not load events" body={error} /> : null}
      {!loading && !shown.length && !error ? (
        <EmptyState
          title={tab === 'Upcoming' ? 'No upcoming events.' : 'No past events yet.'}
          body="School events will appear here when published."
        />
      ) : null}
      <Feed>
        {shown.map((row) => {
          const when = row.startsAt ? new Date(row.startsAt) : null;
          return (
            <Card key={row.slug} onPress={() => router.push(`/event/${row.slug}`)}>
              <View style={styles.row}>
                <View style={styles.dateBox}>
                  <Text style={styles.day}>{when ? when.getDate() : '—'}</Text>
                  <Text style={styles.mon}>
                    {when ? when.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase() : ''}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{row.title}</Text>
                  {row.venue ? <Text style={styles.meta}>{row.venue}</Text> : null}
                  {when ? (
                    <Text style={styles.meta}>
                      {when.toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </Text>
                  ) : null}
                </View>
              </View>
            </Card>
          );
        })}
      </Feed>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  dateBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  day: { color: '#fff', fontSize: 20, fontWeight: '800' },
  mon: { color: colors.gold, fontSize: 11, fontWeight: '800' },
  title: { fontWeight: '800', fontSize: 16, color: colors.ink },
  meta: { color: colors.muted, marginTop: 2 },
});
