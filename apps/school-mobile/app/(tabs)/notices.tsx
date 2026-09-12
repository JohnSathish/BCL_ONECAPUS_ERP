import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { apiFetch } from '@/api/client';
import { Card, Chips, EmptyState, Feed, Loader, Screen } from '@/ui/kit';
import { colors, radii } from '@/theme/tokens';

type Notice = {
  slug: string;
  title: string;
  summary?: string | null;
  publishedAt?: string | null;
  category?: string | null;
};

const FILTERS = ['All', 'Important', 'Academic', 'General'];

function bucket(category?: string | null) {
  const value = (category || 'GENERAL').toUpperCase();
  if (value.includes('IMPORTANT') || value.includes('URGENT')) return 'Important';
  if (value.includes('ACADEMIC') || value.includes('EXAM')) return 'Academic';
  return 'General';
}

export default function NoticesScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<Notice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [q, setQ] = useState('');

  useEffect(() => {
    apiFetch<Notice[]>('/v1/school-mobile/notices')
      .then(setRows)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const shown = useMemo(() => {
    return rows.filter((row) => {
      const matchFilter = filter === 'All' || bucket(row.category) === filter;
      const matchQ =
        !q.trim() || `${row.title} ${row.summary ?? ''}`.toLowerCase().includes(q.toLowerCase());
      return matchFilter && matchQ;
    });
  }, [rows, filter, q]);

  return (
    <Screen title="Notices" action={<Text style={{ fontSize: 16 }}>🔍</Text>}>
      <View style={styles.searchWrap}>
        <TextInput
          placeholder="Search notices"
          value={q}
          onChangeText={setQ}
          style={styles.search}
          placeholderTextColor={colors.muted}
        />
      </View>
      <Chips options={FILTERS} value={filter} onChange={setFilter} />
      {loading ? <Loader /> : null}
      {!loading && error ? <EmptyState title="Could not load notices" body={error} /> : null}
      {!loading && !error && !shown.length ? (
        <EmptyState title="No notices in this list." body="Your school will post updates here." />
      ) : null}
      <Feed>
        {shown.map((row) => (
          <Card key={row.slug} onPress={() => router.push(`/notice/${row.slug}`)}>
            <Text style={styles.tag}>{bucket(row.category)}</Text>
            <Text style={styles.title}>{row.title}</Text>
            {row.summary ? <Text style={styles.summary}>{row.summary}</Text> : null}
            {row.publishedAt ? (
              <Text style={styles.date}>
                {new Date(row.publishedAt).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
            ) : null}
          </Card>
        ))}
      </Feed>
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchWrap: { paddingHorizontal: 16, paddingBottom: 4 },
  search: {
    backgroundColor: '#fff',
    borderRadius: radii.md,
    height: 44,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tag: { color: colors.navy, fontWeight: '800', fontSize: 12 },
  title: { fontWeight: '800', color: colors.ink, fontSize: 16 },
  summary: { color: colors.muted },
  date: { color: colors.muted, fontSize: 12 },
});
