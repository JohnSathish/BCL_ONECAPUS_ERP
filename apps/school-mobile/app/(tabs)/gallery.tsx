import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { apiFetch } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { Card, Chips, EmptyState, Feed, Loader, Screen } from '@/ui/kit';
import { colors } from '@/theme/tokens';

type Album = {
  slug: string;
  title: string;
  cover?: { url?: string } | string | null;
  photoCount?: number;
};

export default function GalleryScreen() {
  const router = useRouter();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('Albums');

  useEffect(() => {
    apiFetch<{ albums: Album[] }>('/v1/school-mobile/gallery')
      .then((payload) => setAlbums(payload.albums ?? []))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Screen title="Photo Gallery">
      <Chips options={['Albums', 'Photos']} value={tab} onChange={setTab} />
      {loading ? <Loader /> : null}
      {!loading && error ? <EmptyState title="Could not load gallery" body={error} /> : null}
      {!loading && !albums.length && !error ? (
        <EmptyState
          title="No albums yet."
          body="School photos will appear here after they are published."
        />
      ) : null}
      <Feed>
        {albums.map((album) => {
          const cover = mediaUrl(album.cover as never);
          return (
            <Card
              key={album.slug}
              padded={false}
              onPress={() => router.push(`/gallery/${album.slug}`)}
            >
              {cover ? (
                <Image source={{ uri: cover }} style={styles.cover} />
              ) : (
                <Text style={styles.ph}>📷</Text>
              )}
              <Text style={styles.title}>{album.title}</Text>
              <Text style={styles.count}>{album.photoCount ?? 0} Photos</Text>
            </Card>
          );
        })}
      </Feed>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cover: { height: 160, width: '100%' },
  ph: { textAlign: 'center', padding: 40, fontSize: 32 },
  title: { fontWeight: '800', paddingHorizontal: 14, paddingTop: 10, color: colors.ink },
  count: { color: colors.muted, paddingHorizontal: 14, paddingBottom: 12 },
});
