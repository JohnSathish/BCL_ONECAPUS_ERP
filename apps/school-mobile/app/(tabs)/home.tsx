import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { fetchHome, switchChild } from '@/auth/login';
import { getActiveChild, getRefreshToken, getUser, saveUser } from '@/auth/session';
import { justDidPasswordLogin } from '@/auth/password-gate';
import { mediaUrl } from '@/api/config';
import { CAMPUS, CREST, SCHOOL } from '@/brand';
import { isPrincipalUser, isStaffUser } from '@/persona';
import { PrincipalHome } from '@/screens/principal-home';
import { StaffHome } from '@/screens/staff-home';
import { EmptyState, Feed, Screen } from '@/ui/kit';
import { colors, radii, space } from '@/theme/tokens';

type Child = {
  studentId: string;
  fullName: string;
  classLabel: string | null;
  photoUrl?: string | null;
};
type Notice = { slug: string; title: string; publishedAt?: string | null };
type EventRow = { slug: string; title: string; startsAt?: string | null; venue?: string | null };

const TILES = [
  { icon: '👤', label: 'My Profile', href: '/profile', bg: '#fce7f3', fg: '#db2777' },
  { icon: '🗓️', label: 'Timetable', href: '/timetable', bg: '#f3e8ff', fg: '#7c3aed' },
  { icon: '✅', label: 'Attendance', href: '/attendance', bg: '#dcfce7', fg: '#16a34a' },
  { icon: '✏️', label: 'Homework', href: '/homework', bg: '#ffedd5', fg: '#ea580c' },
  { icon: '📚', label: 'Study Material', href: '/study-material', bg: '#dbeafe', fg: '#2563eb' },
  { icon: '📋', label: 'Examinations', href: '/examinations', bg: '#e0e7ff', fg: '#4f46e5' },
  { icon: '₹', label: 'Fees', href: '/fees', bg: '#d1fae5', fg: '#059669' },
  { icon: '📢', label: 'Notices', href: '/(tabs)/notices', bg: '#fce7f3', fg: '#c026d3' },
  { icon: '🍱', label: 'Lunch Menu', href: '/lunch', bg: '#fef3c7', fg: '#d97706' },
  { icon: '🚌', label: 'Transport', href: '/transport', bg: '#cffafe', fg: '#0891b2' },
  { icon: '🛒', label: 'Stationery', href: '/stationery', bg: '#ffe4e6', fg: '#e11d48' },
  { icon: '⊞', label: 'More', href: '/(tabs)/more', bg: '#e2e8f0', fg: '#475569' },
] as const;

function monthDay(iso?: string | null) {
  if (!iso) return { mon: '—', day: '—' };
  const d = new Date(iso);
  return {
    mon: d.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase(),
    day: String(d.getDate()).padStart(2, '0'),
  };
}

export default function HomeScreen() {
  const router = useRouter();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const refresh = await getRefreshToken();
      if (!refresh) {
        setError('Could not load home. Please try again.');
        if (!justDidPasswordLogin()) router.replace('/login');
        return;
      }
      const [childId, cached] = await Promise.all([getActiveChild(), getUser()]);
      const office = isPrincipalUser(cached) || isStaffUser(cached);
      if (!office) {
        setData(
          (prev) => prev ?? { me: { displayName: cached?.displayName, persona: cached?.persona } },
        );
      }
      const home = await Promise.race([
        fetchHome(childId),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 12000)),
      ]);
      setData(home);
      const me = (home.me ?? {}) as {
        persona?: string;
        displayName?: string;
        mustResetPassword?: boolean;
      };
      const user = cached ?? (await getUser());
      await saveUser({
        ...user,
        persona: me.persona,
        displayName: me.displayName || user?.displayName,
        mustResetPassword: Boolean(me.mustResetPassword),
      });
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (/offline|timeout/i.test(msg)) {
        setError("You're offline. Some information may be unavailable.");
        return;
      }
      setError('Could not load home. Please try again.');
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (data || !error) return;
    const id = setInterval(() => void load(), 8000);
    return () => clearInterval(id);
  }, [data, error, load]);

  if (!data && !error) {
    return (
      <Screen light>
        <View style={styles.boot}>
          <Image source={CREST} style={styles.crest} resizeMode="contain" />
          <Text style={styles.school}>{SCHOOL.shortName}</Text>
          <Text style={styles.motto}>Loading your dashboard…</Text>
        </View>
      </Screen>
    );
  }

  if (!data) {
    const offline = /offline|internet/i.test(error || '');
    return (
      <Screen>
        <EmptyState
          title={offline ? 'No Internet Connection' : "Couldn't load home"}
          body={error || 'Please try again.'}
        />
        <Pressable onPress={() => void load()} style={styles.retry}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </Screen>
    );
  }

  if (data && isPrincipalUser(data.me as { persona?: string })) {
    return <PrincipalHome data={data} />;
  }

  if (data && isStaffUser(data.me as { persona?: string })) {
    return <StaffHome data={data} />;
  }

  const me = (data?.me ?? {}) as {
    displayName?: string;
    children?: Child[];
    activeStudentId?: string | null;
    student?: { photoUrl?: string | null; classLabel?: string | null; fullName?: string | null };
  };
  const notices = (data?.notices ?? []) as Notice[];
  const events = (data?.events ?? []) as EventRow[];
  const unread = Number(data?.unreadCount ?? 0);
  const studentName = me.student?.fullName || me.displayName || 'Student';
  const classLabel = me.student?.classLabel || me.children?.[0]?.classLabel || '';
  const photo =
    me.student?.photoUrl || me.children?.find((c) => c.studentId === me.activeStudentId)?.photoUrl;

  return (
    <Screen>
      <Feed>
        <View style={styles.top}>
          <View style={styles.brand}>
            <Image source={CREST} style={styles.crest} resizeMode="contain" />
            <View>
              <Text style={styles.school}>{SCHOOL.shortName}</Text>
              <Text style={styles.motto}>{SCHOOL.tagline}</Text>
            </View>
          </View>
          <View style={styles.who}>
            <Pressable onPress={() => router.push('/(tabs)/messages')} style={styles.bell}>
              <Text style={{ fontSize: 18 }}>🔔</Text>
              {unread > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable onPress={() => router.push('/profile')} style={styles.person}>
              {photo ? (
                <Image source={{ uri: mediaUrl(photo) }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarLetter}>{studentName.charAt(0)}</Text>
                </View>
              )}
              <View>
                <Text style={styles.name} numberOfLines={1}>
                  {studentName.split(' ')[0]}
                </Text>
                {classLabel ? <Text style={styles.class}>{classLabel}</Text> : null}
              </View>
            </Pressable>
          </View>
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

        <View style={styles.hero}>
          <Image source={CAMPUS} style={styles.heroImg} />
          <LinearGradient
            colors={['rgba(11,22,88,0.15)', 'rgba(11,22,88,0.82)']}
            style={styles.heroShade}
          >
            <Text style={styles.heroKicker}>WELCOME TO</Text>
            <Text style={styles.heroTitle}>{SCHOOL.shortName}</Text>
            <Text style={styles.heroQuote}>“{SCHOOL.bannerQuote}”</Text>
          </LinearGradient>
        </View>

        <View style={styles.grid}>
          {TILES.map((tile) => (
            <Pressable
              key={tile.label}
              style={styles.tile}
              onPress={() => router.push(tile.href as never)}
            >
              <View style={[styles.tileIcon, { backgroundColor: tile.bg }]}>
                <Text style={{ fontSize: 20, color: tile.fg }}>{tile.icon}</Text>
              </View>
              <Text style={styles.tileLabel}>{tile.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionRow}>
          <View style={styles.sectionLeft}>
            <Text style={{ fontSize: 16 }}>📢</Text>
            <Text style={styles.section}>Latest Announcement</Text>
          </View>
          <Pressable onPress={() => router.push('/(tabs)/notices')}>
            <Text style={styles.seeAll}>View All ›</Text>
          </Pressable>
        </View>
        {notices[0] ? (
          <Pressable
            style={styles.announce}
            onPress={() => router.push(`/notice/${notices[0].slug}`)}
          >
            <Text style={styles.announceText}>{notices[0].title}</Text>
          </Pressable>
        ) : (
          <View style={styles.announce}>
            <Text style={styles.announceText}>
              School notices from the office will appear here.
            </Text>
          </View>
        )}

        <View style={styles.sectionRow}>
          <View style={styles.sectionLeft}>
            <Text style={{ fontSize: 16 }}>📅</Text>
            <Text style={styles.section}>Upcoming Events</Text>
          </View>
          <Pressable onPress={() => router.push('/(tabs)/calendar')}>
            <Text style={styles.seeAll}>View All ›</Text>
          </Pressable>
        </View>
        {events.slice(0, 3).map((event) => {
          const md = monthDay(event.startsAt);
          return (
            <Pressable
              key={event.slug}
              style={styles.eventRow}
              onPress={() => router.push(`/event/${event.slug}`)}
            >
              <View style={styles.dateBox}>
                <Text style={styles.dateMon}>{md.mon}</Text>
                <Text style={styles.dateDay}>{md.day}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.eventTitle}>{event.title}</Text>
                {event.startsAt ? (
                  <Text style={styles.eventWhen}>
                    {new Date(event.startsAt).toLocaleDateString('en-IN', { dateStyle: 'long' })}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.chev}>›</Text>
            </Pressable>
          );
        })}
        {!events.length ? (
          <EmptyState title="No upcoming events" body="Published school events will show here." />
        ) : null}
      </Feed>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  crest: { width: 44, height: 44 },
  school: { color: colors.navy, fontSize: 17, fontWeight: '800' },
  motto: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  who: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 110 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: '#fff', fontWeight: '800' },
  name: { color: colors.ink, fontWeight: '800', fontSize: 13 },
  class: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  bell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
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
  hero: { height: 168, borderRadius: radii.lg, overflow: 'hidden' },
  heroImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  heroShade: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: space.md,
  },
  heroKicker: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  heroQuote: { color: '#fde68a', fontStyle: 'italic', marginTop: 4, fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#fff', borderRadius: radii.lg },
  tile: { width: '25%', alignItems: 'center', paddingVertical: 12, gap: 6 },
  tileIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: { fontSize: 10, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  section: { fontWeight: '800', color: colors.ink, fontSize: 15 },
  seeAll: { color: colors.navy, fontWeight: '700', fontSize: 12 },
  announce: {
    backgroundColor: '#fff',
    borderRadius: radii.md,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#c026d3',
  },
  announceText: { color: colors.ink, fontWeight: '600', lineHeight: 20 },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: radii.md,
    padding: 12,
  },
  dateBox: {
    width: 48,
    borderRadius: 10,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    paddingVertical: 6,
  },
  dateMon: { color: colors.navy, fontSize: 10, fontWeight: '800' },
  dateDay: { color: colors.navy, fontSize: 18, fontWeight: '800' },
  eventTitle: { fontWeight: '800', color: colors.ink },
  eventWhen: { color: colors.muted, fontSize: 12, marginTop: 2 },
  chev: { color: colors.muted, fontSize: 22 },
  retry: {
    alignSelf: 'center',
    marginTop: space.md,
    backgroundColor: colors.navy,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.pill,
  },
  retryText: { color: '#fff', fontWeight: '700' },
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: space.xl },
});
