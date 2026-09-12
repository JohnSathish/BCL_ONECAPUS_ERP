import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { apiFetch } from '@/api/client';
import { Card, EmptyState, Feed, Loader, Screen } from '@/ui/kit';

export default function EventDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [row, setRow] = useState<{
    title: string;
    summary?: string | null;
    venue?: string | null;
    startsAt: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<NonNullable<typeof row>>(`/v1/school-mobile/events/${slug}`)
      .then(setRow)
      .catch((err: Error) => setError(err.message));
  }, [slug]);

  if (!row && !error) {
    return (
      <Screen title="Event" onBack>
        <Loader />
      </Screen>
    );
  }
  if (error || !row) {
    return (
      <Screen title="Event" onBack>
        <EmptyState title="Event unavailable" body={error ?? ''} />
      </Screen>
    );
  }
  return (
    <Screen title="Event" onBack>
      <Feed>
        <Card>
          <Text style={{ fontSize: 22, fontWeight: '800' }}>{row.title}</Text>
          <Text style={{ color: '#1a237e', fontWeight: '700' }}>
            {new Date(row.startsAt).toLocaleString()}
          </Text>
          {row.venue ? <Text>{row.venue}</Text> : null}
          {row.summary ? <Text style={{ lineHeight: 22 }}>{row.summary}</Text> : null}
        </Card>
      </Feed>
    </Screen>
  );
}
