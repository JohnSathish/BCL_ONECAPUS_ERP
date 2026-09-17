import { useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { apiFetch } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { EmptyState, Loader, Screen } from '@/ui/kit';
import { colors } from '@/theme/tokens';

type Item = {
  id: string;
  caption?: string | null;
  urls?: { full?: string; card?: string; thumb?: string };
};
type Album = { title: string; eventDate?: string | null; location?: string | null; items?: Item[] };

function urlOf(value: Item['urls']) {
  return mediaUrl(value as never);
}

export default function GalleryAlbum() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [album, setAlbum] = useState<Album | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tile = (Dimensions.get('window').width - 16 * 2 - 8) / 2;

  useEffect(() => {
    apiFetch<Album>(`/v1/school-mobile/gallery/${slug}`)
      .then(setAlbum)
      .catch((err: Error) => setError(err.message));
  }, [slug]);

  if (!album && !error) {
    return (
      <Screen title="Album" onBack navy>
        <Loader />
      </Screen>
    );
  }
  if (error || !album) {
    return (
      <Screen title="Album" onBack navy>
        <EmptyState title="Album unavailable" body={error ?? ''} />
      </Screen>
    );
  }
  const items = album.items ?? [];
  const when = album.eventDate
    ? new Date(album.eventDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })
    : null;

  return (
    <Screen title={album.title} onBack navy>
      <View style={styles.page}>
        {when || album.location ? (
          <Text style={styles.meta}>{[when, album.location].filter(Boolean).join(' · ')}</Text>
        ) : null}
        <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          {items.map((item, index) => (
            <Pressable
              key={item.id}
              onPress={() => setActive(index)}
              style={[styles.tile, { width: tile }]}
            >
              <Image source={{ uri: urlOf(item.urls) }} style={styles.image} />
            </Pressable>
          ))}
          {!items.length ? <EmptyState title="No photos" body="This album is empty." /> : null}
        </ScrollView>
      </View>
      <Modal visible={active != null} transparent animationType="fade">
        <View style={styles.modal}>
          <Pressable style={styles.close} onPress={() => setActive(null)}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
          {active != null && items[active] ? (
            <Image
              source={{ uri: urlOf(items[active].urls) }}
              style={styles.full}
              resizeMode="contain"
            />
          ) : null}
          <Text style={styles.caption}>{active != null ? items[active]?.caption : ''}</Text>
          <View style={styles.nav}>
            <Pressable onPress={() => setActive((n) => (n == null ? n : Math.max(0, n - 1)))}>
              <Text style={styles.navText}>‹ Prev</Text>
            </Pressable>
            <Text style={styles.count}>
              {active != null ? `${active + 1} / ${items.length}` : ''}
            </Text>
            <Pressable
              onPress={() => setActive((n) => (n == null ? n : Math.min(items.length - 1, n + 1)))}
            >
              <Text style={styles.navText}>Next ›</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#eef3fb' },
  meta: { color: colors.muted, paddingHorizontal: 16, paddingTop: 10, fontWeight: '600' },
  grid: { padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 40 },
  tile: { borderRadius: 14, overflow: 'hidden', backgroundColor: '#dbe4f5' },
  image: { width: '100%', height: 140 },
  modal: { flex: 1, backgroundColor: '#0b1048', justifyContent: 'center', paddingBottom: 24 },
  close: { position: 'absolute', top: 48, right: 20, zIndex: 2 },
  closeText: { color: '#fff', fontWeight: '800' },
  full: { width: '100%', height: '70%' },
  caption: { color: '#fff', textAlign: 'center', marginTop: 8, paddingHorizontal: 16 },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginTop: 16,
  },
  navText: { color: colors.gold, fontWeight: '800' },
  count: { color: '#fff', fontWeight: '700' },
});
