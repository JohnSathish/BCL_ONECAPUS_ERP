import { useEffect, useState } from 'react';
import { Image, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { apiFetch } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { Card, EmptyState, Feed, Loader, Screen } from '@/ui/kit';

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

  useEffect(() => {
    apiFetch<{ albums: Album[] }>('/v1/school-mobile/gallery')
      .then((payload) => setAlbums(payload.albums ?? []))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Screen title="Gallery">
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
            <Card key={album.slug} onPress={() => router.push(`/gallery/${album.slug}`)}>
              {cover ? (
                <Image source={{ uri: cover }} style={{ height: 160, borderRadius: 12 }} />
              ) : null}
              <Text style={{ fontWeight: '800' }}>{album.title}</Text>
              <Text style={{ color: '#5b6573' }}>{album.photoCount ?? 0} photos</Text>
            </Card>
          );
        })}
      </Feed>
    </Screen>
  );
}
