import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { mediaUrl } from '@/api/config';
import { CREST, SCHOOL } from '@/brand';
import { colors, radii, space } from '@/theme/tokens';

type Notice = { slug: string; title: string; publishedAt?: string | null };
type Period = {
  id: string;
  start: string;
  end: string;
  classLabel: string;
  subject: string;
};
type ClassRow = {
  id: string;
  label: string;
  students: number;
  percent: number | null;
};

type Props = { data: Record<string, unknown> };

const ACTIONS = [
  { icon: '👥', label: 'Take Attendance', href: '/take-attendance', tint: '#dbeafe' },
  { icon: '📝', label: 'Lesson Plan', href: '/lesson-plan', tint: '#dcfce7' },
  { icon: '📖', label: 'Homework', href: '/homework', tint: '#ffedd5' },
  { icon: '📊', label: 'Examinations', href: '/examinations', tint: '#fee2e2' },
  { icon: '📤', label: 'Upload Marks', href: '/examinations', tint: '#ede9fe' },
  { icon: '👨‍🎓', label: 'Students', href: '/(tabs)/classes', tint: '#dbeafe' },
  { icon: '📅', label: 'Timetable', href: '/timetable', tint: '#e0f2fe' },
  { icon: '📢', label: 'Notices & Circulars', href: '/(tabs)/notices', tint: '#fce7f3' },
  { icon: '✉️', label: 'Messages', href: '/(tabs)/messages', tint: '#e0e7ff' },
  { icon: '✈️', label: 'Leave Application', href: '/leave', tint: '#e0f2fe' },
  { icon: '📁', label: 'Resources', href: '/study-material', tint: '#f3e8ff' },
  { icon: '👤', label: 'Staff Directory', href: '/school', tint: '#fce7f3' },
] as const;

function noticeDate(iso?: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function barColor(pct: number | null) {
  if (pct == null) return '#cbd5e1';
  if (pct >= 90) return '#16a34a';
  if (pct >= 80) return '#f59e0b';
  return '#f97316';
}

export function StaffHome({ data }: Props) {
  const router = useRouter();
  const me = (data.me ?? {}) as {
    displayName?: string;
    staff?: { fullName?: string; photoUrl?: string | null; designation?: string | null } | null;
  };
  const desk = (data.desk ?? {}) as {
    classCount?: number;
    classLabels?: string[];
    studentCount?: number;
    todayTotal?: number;
    todayDone?: number;
    leaveRemaining?: number;
    todaySchedule?: Period[];
    classes?: ClassRow[];
  };
  const notices = (data.notices ?? []) as Notice[];
  const greeting = String(data.greeting ?? 'Hello');
  const unread = Number(data.unreadCount ?? 0);
  const name = me.staff?.fullName || me.displayName || 'Teacher';
  const photo = me.staff?.photoUrl;
  const today = new Date();
  const banner = notices[0];
  const labels = (desk.classLabels ?? []).join(', ') || 'Assigned classes';

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
            <Text style={styles.kicker}>{greeting},</Text>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.role}>{me.staff?.designation || 'Teacher'}</Text>
            <Text style={styles.quote}>
              “A good teacher can inspire hope, ignite the imagination and instill a love for
              learning.”
            </Text>
          </View>
          <Pressable onPress={() => router.push('/(tabs)/calendar')} style={styles.todayCard}>
            <Text>📅</Text>
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
          <View style={[styles.stat, { backgroundColor: '#eff6ff' }]}>
            <Text style={styles.statIcon}>👤</Text>
            <Text style={styles.statCap}>My Classes</Text>
            <Text style={styles.statValue}>{desk.classCount ?? 0}</Text>
            <Text style={styles.statSub} numberOfLines={1}>
              {labels}
            </Text>
          </View>
          <View style={[styles.stat, { backgroundColor: '#ecfdf5' }]}>
            <Text style={styles.statIcon}>👥</Text>
            <Text style={styles.statCap}>Total Students</Text>
            <Text style={styles.statValue}>{desk.studentCount ?? 0}</Text>
            <Text style={styles.statSub}>Across all classes</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: '#fff7ed' }]}>
            <Text style={styles.statIcon}>📅</Text>
            <Text style={styles.statCap}>Classes Today</Text>
            <Text style={styles.statValue}>
              {desk.todayDone ?? 0} / {desk.todayTotal ?? 0}
            </Text>
            <Text style={styles.statSub}>Completed</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: '#f5f3ff' }]}>
            <Text style={styles.statIcon}>⏱️</Text>
            <Text style={styles.statCap}>Leaves</Text>
            <Text style={styles.statValue}>{desk.leaveRemaining ?? 0}</Text>
            <Text style={styles.statSub}>Remaining</Text>
          </View>
        </View>

        {banner ? (
          <Pressable style={styles.banner} onPress={() => router.push(`/notice/${banner.slug}`)}>
            <Text style={{ fontSize: 16 }}>📢</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>{banner.title}</Text>
              <Text style={styles.bannerBody} numberOfLines={2}>
                Open this notice for the full staff update.
              </Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </Pressable>
        ) : null}

        <View style={styles.panel}>
          <View style={styles.panelHead}>
            <Text style={styles.panelTitle}>Quick Actions</Text>
            <Pressable onPress={() => router.push('/(tabs)/more')}>
              <Text style={styles.link}>View All →</Text>
            </Pressable>
          </View>
          <View style={styles.actions}>
            {ACTIONS.map((item) => (
              <Pressable
                key={item.label}
                style={styles.action}
                onPress={() => router.push(item.href as never)}
              >
                <View style={[styles.actionIcon, { backgroundColor: item.tint }]}>
                  <Text style={{ fontSize: 18 }}>{item.icon}</Text>
                </View>
                <Text style={styles.actionLabel} numberOfLines={2}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.split}>
          <View style={styles.panel}>
            <View style={styles.panelHead}>
              <Text style={styles.panelTitle}>Today’s Schedule</Text>
              <Pressable onPress={() => router.push('/timetable')}>
                <Text style={styles.link}>View Timetable</Text>
              </Pressable>
            </View>
            {(desk.todaySchedule ?? []).map((row, i, all) => (
              <Pressable
                key={row.id}
                style={styles.period}
                onPress={() => router.push('/timetable')}
              >
                <View style={styles.rail}>
                  <View style={[styles.dot, i === 0 && styles.dotOn]} />
                  {i < all.length - 1 ? <View style={styles.line} /> : null}
                </View>
                <Text style={styles.periodTime}>
                  {row.start} – {row.end}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.periodClass}>{row.classLabel}</Text>
                  <Text style={styles.periodSub}>{row.subject}</Text>
                </View>
                <Text style={styles.chev}>›</Text>
              </Pressable>
            ))}
            {!(desk.todaySchedule ?? []).length ? (
              <Text style={styles.empty}>No periods on today’s timetable.</Text>
            ) : null}
          </View>

          <View style={styles.panel}>
            <View style={styles.panelHead}>
              <Text style={styles.panelTitle}>Recent Notices</Text>
              <Pressable onPress={() => router.push('/(tabs)/notices')}>
                <Text style={styles.link}>View All →</Text>
              </Pressable>
            </View>
            {notices.slice(0, 4).map((row) => (
              <Pressable
                key={row.slug}
                style={styles.notice}
                onPress={() => router.push(`/notice/${row.slug}`)}
              >
                <View style={styles.noticeIcon}>
                  <Text>📄</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.noticeTitle} numberOfLines={1}>
                    {row.title}
                  </Text>
                  <Text style={styles.noticeWhen}>{noticeDate(row.publishedAt)}</Text>
                </View>
                <Text style={styles.chev}>›</Text>
              </Pressable>
            ))}
            {!notices.length ? (
              <Text style={styles.empty}>Notices from the office will appear here.</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHead}>
            <Text style={styles.panelTitle}>My Classes Overview</Text>
            <Pressable onPress={() => router.push('/(tabs)/classes')}>
              <Text style={styles.link}>View All Classes ›</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10 }}
          >
            {(desk.classes ?? []).map((row) => {
              const pct = row.percent;
              return (
                <Pressable
                  key={row.id}
                  style={styles.classCard}
                  onPress={() =>
                    router.push(`/take-attendance?sectionId=${encodeURIComponent(row.id)}`)
                  }
                >
                  <Text style={styles.className}>{row.label}</Text>
                  <Text style={styles.classCount}>{row.students} Students</Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${Math.min(100, Math.max(0, pct ?? 0))}%`,
                          backgroundColor: barColor(pct),
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.classPct}>
                    {pct == null ? 'Attendance pending' : `${Math.round(pct)}% Present`}
                  </Text>
                </Pressable>
              );
            })}
            {!(desk.classes ?? []).length ? (
              <Text style={styles.empty}>Your assigned classes will appear here.</Text>
            ) : null}
          </ScrollView>
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
  body: {
    flex: 1,
    backgroundColor: '#eef2fb',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  inner: { padding: space.md, paddingBottom: 36, gap: 12 },
  welcomeRow: { flexDirection: 'row', gap: 10 },
  kicker: { color: colors.muted, fontWeight: '600' },
  name: { color: colors.ink, fontWeight: '800', fontSize: 24, lineHeight: 28, marginTop: 2 },
  role: { color: colors.navy, fontWeight: '700', marginTop: 2 },
  quote: { color: '#7b849c', fontStyle: 'italic', marginTop: 8, fontSize: 12, lineHeight: 18 },
  todayCard: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  todayLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  todayDate: { color: colors.navy, fontWeight: '800', fontSize: 12 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { width: '48%', flexGrow: 1, minWidth: 140, borderRadius: 16, padding: 12 },
  statIcon: { fontSize: 16, marginBottom: 4 },
  statCap: { color: colors.muted, fontWeight: '700', fontSize: 11 },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.ink, marginTop: 2 },
  statSub: { color: colors.muted, fontSize: 11, marginTop: 2 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ecfdf5',
    borderRadius: 14,
    padding: 12,
  },
  bannerTitle: { fontWeight: '800', color: '#047857' },
  bannerBody: { color: '#0f766e', fontSize: 12, marginTop: 2 },
  panel: { backgroundColor: '#fff', borderRadius: 18, padding: 14 },
  panelHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  panelTitle: { fontWeight: '800', color: colors.ink, fontSize: 15 },
  link: { color: colors.navy, fontWeight: '700', fontSize: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap' },
  action: { width: '33.33%', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4 },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionLabel: { fontSize: 11, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  split: { gap: 12 },
  period: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8 },
  rail: { width: 14, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#c7d2fe', marginTop: 4 },
  dotOn: { backgroundColor: colors.navy },
  line: { width: 2, flex: 1, backgroundColor: '#e0e7ff', minHeight: 18 },
  periodTime: { width: 118, color: colors.muted, fontWeight: '700', fontSize: 11, marginTop: 2 },
  periodClass: { fontWeight: '800', color: colors.ink, fontSize: 13 },
  periodSub: { color: colors.muted, fontSize: 12 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  noticeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeTitle: { fontWeight: '700', color: colors.ink, fontSize: 13 },
  noticeWhen: { color: colors.muted, fontSize: 11, marginTop: 2 },
  classCard: {
    width: 160,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 12,
  },
  className: { fontWeight: '800', color: colors.ink },
  classCount: { color: colors.muted, marginTop: 4, fontSize: 12 },
  barTrack: {
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 99,
    marginTop: 10,
    overflow: 'hidden',
  },
  barFill: { height: 6, borderRadius: 99 },
  classPct: { marginTop: 6, fontSize: 11, fontWeight: '700', color: colors.navy },
  chev: { color: '#c5cbe0', fontSize: 20 },
  empty: { color: colors.muted, fontSize: 13, paddingVertical: 8 },
});
