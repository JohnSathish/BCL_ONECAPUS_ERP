import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { fetchHome, switchChild } from '@/auth/login';
import { getActiveChild } from '@/auth/session';
import { Card, EmptyState, Feed, Loader, Screen } from '@/ui/kit';
import { colors, radii, space } from '@/theme/tokens';

type Child = { studentId: string; fullName: string; classLabel: string | null };
type Notice = { slug: string; title: string; publishedAt?: string | null };
type EventRow = { slug: string; title: string; startsAt?: string | null; venue?: string | null };
type Flash = {
  label?: string;
  items?: Array<{ id: string; title: string; href?: string; enabled?: boolean }>;
};

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
  };
  const flash = (data?.flashNews ?? {}) as Flash;
  const prayer = (data?.prayer ?? {}) as { title?: string; body?: string; weekdayLabel?: string };
  const notices = (data?.notices ?? []) as Notice[];
  const events = (data?.events ?? []) as EventRow[];
  const unread = Number(data?.unreadCount ?? 0);
  const greeting = String(data?.greeting ?? 'Hello');

  return (
    <Screen>
      <Feed>
        <LinearGradient colors={[colors.navyDeep, colors.navy]} style={styles.hero}>
          <View style={styles.heroTop}>
            <Image source={require('../../assets/icon.png')} style={styles.crest} />
            <Pressable onPress={() => router.push('/inbox')} style={styles.bell}>
              <Text style={styles.bellText}>🔔</Text>
              {unread > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unread}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>
          <Text style={styles.school}>St. Luke's School</Text>
          <Text style={styles.hello}>
            {greeting}, {me.displayName?.split(' ')[0] ?? 'friend'}
          </Text>
          {me.children && me.children.length > 1 ? (
            <View style={styles.kids}>
              {me.children.map((child) => (
                <Pressable
                  key={child.studentId}
                  onPress={() => {
                    void switchChild(child.studentId).then(load);
                  }}
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
        </LinearGradient>

        {flash.items?.filter((item) => item.enabled !== false).length ? (
          <Card>
            <Text style={styles.kicker}>{flash.label || 'FLASH NEWS'}</Text>
            {flash.items
              ?.filter((item) => item.enabled !== false)
              .slice(0, 3)
              .map((item) => (
                <Text key={item.id} style={styles.flash}>
                  {item.title}
                </Text>
              ))}
          </Card>
        ) : null}

        <Card onPress={() => router.push('/prayer')}>
          <Text style={styles.kicker}>{prayer.weekdayLabel || 'Today'}</Text>
          <Text style={styles.cardTitle}>{prayer.title || 'Morning prayer'}</Text>
          <Text numberOfLines={3} style={styles.body}>
            {prayer.body}
          </Text>
        </Card>

        <Text style={styles.section}>Quick access</Text>
        <View style={styles.grid}>
          {[
            ['📢', 'Notices', '/(tabs)/notices'],
            ['📅', 'Events', '/(tabs)/events'],
            ['📚', 'Timetable', '/timetable'],
            ['👤', 'Attendance', '/attendance'],
            ['🖼', 'Gallery', '/(tabs)/gallery'],
            ['🏫', 'About', '/page/about'],
          ].map(([emoji, label, href]) => (
            <Pressable key={label} style={styles.tile} onPress={() => router.push(href as never)}>
              <Text style={styles.tileEmoji}>{emoji}</Text>
              <Text style={styles.tileLabel}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.section}>Latest updates</Text>
        {notices.slice(0, 3).map((notice) => (
          <Card key={notice.slug} onPress={() => router.push(`/notice/${notice.slug}`)}>
            <Text style={styles.kicker}>Notice</Text>
            <Text style={styles.cardTitle}>{notice.title}</Text>
          </Card>
        ))}
        {events.slice(0, 2).map((event) => (
          <Card key={event.slug} onPress={() => router.push(`/event/${event.slug}`)}>
            <Text style={styles.kicker}>Event</Text>
            <Text style={styles.cardTitle}>{event.title}</Text>
            {event.venue ? <Text style={styles.body}>{event.venue}</Text> : null}
          </Card>
        ))}
        {!notices.length && !events.length ? (
          <EmptyState title="No new notices at the moment." body="Check back after school hours." />
        ) : null}
      </Feed>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radii.lg, padding: space.md, gap: 6 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  crest: { width: 44, height: 44, borderRadius: 12 },
  bell: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  bellText: { fontSize: 20 },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: colors.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  school: { color: colors.gold, fontWeight: '700' },
  hello: { color: '#fff', fontSize: 22, fontWeight: '800' },
  kids: { flexDirection: 'row', gap: 8, marginTop: 8 },
  kid: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  kidOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  kidText: { color: '#fff', fontWeight: '700' },
  kidTextOn: { color: colors.navyDeep },
  kicker: { color: colors.green, fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  body: { color: colors.muted, lineHeight: 20 },
  flash: { color: colors.navy, fontWeight: '600' },
  section: { fontWeight: '800', color: colors.navy, fontSize: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '31%',
    backgroundColor: '#fff',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 6,
  },
  tileEmoji: { fontSize: 20 },
  tileLabel: { fontSize: 12, fontWeight: '700', color: colors.navy },
});
