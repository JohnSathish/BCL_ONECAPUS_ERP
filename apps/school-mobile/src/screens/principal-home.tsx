import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { mediaUrl } from '@/api/config';
import { CAMPUS, CREST, SCHOOL } from '@/brand';
import { colors, radii, space } from '@/theme/tokens';

type Notice = { slug: string; title: string; publishedAt?: string | null };
type EventRow = { slug: string; title: string; startsAt?: string | null; venue?: string | null };

type Props = {
  data: Record<string, unknown>;
};

const TILES = [
  {
    icon: '📢',
    label: 'Announcements',
    hint: 'Send messages to students, parents & staff',
    href: '/(tabs)/messages',
    tint: '#eff6ff',
    fg: '#2563eb',
  },
  {
    icon: '👥',
    label: 'Students',
    hint: 'View student records and details',
    href: '/academics',
    tint: '#ecfdf5',
    fg: '#059669',
  },
  {
    icon: '🧑‍🏫',
    label: 'Teachers',
    hint: 'Manage staff information',
    href: '/school',
    tint: '#f5f3ff',
    fg: '#7c3aed',
  },
  {
    icon: '📅',
    label: 'Academics',
    hint: 'Classes, subjects and timetable',
    href: '/academics',
    tint: '#fff7ed',
    fg: '#ea580c',
  },
  {
    icon: '📊',
    label: 'Examinations',
    hint: 'Results and performance',
    href: '/examinations',
    tint: '#fef2f2',
    fg: '#dc2626',
  },
  {
    icon: '✅',
    label: 'Attendance',
    hint: 'View attendance summary',
    href: '/attendance',
    tint: '#ecfdf5',
    fg: '#16a34a',
  },
  {
    icon: '₹',
    label: 'Fees',
    hint: 'Overview and fee reports',
    href: '/fees',
    tint: '#eef2ff',
    fg: '#4f46e5',
  },
  {
    icon: '📄',
    label: 'Notices & Circulars',
    hint: 'Manage school notices',
    href: '/(tabs)/notices',
    tint: '#eff6ff',
    fg: '#1d4ed8',
  },
  {
    icon: '⚙️',
    label: 'Settings',
    hint: 'App preferences and security',
    href: '/security',
    tint: '#f8fafc',
    fg: '#475569',
  },
] as const;

const VALUES = ['Discipline', 'Excellence', 'Character', 'Service'];

function ago(iso?: string | null) {
  if (!iso) return 'Recently';
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.max(1, Math.floor(ms / 60000));
  if (mins < 60) return `Posted ${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Posted ${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  return `Posted ${days} day${days === 1 ? '' : 's'} ago`;
}

function eventWhen(iso?: string | null) {
  if (!iso) return { day: '—', mon: '', time: '' };
  const d = new Date(iso);
  return {
    day: String(d.getDate()).padStart(2, '0'),
    mon: d.toLocaleDateString('en-IN', { month: 'short' }),
    time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  };
}

export function PrincipalHome({ data }: Props) {
  const router = useRouter();
  const me = (data.me ?? {}) as {
    displayName?: string;
    persona?: string;
    staff?: { fullName?: string; photoUrl?: string | null; designation?: string | null } | null;
  };
  const office = (data.office ?? {}) as {
    students?: number;
    teachers?: number;
    classes?: number;
    attendanceToday?: number | null;
  };
  const notices = (data.notices ?? []) as Notice[];
  const events = (data.events ?? []) as EventRow[];
  const unread = Number(data.unreadCount ?? 0);
  const name = me.staff?.fullName || me.displayName || 'Principal';
  const photo = me.staff?.photoUrl;
  const today = new Date();
  const att = office.attendanceToday != null ? `${Math.round(office.attendanceToday)}%` : '—';

  const stats = [
    {
      label: 'Total Students',
      value: String(office.students ?? '—'),
      tint: '#eff6ff',
      icon: '👤',
      href: '/academics',
    },
    {
      label: 'Teachers',
      value: String(office.teachers ?? '—'),
      tint: '#ecfdf5',
      icon: '🧑‍🏫',
      href: '/school',
    },
    {
      label: 'Classes',
      value: String(office.classes ?? '—'),
      tint: '#fffbeb',
      icon: '🏫',
      href: '/academics',
    },
    { label: 'Attendance Today', value: att, tint: '#fdf2f8', icon: '🎓', href: '/attendance' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.push('/(tabs)/more')} hitSlop={10} style={styles.iconBtn}>
          <Text style={styles.menuGlyph}>☰</Text>
        </Pressable>
        <Image source={CREST} style={styles.crest} resizeMode="contain" />
        <View style={styles.headerText}>
          <Text style={styles.headerSchool} numberOfLines={1}>
            {SCHOOL.legalName}
          </Text>
          <Text style={styles.headerPlace}>{SCHOOL.placeShort.replace(' • ', ', ')}</Text>
        </View>
        <Pressable onPress={() => router.push('/(tabs)/messages')} style={styles.iconBtn}>
          <Text style={{ fontSize: 18 }}>🔔</Text>
          {unread > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          ) : null}
        </Pressable>
        <Pressable onPress={() => router.push('/profile')} style={styles.avatarWrap}>
          {photo ? (
            <Image source={{ uri: mediaUrl(photo) }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarLetter}>{name.charAt(0)}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.inner}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.welcomeRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.welcomeKicker}>Welcome back,</Text>
            <Text style={styles.welcomeName} numberOfLines={2}>
              {name}
            </Text>
            <Text style={styles.lead}>Lead · Guide · Inspire</Text>
          </View>
          <Pressable onPress={() => router.push('/(tabs)/calendar')} style={styles.todayCard}>
            <Text style={styles.todayIcon}>📅</Text>
            <View>
              <Text style={styles.todayLabel}>Today</Text>
              <Text style={styles.todayDate}>
                {today.toLocaleDateString('en-IN', {
                  weekday: 'short',
                  day: '2-digit',
                  month: 'short',
                })}
              </Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </Pressable>
        </View>

        <View style={styles.stats}>
          {stats.map((row) => (
            <Pressable
              key={row.label}
              style={[styles.stat, { backgroundColor: row.tint }]}
              onPress={() => router.push(row.href as never)}
            >
              <Text style={styles.statIcon}>{row.icon}</Text>
              <Text style={styles.statValue}>{row.value}</Text>
              <Text style={styles.statLabel}>{row.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.hero}>
          <Image source={CAMPUS} style={styles.heroImg} />
          <LinearGradient
            colors={['rgba(10,18,72,0.15)', 'rgba(10,18,72,0.88)']}
            start={{ x: 0, y: 0.2 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroShade}
          >
            <View style={{ flex: 1, justifyContent: 'flex-end' }}>
              <Text style={styles.heroTitle}>Together for{'\n'}a Brighter Tomorrow</Text>
              <Text style={styles.heroQuote}>“{SCHOOL.motto}”</Text>
              <Text style={styles.heroSchool}>{SCHOOL.legalName}</Text>
            </View>
            <View style={styles.values}>
              {VALUES.map((v) => (
                <Text key={v} style={styles.value}>
                  {v}
                </Text>
              ))}
            </View>
          </LinearGradient>
        </View>

        <View style={styles.grid}>
          {TILES.map((tile) => (
            <Pressable
              key={tile.label}
              style={styles.tile}
              onPress={() => router.push(tile.href as never)}
            >
              <View style={[styles.tileIcon, { backgroundColor: tile.tint }]}>
                <Text style={{ fontSize: 20 }}>{tile.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tileLabel}>{tile.label}</Text>
                <Text style={styles.tileHint} numberOfLines={2}>
                  {tile.hint}
                </Text>
              </View>
              <Text style={styles.tileChev}>›</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.split}>
          <View style={styles.panel}>
            <View style={styles.panelHead}>
              <Text style={styles.panelTitle}>Recent Activities</Text>
              <Pressable onPress={() => router.push('/(tabs)/notices')}>
                <Text style={styles.viewAll}>View All</Text>
              </Pressable>
            </View>
            {notices.slice(0, 3).map((row) => (
              <Pressable
                key={row.slug}
                style={styles.activity}
                onPress={() => router.push(`/notice/${row.slug}`)}
              >
                <View style={styles.activityDot}>
                  <Text>📢</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activityTitle} numberOfLines={1}>
                    {row.title}
                  </Text>
                  <Text style={styles.activityWhen}>{ago(row.publishedAt)}</Text>
                </View>
                <Text style={styles.chev}>›</Text>
              </Pressable>
            ))}
            {!notices.length ? (
              <Text style={styles.empty}>School notices will appear here.</Text>
            ) : null}
          </View>

          <View style={styles.panel}>
            <View style={styles.panelHead}>
              <Text style={styles.panelTitle}>Upcoming Events</Text>
              <Pressable onPress={() => router.push('/(tabs)/calendar')}>
                <Text style={styles.viewAll}>View All</Text>
              </Pressable>
            </View>
            {events.slice(0, 3).map((row) => {
              const when = eventWhen(row.startsAt);
              return (
                <Pressable
                  key={row.slug}
                  style={styles.activity}
                  onPress={() => router.push(`/event/${row.slug}`)}
                >
                  <View style={styles.eventDate}>
                    <Text style={styles.eventDay}>{when.day}</Text>
                    <Text style={styles.eventMon}>{when.mon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityTitle} numberOfLines={1}>
                      {row.title}
                    </Text>
                    <Text style={styles.activityWhen}>
                      {when.time}
                      {row.venue ? ` · ${row.venue}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.chev}>›</Text>
                </Pressable>
              );
            })}
            {!events.length ? (
              <Text style={styles.empty}>Upcoming school events will appear here.</Text>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuGlyph: { color: '#fff', fontSize: 22, fontWeight: '700' },
  crest: { width: 36, height: 36 },
  headerText: { flex: 1 },
  headerSchool: { color: '#fff', fontWeight: '800', fontSize: 13 },
  headerPlace: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600' },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: colors.danger,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  avatarWrap: { padding: 2 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3d4db3',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  avatarLetter: { color: '#fff', fontWeight: '800' },
  body: {
    flex: 1,
    backgroundColor: '#eef2fb',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  inner: { padding: space.md, paddingBottom: 36, gap: 14 },
  welcomeRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  welcomeKicker: { color: colors.muted, fontWeight: '600', fontSize: 13 },
  welcomeName: { color: colors.ink, fontWeight: '800', fontSize: 24, lineHeight: 28, marginTop: 2 },
  lead: { color: '#8b93b0', fontWeight: '700', fontSize: 12, marginTop: 4 },
  todayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  todayIcon: { fontSize: 16 },
  todayLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  todayDate: { color: colors.navy, fontWeight: '800', fontSize: 12 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: {
    width: '48%',
    flexGrow: 1,
    borderRadius: 16,
    padding: 12,
    minWidth: 140,
  },
  statIcon: { fontSize: 16, marginBottom: 6 },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.ink },
  statLabel: { color: colors.muted, fontWeight: '700', fontSize: 11, marginTop: 2 },
  hero: { height: 168, borderRadius: radii.lg, overflow: 'hidden' },
  heroImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  heroShade: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800', lineHeight: 26 },
  heroQuote: { color: 'rgba(255,255,255,0.9)', fontStyle: 'italic', marginTop: 8, fontSize: 12 },
  heroSchool: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 4, fontWeight: '600' },
  values: { justifyContent: 'flex-end', alignItems: 'flex-end', gap: 4 },
  value: { color: 'rgba(255,255,255,0.92)', fontWeight: '700', fontSize: 11 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    width: '100%',
    maxWidth: '100%',
    flexGrow: 1,
    minWidth: 150,
    flexBasis: '31%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: { fontWeight: '800', color: colors.ink, fontSize: 13 },
  tileHint: { color: colors.muted, fontSize: 11, marginTop: 2, lineHeight: 14 },
  tileChev: { color: '#c5cbe0', fontSize: 20 },
  split: { gap: 12 },
  panel: { backgroundColor: '#fff', borderRadius: 18, padding: 14 },
  panelHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  panelTitle: { fontWeight: '800', color: colors.ink, fontSize: 15 },
  viewAll: { color: colors.navy, fontWeight: '700', fontSize: 12 },
  activity: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  activityDot: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTitle: { fontWeight: '700', color: colors.ink, fontSize: 13 },
  activityWhen: { color: colors.muted, fontSize: 11, marginTop: 2 },
  eventDate: {
    width: 44,
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    borderRadius: 10,
    paddingVertical: 6,
  },
  eventDay: { color: colors.navy, fontWeight: '800', fontSize: 16 },
  eventMon: { color: colors.navy, fontWeight: '700', fontSize: 10 },
  chev: { color: '#c5cbe0', fontSize: 20 },
  empty: { color: colors.muted, fontSize: 13, paddingVertical: 8 },
});
