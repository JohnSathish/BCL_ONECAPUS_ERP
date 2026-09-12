import { useEffect, useState } from 'react';
import { Share, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { apiFetch } from '@/api/client';
import { Card, EmptyState, Feed, Loader, Screen } from '@/ui/kit';

export default function NoticeDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [row, setRow] = useState<{ title: string; body: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ title: string; body: string }>(`/v1/school-mobile/notices/${slug}`)
      .then(setRow)
      .catch((err: Error) => setError(err.message));
  }, [slug]);

  if (!row && !error) {
    return (
      <Screen title="Notice" onBack>
        <Loader />
      </Screen>
    );
  }
  if (error || !row) {
    return (
      <Screen title="Notice" onBack>
        <EmptyState title="Notice unavailable" body={error ?? ''} />
      </Screen>
    );
  }
  return (
    <Screen
      title="Notice"
      onBack
      action={
        <Text
          onPress={() => void Share.share({ message: `${row.title}\n\n${row.body}` })}
          style={{ color: '#1a237e', fontWeight: '700' }}
        >
          Share
        </Text>
      }
    >
      <Feed>
        <Card>
          <Text style={{ fontSize: 22, fontWeight: '800' }}>{row.title}</Text>
          <Text style={{ lineHeight: 22, color: '#1c2430' }}>{row.body}</Text>
        </Card>
      </Feed>
    </Screen>
  );
}
