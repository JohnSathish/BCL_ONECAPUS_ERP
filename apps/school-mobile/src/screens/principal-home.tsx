import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { CREST, SCHOOL } from '@/brand';
import { inr } from '@/fees/format';
import { colors, space } from '@/theme/tokens';

type Notice = { slug: string; title: string; publishedAt?: string | null };
type EventRow = { slug: string; title: string; startsAt?: string | null; venue?: string | null };
type Desk = {
  kpis?: {
    present?: number;
    absent?: number;
    late?: number;
    classesMarked?: number;
    classesTotal?: number;
    feeCollectedMonth?: number;
    feePending?: number;
    feePendingStudents?: number;
    examsUpcoming?: number;
    examsOngoing?: number;
    marksPending?: number;
  };
};

type Props = { data: Record<string, unknown> };

const TILES = [
  {
    icon: '📢',
    label: 'Announcements',
    hint: 'Send a message to the school family',
    href: '/office/announcements',
    tint: '#eff6ff',
  },
  {
    icon: '👥',
    label: 'Students',
    hint: 'Search rolls, classes and profiles',
    href: '/office/students',
    tint: '#ecfdf5',
  },
  {
    icon: '🧑‍🏫',
    label: 'Teachers',
    hint: 'Staff directory and contacts',
    href: '/office/teachers',
    tint: '#f5f3ff',
  },
  {
    icon: '📅',
    label: 'Academics',
    hint: 'Classes, sections and class teachers',
    href: '/office/academics',
    tint: '#fff7ed',
  },
  {
    icon: '📊',
    label: 'Examinations',
    hint: 'Schedules, marks and pass rate',
    href: '/office/examinations',
    tint: '#fef2f2',
  },
  {
    icon: '✅',
    label: 'Attendance',
    hint: 'Today’s class-wise present roll',
    href: '/office/attendance',
    tint: '#ecfdf5',
  },
  {
    icon: '₹',
    label: 'Fees',
    hint: 'Collection, pending and receipts',
    href: '/office/fees',
    tint: '#eef2ff',
  },
  {
    icon: '📄',
    label: 'Notices & Circulars',
    hint: 'Website circulars and app notices',
    href: '/office/notices',
    tint: '#eff6ff',
  },
  {
    icon: '⚙️',
    label: 'Settings',
    hint: 'App lock and account security',
    href: '/security',
    tint: '#f8fafc',
  },
] as const;

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
  const [desk, setDesk] = useState<Desk | null>(null);
  const me = (data.me ?? {}) as {
    displayName?: string;
    staff?: { fullName?: string; photoUrl?: string | null; designation?: string | null } | null;
  };
  const office = (data.office ?? {}) as {
    students?: number;
    teachers?: number;
    classes?: number;
    attendanceToday?: number | null;
    present?: number;
    absent?: number;
    classesMarked?: number;
    classesTotal?: number;
  };
  const notices = (data.notices ?? []) as Notice[];
  const events = (data.events ?? []) as EventRow[];
  const unread = Number(data.unreadCount ?? 0);
  const name = me.staff?.fullName || me.displayName || 'Principal';
  const photo = me.staff?.photoUrl;
  const today = new Date();
  const att = office.attendanceToday != null ? `${Math.round(office.attendanceToday)}%` : '—';
  const kpis = desk?.kpis;

  useEffect(() => {
    apiFetch<Desk>('/v1/school-mobile/principal/desk')
      .then(setDesk)
      .catch(() => setDesk(null));
  }, []);

  const stats = [
    {
      label: 'Total Students',
      value: String(office.students ?? '—'),
      tint: '#eff6ff',
      icon: '👤',
      href: '/office/students',
    },
    {
      label: 'Teachers',
      value: String(office.teachers ?? '—'),
      tint: '#ecfdf5',
      icon: '🧑‍🏫',
      href: '/office/teachers',
    },
    {
      label: 'Classes',
      value: String(office.classes ?? '—'),
      tint: '#fffbeb',
      icon: '🏫',
      href: '/office/academics',
    },
    {
      label: 'Attendance Today',
      value: att,
      tint: '#fdf2f8',
      icon: '🎓',
      href: '/office/attendance',
    },
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
            <Text style={styles.welcomeKicker}>Good to have you in,</Text>
            <Text style={styles.welcomeName} numberOfLines={2}>
              {name}
            </Text>
            <Text style={styles.lead}>
              {me.staff?.designation || 'Principal'} · Lead · Guide · Inspire
            </Text>
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

        <View style={styles.insights}>
          <Pressable style={styles.insight} onPress={() => router.push('/office/attendance')}>
            <Text style={styles.insightKicker}>Attendance pulse</Text>
            <Text style={styles.insightValue}>{att}</Text>
            <Text style={styles.insightHint}>
              {kpis?.present ?? office.present ?? 0} present · {kpis?.absent ?? office.absent ?? 0}{' '}
              absent
            </Text>
            <Text style={styles.insightFoot}>
              {kpis?.classesMarked ?? office.classesMarked ?? 0}/
              {kpis?.classesTotal ?? office.classesTotal ?? 0} classes marked
            </Text>
          </Pressable>
          <Pressable
            style={[styles.insight, styles.insightFee]}
            onPress={() => router.push('/office/fees')}
          >
            <Text style={styles.insightKicker}>Fees this month</Text>
            <Text style={styles.insightValue}>{inr(kpis?.feeCollectedMonth ?? 0)}</Text>
            <Text style={styles.insightHint}>
              {kpis?.feePendingStudents ?? 0} students still pending
            </Text>
            <Text style={styles.insightFoot}>Open the collection desk →</Text>
          </Pressable>
        </View>

        <Pressable style={styles.examStrip} onPress={() => router.push('/office/examinations')}>
          <View style={{ flex: 1 }}>
            <Text style={styles.examTitle}>Examination desk</Text>
            <Text style={styles.examHint}>
              {kpis?.examsOngoing ?? 0} ongoing · {kpis?.examsUpcoming ?? 0} upcoming ·{' '}
              {kpis?.marksPending ?? 0} marks pending
            </Text>
          </View>
          <Text style={styles.examChev}>›</Text>
        </Pressable>

        <Text style={styles.section}>Principal’s office</Text>
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
              <Text style={styles.panelTitle}>Recent circulars</Text>
              <Pressable onPress={() => router.push('/office/notices')}>
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
              <Text style={styles.panelTitle}>Upcoming events</Text>
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
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
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
  body: { flex: 1, backgroundColor: '#eef2fb', borderTopLeftRadius: 22, borderTopRightRadius: 22 },
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
  stat: { width: '48%', flexGrow: 1, borderRadius: 16, padding: 12, minWidth: 140 },
  statIcon: { fontSize: 16, marginBottom: 6 },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.ink },
  statLabel: { color: colors.muted, fontWeight: '700', fontSize: 11, marginTop: 2 },
  insights: { flexDirection: 'row', gap: 8 },
  insight: { flex: 1, backgroundColor: colors.navy, borderRadius: 18, padding: 14 },
  insightFee: { backgroundColor: '#0f766e' },
  insightKicker: { color: 'rgba(255,255,255,0.75)', fontWeight: '700', fontSize: 11 },
  insightValue: { color: '#fff', fontWeight: '800', fontSize: 22, marginTop: 6 },
  insightHint: { color: 'rgba(255,255,255,0.82)', marginTop: 6, fontSize: 11, lineHeight: 15 },
  insightFoot: { color: 'rgba(255,255,255,0.65)', marginTop: 8, fontSize: 11, fontWeight: '700' },
  examStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
  },
  examTitle: { fontWeight: '800', color: colors.ink },
  examHint: { color: colors.muted, marginTop: 3, fontSize: 12 },
  examChev: { color: '#c5cbe0', fontSize: 22 },
  section: { fontWeight: '800', color: colors.ink, fontSize: 15 },
  grid: { gap: 8 },
  tile: {
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
  tileLabel: { fontWeight: '800', color: colors.ink, fontSize: 14 },
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
