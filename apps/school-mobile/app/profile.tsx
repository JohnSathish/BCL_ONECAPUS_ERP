import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { confirmLogout } from '@/auth/logout';
import { Loader } from '@/ui/kit';
import { colors } from '@/theme/tokens';
import { isPrincipalUser, isStaffUser } from '@/persona';

type Guardian = { fullName: string; relation: string; phone?: string | null };
type Child = {
  studentId: string;
  classLabel?: string | null;
  rollNumber?: string | null;
  academicYearName?: string | null;
};
type Me = {
  persona?: string;
  displayName?: string;
  email?: string;
  activeStudentId?: string | null;
  children?: Child[];
  staff?: { fullName?: string; photoUrl?: string | null; designation?: string | null } | null;
  student?: {
    fullName?: string;
    admissionNumber?: string;
    classLabel?: string | null;
    photoUrl?: string | null;
    phone?: string | null;
    gender?: string | null;
    status?: string | null;
    rollNumber?: string | null;
    academicYearName?: string | null;
    guardians?: Guardian[];
  } | null;
};

const MENU: Array<{
  icon: string;
  tint: string;
  label: string;
  hint: string;
  href?: string;
  logout?: boolean;
}> = [
  {
    icon: '👤',
    tint: '#dbeafe',
    label: 'Personal Information',
    hint: 'View and update your details',
    href: '/profile-personal',
  },
  {
    icon: '👨‍👩‍👧',
    tint: '#fce7f3',
    label: 'Parent / Guardian Details',
    hint: 'View family information',
    href: '/profile-guardians',
  },
  {
    icon: '📘',
    tint: '#ede9fe',
    label: 'Academic Information',
    hint: 'Class, section, subjects, etc.',
    href: '/academics',
  },
  {
    icon: '✅',
    tint: '#dcfce7',
    label: 'Attendance',
    hint: 'View your attendance record',
    href: '/attendance',
  },
  {
    icon: '📋',
    tint: '#ffedd5',
    label: 'Examination Results',
    hint: 'Check your exam scores',
    href: '/examinations',
  },
  {
    icon: '🔒',
    tint: '#e0e7ff',
    label: 'Change Password',
    hint: 'Update your account password',
    href: '/password',
  },
  {
    icon: '⚙️',
    tint: '#e0f2fe',
    label: 'Settings',
    hint: 'App preferences and security',
    href: '/security',
  },
  {
    icon: '⎋',
    tint: '#ffe4e6',
    label: 'Logout',
    hint: 'Sign out from your account',
    logout: true,
  },
];

function prettyStatus(value?: string | null) {
  if (!value) return 'Active';
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export default function ProfileScreen() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    apiFetch<Me>('/v1/school-mobile/me')
      .then(setMe)
      .catch(() => setMe({}));
  }, []);

  if (!me) {
    return (
      <SafeAreaView style={styles.page} edges={['top', 'left', 'right']}>
        <Loader />
      </SafeAreaView>
    );
  }

  const name = me.staff?.fullName || me.student?.fullName || me.displayName || 'Student';
  const photo = me.staff?.photoUrl || me.student?.photoUrl;
  const staff = isStaffUser(me) || isPrincipalUser(me);
  const menu = MENU.filter((item) => {
    if (!staff) return true;
    return !['Parent / Guardian Details', 'Academic Information', 'Examination Results'].includes(
      item.label,
    );
  }).map((item) =>
    staff && item.label === 'Attendance'
      ? { ...item, hint: 'Mark class attendance', href: '/take-attendance' }
      : item,
  );
  const child =
    me.children?.find((row) => row.studentId === me.activeStudentId) ?? me.children?.[0];
  const classLabel = me.student?.classLabel || child?.classLabel || '—';
  const roll = me.student?.rollNumber || child?.rollNumber || '—';
  const year = me.student?.academicYearName || child?.academicYearName || '—';
  const active = prettyStatus(me.student?.status);

  const logout = () => confirmLogout(() => router.replace('/login'));

  return (
    <View style={styles.page}>
      <LinearGradient colors={['#1a237e', '#283593']} style={styles.hero}>
        <SafeAreaView edges={['top']} style={styles.heroBar}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>‹</Text>
          </Pressable>
          <Text style={styles.heroTitle}>My Profile</Text>
          <Pressable onPress={() => router.push('/security')} hitSlop={12} style={styles.iconBtn}>
            <Text style={styles.gear}>⚙</Text>
          </Pressable>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.identity}>
          <View>
            {photo ? (
              <Image source={{ uri: mediaUrl(photo) }} style={styles.photo} />
            ) : (
              <View style={styles.fallback}>
                <Text style={styles.letter}>{name.charAt(0)}</Text>
              </View>
            )}
            <View style={styles.cam}>
              <Text style={styles.camText}>📷</Text>
            </View>
          </View>
          <View style={styles.who}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={2}>
                {name}
              </Text>
              <Pressable onPress={() => router.push('/profile-personal')} hitSlop={8}>
                <Text style={styles.edit}>✎</Text>
              </Pressable>
            </View>
            {me.student?.classLabel ? (
              <Text style={styles.meta}>{me.student.classLabel}</Text>
            ) : null}
            {me.student?.admissionNumber ? (
              <Text style={styles.meta}>Admission No. {me.student.admissionNumber}</Text>
            ) : null}
            <View style={styles.status}>
              <View style={styles.dot} />
              <Text style={styles.statusText}>{active}</Text>
            </View>
          </View>
        </View>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statIcon}>🎓</Text>
            <Text style={styles.statLabel}>Class</Text>
            <Text style={styles.statValue} numberOfLines={1}>
              {classLabel}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statIcon}>👥</Text>
            <Text style={styles.statLabel}>Roll No.</Text>
            <Text style={styles.statValue} numberOfLines={1}>
              {roll}
            </Text>
          </View>
          <View style={[styles.stat, styles.statLast]}>
            <Text style={styles.statIcon}>📅</Text>
            <Text style={styles.statLabel}>Academic Year</Text>
            <Text style={styles.statValue} numberOfLines={1}>
              {year}
            </Text>
          </View>
        </View>

        {menu.map((item) => (
          <Pressable
            key={item.label}
            onPress={() => (item.logout ? logout() : router.push(item.href as never))}
            style={styles.row}
          >
            <View style={[styles.rowIcon, { backgroundColor: item.tint }]}>
              <Text style={{ fontSize: 18 }}>{item.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, item.logout && { color: colors.danger }]}>
                {item.label}
              </Text>
              <Text style={styles.rowHint}>{item.hint}</Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#eef2fb' },
  hero: {
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  iconBtnText: { color: '#fff', fontSize: 32, marginTop: -4, fontWeight: '300' },
  gear: { color: '#fff', fontSize: 18 },
  heroTitle: { flex: 1, textAlign: 'center', color: '#fff', fontWeight: '800', fontSize: 18 },
  body: { padding: 16, paddingTop: 18, gap: 12, paddingBottom: 40 },
  identity: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 16,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    shadowColor: '#1a237e',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  photo: { width: 84, height: 84, borderRadius: 42 },
  fallback: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: { color: '#fff', fontSize: 32, fontWeight: '800' },
  cam: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  camText: { fontSize: 11 },
  who: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  name: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.ink, textTransform: 'uppercase' },
  edit: { color: colors.navy, fontSize: 16 },
  meta: { color: colors.muted, marginTop: 2, fontSize: 13 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  statusText: { color: '#16a34a', fontWeight: '700', fontSize: 13 },
  stats: {
    backgroundColor: '#fff',
    borderRadius: 22,
    flexDirection: 'row',
    paddingVertical: 14,
    shadowColor: '#1a237e',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#e8edf6',
    gap: 2,
  },
  statLast: { borderRightWidth: 0 },
  statIcon: { fontSize: 16 },
  statLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  statValue: { color: colors.ink, fontWeight: '800', fontSize: 13, paddingHorizontal: 6 },
  row: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#1a237e',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { fontWeight: '800', color: colors.ink, fontSize: 15 },
  rowHint: { color: colors.muted, fontSize: 12, marginTop: 2 },
  chev: { color: '#94a3b8', fontSize: 26, fontWeight: '300' },
});
