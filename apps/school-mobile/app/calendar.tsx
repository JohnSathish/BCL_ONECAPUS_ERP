import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { apiFetch } from '@/api/client';
import { Card, EmptyState, Feed, Loader, Screen } from '@/ui/kit';

type EventRow = { slug: string; title: string; startsAt?: string | null; venue?: string | null };

export default function CalendarScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<EventRow[]>('/v1/school-mobile/events')
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Screen title="Calendar" onBack>
      {loading ? <Loader /> : null}
      {!loading && !rows.length ? (
        <EmptyState
          title="No calendar entries yet."
          body="Published school events will show here."
        />
      ) : null}
      <Feed>
        {rows.map((row) => (
          <Card key={row.slug} onPress={() => router.push(`/event/${row.slug}`)}>
            <Text style={{ fontWeight: '800' }}>{row.title}</Text>
            {row.startsAt ? (
              <Text>
                {new Date(row.startsAt).toLocaleDateString('en-IN', { dateStyle: 'full' })}
              </Text>
            ) : null}
            {row.venue ? <Text>{row.venue}</Text> : null}
          </Card>
        ))}
      </Feed>
    </Screen>
  );
}
