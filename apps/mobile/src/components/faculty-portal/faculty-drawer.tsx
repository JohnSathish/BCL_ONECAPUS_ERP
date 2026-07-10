import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { logout } from '@/auth/logout';
import { StudentAvatar } from '@/components/student-portal/student-avatar';
import { FACULTY_DRAWER_SECTIONS } from './drawer-menu';
import { useFacultyPortal } from './faculty-portal-context';
import { facultyTheme } from './theme';

export function FacultyDrawer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { drawerOpen, closeDrawer, home } = useFacultyPortal();
  const [query, setQuery] = useState('');
  const slide = useRef(new Animated.Value(-facultyTheme.drawerWidth)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (drawerOpen) {
      Animated.parallel([
        Animated.timing(slide, { toValue: 0, duration: 260, useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
      return;
    }
    Animated.parallel([
      Animated.timing(slide, {
        toValue: -facultyTheme.drawerWidth,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(backdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [backdrop, drawerOpen, slide]);

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FACULTY_DRAWER_SECTIONS;
    return FACULTY_DRAWER_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.keywords?.some((keyword) => keyword.includes(q)),
      ),
    })).filter((section) => section.items.length > 0);
  }, [query]);

  function badgeCount(item: (typeof FACULTY_DRAWER_SECTIONS)[number]['items'][number]) {
    if (!item.badgeFrom || !home) return 0;
    if (item.badgeFrom === 'notifications') return home.unreadNotificationCount ?? 0;
    if (item.badgeFrom === 'attendancePending') {
      return home.workloadSummary?.attendancePending ?? 0;
    }
    if (item.badgeFrom === 'marksPending') {
      return home.workloadSummary?.marksPending ?? 0;
    }
    return 0;
  }

  const name = home?.profile?.fullName ?? 'Faculty';
  const designation = home?.profile?.designation ?? 'Staff';
  const department = home?.profile?.department ?? 'Department';
  const classesToday = home?.workloadSummary?.classesToday ?? 0;
  const pending =
    (home?.workloadSummary?.attendancePending ?? 0) +
    (home?.workloadSummary?.marksPending ?? 0) +
    (home?.unreadNotificationCount ?? 0);

  function navigate(href: string) {
    closeDrawer();
    setQuery('');
    router.push(href as never);
  }

  async function onLogout() {
    closeDrawer();
    await logout();
    router.replace('/(auth)/login');
  }

  return (
    <Modal visible={drawerOpen} transparent animationType="none" onRequestClose={closeDrawer}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeDrawer} />
        </Animated.View>

        <Animated.View
          style={[
            styles.panel,
            {
              paddingTop: insets.top + 8,
              paddingBottom: insets.bottom + 12,
              transform: [{ translateX: slide }],
            },
          ]}
        >
          <View style={styles.profileBlock}>
            <StudentAvatar name={name} photoUrl={home?.profile?.photoUrl} size={52} />
            <View style={styles.profileText}>
              <Text style={styles.profileName}>{name}</Text>
              <Text style={styles.profileMeta}>{designation}</Text>
              <Text style={styles.profileDept}>{department}</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Text style={styles.statLabel}>Today</Text>
              <Text style={styles.statValue}>{classesToday} classes</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statLabel}>Pending</Text>
              <Text style={[styles.statValue, pending > 0 && styles.statUrgent]}>{pending}</Text>
            </View>
          </View>

          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search modules…"
              placeholderTextColor={facultyTheme.textSubtle}
              style={styles.searchInput}
            />
          </View>

          <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
            {filteredSections.map((section) => (
              <View key={section.id} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {section.items.map((item) => {
                  const count = badgeCount(item);
                  return (
                    <Pressable
                      key={item.id}
                      style={styles.menuItem}
                      onPress={() => navigate(item.href)}
                    >
                      <Text style={styles.menuIcon}>{item.icon}</Text>
                      <Text style={styles.menuLabel}>{item.label}</Text>
                      {count > 0 ? (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>

          <Pressable style={styles.logoutBtn} onPress={() => void onLogout()}>
            <Text style={styles.logoutText}>Sign out</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.45)' },
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: facultyTheme.drawerWidth,
    backgroundColor: facultyTheme.surface,
    borderRightWidth: 1,
    borderRightColor: facultyTheme.border,
    paddingHorizontal: 14,
    gap: 10,
  },
  profileBlock: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  profileText: { flex: 1, gap: 2 },
  profileName: { fontSize: 15, fontWeight: '800', color: facultyTheme.text },
  profileMeta: { fontSize: 12, color: facultyTheme.textMuted, fontWeight: '600' },
  profileDept: { fontSize: 11, color: facultyTheme.textSubtle },
  statsRow: { flexDirection: 'row', gap: 8 },
  statPill: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: facultyTheme.border,
  },
  statLabel: { fontSize: 10, color: facultyTheme.textMuted, fontWeight: '600' },
  statValue: { fontSize: 13, fontWeight: '800', color: facultyTheme.text, marginTop: 2 },
  statUrgent: { color: facultyTheme.urgent },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: facultyTheme.border,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: facultyTheme.text },
  menuScroll: { flex: 1 },
  section: { marginBottom: 8 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: facultyTheme.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
    marginTop: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  menuIcon: { fontSize: 16, width: 22, textAlign: 'center' },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: facultyTheme.text },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: facultyTheme.urgent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  logoutBtn: {
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutText: { color: '#DC2626', fontWeight: '700', fontSize: 14 },
});
