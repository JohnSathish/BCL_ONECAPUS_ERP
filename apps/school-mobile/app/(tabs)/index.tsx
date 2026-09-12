import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { fetchHome, switchChild } from '@/auth/login';
import { getActiveChild } from '@/auth/session';
import { mediaUrl } from '@/api/config';
import { Card, EmptyState, Feed, Loader, Screen } from '@/ui/kit';
import { colors, radii, space } from '@/theme/tokens';

type Child = {
  studentId: string;
  fullName: string;
  classLabel: string | null;
  photoUrl?: string | null;
};
type Notice = {
  slug: string;
  title: string;
  publishedAt?: string | null;
  category?: string | null;
};
type EventRow = { slug: string; title: string; startsAt?: string | null; venue?: string | null };
type Flash = { label?: string; items?: Array<{ id: string; title: string; enabled?: boolean }> };

const TILES = [
  ['📄', 'Notices', '/(tabs)/notices', '#e8f0ff'],
  ['📅', 'Events', '/(tabs)/events', '#e9f8ee'],
  ['✅', 'Attendance', '/attendance', '#fff3e6'],
  ['📘', 'Academics', '/academics', '#ecebff'],
  ['🗓️', 'Timetable', '/timetable', '#e7f6fb'],
  ['✏️', 'Homework', '/homework', '#fdecec'],
  ['🖼️', 'Gallery', '/(tabs)/gallery', '#eef6e8'],
  ['📆', 'Calendar', '/calendar', '#fff6db'],
  ['⋯', 'More', '/(tabs)/more', '#eef1f8'],
] as const;

export default function HomeScreen() {
  const router = useRouter();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const childId = await getActiveChild();
      setData(await fetchHome(childId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load home');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!data && !error) {
    return (
      <Screen>
        <Loader />
      </Screen>
    );
  }
  if (error && !data) {
    return (
      <Screen title="Home">
        <EmptyState title="Something went wrong" body={error} />
      </Screen>
    );
  }

  const me = (data?.me ?? {}) as {
    displayName?: string;
    persona?: string;
    children?: Child[];
    activeStudentId?: string | null;
    student?: { photoUrl?: string | null; classLabel?: string | null; fullName?: string | null };
  };
  const flash = (data?.flashNews ?? {}) as Flash;
  const notices = (data?.notices ?? []) as Notice[];
  const events = (data?.events ?? []) as EventRow[];
  const unread = Number(data?.unreadCount ?? 0);
  const greeting = String(data?.greeting ?? 'Hello');
  const albums = (data?.albums ?? []) as Array<{ cover?: { url?: string } | string | null }>;
  const banner = mediaUrl(albums[0]?.cover as never);
  const studentName = me.student?.fullName || me.displayName || 'Student';
  const classLabel = me.student?.classLabel || me.children?.[0]?.classLabel || '';
  const photo =
    me.student?.photoUrl || me.children?.find((c) => c.studentId === me.activeStudentId)?.photoUrl;

  return (
    <Screen>
      <Feed>
        <View style={styles.top}>
          <Pressable onPress={() => router.push('/profile')} style={styles.who}>
            {photo ? (
              <Image source={{ uri: mediaUrl(photo) }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarLetter}>{studentName.charAt(0)}</Text>
              </View>
            )}
            <View>
              <Text style={styles.greet}>{greeting}</Text>
              <Text style={styles.name}>{studentName}</Text>
              {classLabel ? <Text style={styles.class}>{classLabel}</Text> : null}
            </View>
          </Pressable>
          <Pressable onPress={() => router.push('/inbox')} style={styles.bell}>
            <Text style={{ fontSize: 18 }}>🔔</Text>
            {unread > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {me.children && me.children.length > 1 ? (
          <View style={styles.kids}>
            {me.children.map((child) => (
              <Pressable
                key={child.studentId}
                onPress={() => void switchChild(child.studentId).then(load)}
                style={[styles.kid, me.activeStudentId === child.studentId && styles.kidOn]}
              >
                <Text
                  style={[
                    styles.kidText,
                    me.activeStudentId === child.studentId && styles.kidTextOn,
                  ]}
                >
                  {child.fullName.split(' ')[0]}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <LinearGradient colors={['#1a237e', '#3949ab']} style={styles.banner}>
          {banner ? <Image source={{ uri: banner }} style={styles.bannerImg} /> : null}
          <View style={styles.bannerShade} />
          <Text style={styles.bannerTitle}>Discipline Today</Text>
          <Text style={styles.bannerSub}>A Brighter Tomorrow</Text>
        </LinearGradient>

        <View style={styles.grid}>
          {TILES.map(([emoji, label, href, bg]) => (
            <Pressable key={label} style={styles.tile} onPress={() => router.push(href as never)}>
              <View style={[styles.tileIcon, { backgroundColor: bg }]}>
                <Text style={{ fontSize: 18 }}>{emoji}</Text>
              </View>
              <Text style={styles.tileLabel}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.section}>Today’s Update</Text>
          <Pressable onPress={() => router.push('/(tabs)/notices')}>
            <Text style={styles.seeAll}>See All ›</Text>
          </Pressable>
        </View>
        {flash.items
          ?.filter((item) => item.enabled !== false)
          .slice(0, 2)
          .map((item) => (
            <Card key={item.id}>
              <Text style={styles.kicker}>{flash.label || 'FLASH NEWS'}</Text>
              <Text style={styles.cardTitle}>{item.title}</Text>
            </Card>
          ))}
        {notices.slice(0, 3).map((notice) => (
          <Card key={notice.slug} onPress={() => router.push(`/notice/${notice.slug}`)}>
            <Text style={styles.kicker}>{notice.category || 'Notice'}</Text>
            <Text style={styles.cardTitle}>{notice.title}</Text>
          </Card>
        ))}
        {events.slice(0, 1).map((event) => (
          <Card key={event.slug} onPress={() => router.push(`/event/${event.slug}`)}>
            <Text style={styles.kicker}>Event</Text>
            <Text style={styles.cardTitle}>{event.title}</Text>
          </Card>
        ))}
        {!notices.length && !events.length && !flash.items?.length ? (
          <EmptyState title="No new notices at the moment." body="Check back after school hours." />
        ) : null}
      </Feed>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  who: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: '#fff', fontWeight: '800', fontSize: 18 },
  greet: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  name: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  class: { color: colors.navy, fontWeight: '700', fontSize: 12 },
  bell: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  kids: { flexDirection: 'row', gap: 8 },
  kid: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  kidOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  kidText: { color: colors.navy, fontWeight: '700' },
  kidTextOn: { color: '#fff' },
  banner: {
    height: 150,
    borderRadius: radii.lg,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: space.md,
  },
  bannerImg: { ...StyleSheet.absoluteFillObject, opacity: 0.45 },
  bannerShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,16,72,0.25)' },
  bannerTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  bannerSub: { color: colors.gold, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { width: '33.33%', alignItems: 'center', paddingVertical: 10, gap: 6 },
  tileIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: { fontSize: 12, fontWeight: '700', color: colors.ink },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  section: { fontWeight: '800', color: colors.ink, fontSize: 16 },
  seeAll: { color: colors.navy, fontWeight: '700' },
  kicker: { color: colors.green, fontSize: 12, fontWeight: '800' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.ink },
});
