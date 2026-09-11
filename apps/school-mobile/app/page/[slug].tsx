import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { apiFetch } from '@/api/client';
import { Card, EmptyState, Feed, Loader, Screen } from '@/ui/kit';

function textFromBlocks(doc: unknown) {
  if (!doc || typeof doc !== 'object') return '';
  const raw = JSON.stringify(doc);
  return raw
    .replace(/[{}\[\]"]/g, ' ')
    .replace(/type|content|text|children/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000);
}

export default function CmsPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [page, setPage] = useState<{
    title: string;
    seoDescription?: string | null;
    blockDocument?: unknown;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<NonNullable<typeof page>>(`/v1/school-mobile/pages/${slug}`)
      .then(setPage)
      .catch((err: Error) => setError(err.message));
  }, [slug]);

  if (!page && !error) {
    return (
      <Screen title="School">
        <Loader />
      </Screen>
    );
  }
  if (error || !page) {
    return (
      <Screen title="School">
        <EmptyState title="Page unavailable" body={error ?? 'This page is not published yet.'} />
      </Screen>
    );
  }
  return (
    <Screen title={page.title}>
      <Feed>
        <Card>
          <Text style={{ fontSize: 22, fontWeight: '800' }}>{page.title}</Text>
          <Text style={{ lineHeight: 22 }}>
            {page.seoDescription || textFromBlocks(page.blockDocument)}
          </Text>
        </Card>
      </Feed>
    </Screen>
  );
}
