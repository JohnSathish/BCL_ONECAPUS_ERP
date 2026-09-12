import { useEffect, useState } from 'react';
import { Dimensions, Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { apiFetch } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { EmptyState, Loader, Screen } from '@/ui/kit';
import { colors, space } from '@/theme/tokens';

type Item = { id: string; urls?: { full?: string; thumb?: string } | string };
type Album = { title: string; items?: Item[]; cover?: string | { full?: string } };

function urlOf(value: Item['urls'] | Album['cover']) {
  return mediaUrl(value as never);
}

export default function GalleryAlbum() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [album, setAlbum] = useState<Album | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const width = Dimensions.get('window').width - space.md * 2;

  useEffect(() => {
    apiFetch<Album>(`/v1/school-mobile/gallery/${slug}`)
      .then(setAlbum)
      .catch((err: Error) => setError(err.message));
  }, [slug]);

  if (!album && !error) {
    return (
      <Screen title="Album" onBack>
        <Loader />
      </Screen>
    );
  }
  if (error || !album) {
    return (
      <Screen title="Album" onBack>
        <EmptyState title="Album unavailable" body={error ?? ''} />
      </Screen>
    );
  }
  const items = album.items ?? [];
  return (
    <Screen title={album.title} onBack>
      <ScrollView contentContainerStyle={{ padding: space.md, gap: 10 }}>
        {items.map((item, index) => (
          <Pressable key={item.id} onPress={() => setActive(index)}>
            <Image
              source={{ uri: urlOf(item.urls) }}
              style={{ width, height: 220, borderRadius: 16 }}
            />
          </Pressable>
        ))}
        {!items.length ? <EmptyState title="No photos" body="This album is empty." /> : null}
      </ScrollView>
      <Modal visible={active != null} transparent>
        <Pressable
          style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center' }}
          onPress={() => setActive(null)}
        >
          {active != null && items[active] ? (
            <Image
              source={{ uri: urlOf(items[active].urls) }}
              style={{ width: '100%', height: '80%' }}
              resizeMode="contain"
            />
          ) : null}
          <Text style={{ color: colors.gold, textAlign: 'center', marginBottom: 24 }}>
            Swipe back / tap to close
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 24 }}>
            <Text
              style={{ color: '#fff', fontWeight: '700' }}
              onPress={() => setActive((n) => (n == null ? n : Math.max(0, n - 1)))}
            >
              Prev
            </Text>
            <Text
              style={{ color: '#fff', fontWeight: '700' }}
              onPress={() => setActive((n) => (n == null ? n : Math.min(items.length - 1, n + 1)))}
            >
              Next
            </Text>
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}
