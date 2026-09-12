import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { apiFetch } from '@/api/client';
import { Card, EmptyState, Feed, Loader, Screen } from '@/ui/kit';

export default function PrayerScreen() {
  const [row, setRow] = useState<{
    weekdayLabel?: string;
    title: string;
    body: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<NonNullable<typeof row>>('/v1/school-mobile/prayer')
      .then(setRow)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <Screen title="Morning prayer" onBack>
      {!row && !error ? <Loader /> : null}
      {error ? <EmptyState title="Prayer unavailable" body={error} /> : null}
      {row ? (
        <Feed>
          <Card>
            <Text style={{ color: '#6aa84f', fontWeight: '800' }}>{row.weekdayLabel}</Text>
            <Text style={{ fontSize: 22, fontWeight: '800' }}>{row.title}</Text>
            <Text style={{ lineHeight: 24, fontSize: 16 }}>{row.body}</Text>
          </Card>
        </Feed>
      ) : null}
    </Screen>
  );
}
