import { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { apiFetch } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { EmptyState, Loader, Screen } from '@/ui/kit';
import { colors } from '@/theme/tokens';

type Photo = {
  id: string;
  urls?: { card?: string; thumb?: string; full?: string };
  caption?: string | null;
};
type Album = {
  slug: string;
  title: string;
  cover?: { url?: string; card?: string; thumb?: string; full?: string } | string | null;
  photoCount?: number;
  eventDate?: string | null;
  category?: { name?: string } | null;
  photos?: Photo[];
};

const COL = (Dimensions.get('window').width - 16 * 2 - 12) / 2;

export default function GalleryScreen() {
  const router = useRouter();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [categories, setCategories] = useState<string[]>(['All']);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'Albums' | 'Photos'>('Albums');
  const [filter, setFilter] = useState('All');
  const [q, setQ] = useState('');

  useEffect(() => {
    apiFetch<{ albums: Album[]; categories?: Array<{ name: string }> }>('/v1/school-mobile/gallery')
      .then((payload) => {
        setAlbums(payload.albums ?? []);
        const names = (payload.categories ?? []).map((row) => row.name).filter(Boolean);
        setCategories(['All', ...names]);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const query = q.trim().toLowerCase();
    return albums.filter((album) => {
      const catOk = filter === 'All' || album.category?.name === filter;
      const text = `${album.title} ${album.category?.name ?? ''}`.toLowerCase();
      return catOk && (!query || text.includes(query));
    });
  }, [albums, filter, q]);

  const photos = useMemo(
    () =>
      visible.flatMap((album) =>
        (album.photos ?? []).map((photo) => ({
          ...photo,
          albumTitle: album.title,
          slug: album.slug,
        })),
      ),
    [visible],
  );

  return (
    <Screen title="Photo Gallery" navy>
      <View style={styles.page}>
        <View style={styles.search}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search albums"
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
          />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {(['Albums', 'Photos'] as const).map((item) => (
            <Pressable
              key={item}
              onPress={() => setTab(item)}
              style={[styles.chip, tab === item && styles.chipOn]}
            >
              <Text style={[styles.chipText, tab === item && styles.chipTextOn]}>{item}</Text>
            </Pressable>
          ))}
          {categories.map((name) => (
            <Pressable
              key={name}
              onPress={() => setFilter(name)}
              style={[styles.chip, filter === name && tab === 'Albums' && styles.chipOn]}
            >
              <Text
                style={[styles.chipText, filter === name && tab === 'Albums' && styles.chipTextOn]}
              >
                {name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        {loading ? <Loader /> : null}
        {!loading && error ? <EmptyState title="Could not load gallery" body={error} /> : null}
        {!loading && !visible.length && !error ? (
          <EmptyState
            title="No albums yet."
            body="School photos will appear here after they are published."
          />
        ) : null}
        <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          {tab === 'Albums'
            ? visible.map((album) => {
                const cover = mediaUrl(album.cover as never);
                const date = album.eventDate
                  ? new Date(album.eventDate).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })
                  : null;
                return (
                  <Pressable
                    key={album.slug}
                    style={styles.card}
                    onPress={() => router.push(`/gallery/${album.slug}`)}
                  >
                    {cover ? (
                      <Image source={{ uri: cover }} style={styles.cover} />
                    ) : (
                      <View style={[styles.cover, styles.ph]}>
                        <Text style={{ fontSize: 28 }}>📷</Text>
                      </View>
                    )}
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{album.photoCount ?? 0} photos</Text>
                    </View>
                    <View style={styles.caption}>
                      <Text numberOfLines={2} style={styles.title}>
                        {album.title}
                      </Text>
                      {date ? <Text style={styles.date}>{date}</Text> : null}
                    </View>
                  </Pressable>
                );
              })
            : photos.map((photo) => {
                const uri = mediaUrl(photo.urls as never);
                return (
                  <Pressable
                    key={photo.id}
                    style={styles.card}
                    onPress={() => router.push(`/gallery/${photo.slug}`)}
                  >
                    {uri ? <Image source={{ uri }} style={styles.cover} /> : null}
                    <Text numberOfLines={1} style={styles.photoCap}>
                      {photo.caption || photo.albumTitle}
                    </Text>
                  </Pressable>
                );
              })}
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#eef3fb' },
  search: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: '#fff',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 46,
  },
  searchIcon: { fontSize: 18, color: colors.muted, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: colors.ink },
  chips: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip: {
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipOn: { backgroundColor: colors.navy },
  chipText: { color: colors.navy, fontWeight: '700', fontSize: 13 },
  chipTextOn: { color: '#fff' },
  grid: { padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 40 },
  card: {
    width: COL,
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
  },
  cover: { width: '100%', height: 132, backgroundColor: '#dbe4f5' },
  ph: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(10,16,72,0.75)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  caption: { padding: 10, gap: 2 },
  title: { fontWeight: '800', color: colors.ink, fontSize: 13 },
  date: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  photoCap: { padding: 8, fontSize: 12, fontWeight: '700', color: colors.ink },
});
