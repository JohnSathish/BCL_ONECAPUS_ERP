import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { apiFetch } from '@/api/client';
import { Card, EmptyState, Feed, Loader, Screen } from '@/ui/kit';

type EventRow = { slug: string; title: string; venue?: string | null; startsAt?: string | null };

export default function EventsScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<EventRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<EventRow[]>('/v1/school-mobile/events')
      .then(setRows)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Screen title="Events">
      {loading ? <Loader /> : null}
      {!loading && error ? <EmptyState title="Could not load events" body={error} /> : null}
      {!loading && !rows.length && !error ? (
        <EmptyState title="No events listed yet." body="Upcoming school events will appear here." />
      ) : null}
      <Feed>
        {rows.map((row) => (
          <Card key={row.slug} onPress={() => router.push(`/event/${row.slug}`)}>
            <Text style={{ fontWeight: '800' }}>{row.title}</Text>
            {row.venue ? <Text style={{ color: '#5b6573' }}>{row.venue}</Text> : null}
            {row.startsAt ? (
              <Text style={{ color: '#1a237e', fontWeight: '700' }}>
                {new Date(row.startsAt).toLocaleString()}
              </Text>
            ) : null}
          </Card>
        ))}
      </Feed>
    </Screen>
  );
}
