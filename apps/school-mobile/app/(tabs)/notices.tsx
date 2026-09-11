import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { apiFetch } from '@/api/client';
import { Card, EmptyState, Feed, Loader, Screen } from '@/ui/kit';

type Notice = { slug: string; title: string; summary?: string | null; publishedAt?: string | null };

export default function NoticesScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<Notice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Notice[]>('/v1/school-mobile/notices')
      .then(setRows)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Screen title="Notices">
      {loading ? <Loader /> : null}
      {!loading && error ? <EmptyState title="Could not load notices" body={error} /> : null}
      {!loading && !error && !rows.length ? (
        <EmptyState
          title="No new notices at the moment."
          body="Your school will post updates here."
        />
      ) : null}
      <Feed>
        {rows.map((row) => (
          <Card key={row.slug} onPress={() => router.push(`/notice/${row.slug}`)}>
            <Text style={{ fontWeight: '800', color: '#1c2430' }}>{row.title}</Text>
            {row.summary ? <Text style={{ color: '#5b6573' }}>{row.summary}</Text> : null}
          </Card>
        ))}
      </Feed>
    </Screen>
  );
}
