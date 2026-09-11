import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { apiFetch } from '@/api/client';
import { Card, EmptyState, Feed, Loader, Screen } from '@/ui/kit';

type Line = { label: string; amount: number | null; kind?: string };

export default function FeesScreen() {
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ structure?: { lines?: Line[] } | null }>('/v1/school-mobile/fees')
      .then((payload) => setLines(payload.structure?.lines ?? []))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Screen title="Fees">
      {loading ? <Loader /> : null}
      {error ? <EmptyState title="Fee details unavailable" body={error} /> : null}
      {!loading && !error && !lines.length ? (
        <EmptyState
          title="No fee structure linked yet"
          body="Office will publish class-wise fees here when they are assigned."
        />
      ) : null}
      <Feed>
        {lines.map((line) => (
          <Card key={line.label}>
            <Text style={{ fontWeight: '800' }}>{line.label}</Text>
            <Text>
              {line.amount == null ? 'As applicable' : `₹ ${line.amount.toLocaleString('en-IN')}`}
            </Text>
          </Card>
        ))}
      </Feed>
    </Screen>
  );
}
