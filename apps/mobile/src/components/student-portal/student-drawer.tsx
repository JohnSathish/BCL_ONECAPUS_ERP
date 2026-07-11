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
import { DRAWER_MENU_SECTIONS, filterDrawerByFeatureFlags } from './drawer-menu';
import { useStudentPortal } from './student-portal-context';
import { studentTheme } from './theme';
import { formatInr } from '@/utils/currency';
import { fetchExamFeeSessions } from '@/services/examination-fees';
import { useMobileConfig } from '@/hooks/useMobileConfig';

export function StudentDrawer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { drawerOpen, closeDrawer, expandedSectionId, toggleSection, home } = useStudentPortal();
  const { featureFlags } = useMobileConfig();
  const [query, setQuery] = useState('');
  const [examFeesEnabled, setExamFeesEnabled] = useState(false);
  const slide = useRef(new Animated.Value(-studentTheme.drawerWidth)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (drawerOpen) {
      Animated.parallel([
        Animated.timing(slide, { toValue: 0, duration: 260, useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
      void fetchExamFeeSessions()
        .then((sessions) => {
          setExamFeesEnabled(sessions.some((s) => String(s.status).toUpperCase() === 'ACTIVE'));
        })
        .catch(() => setExamFeesEnabled(false));
      return;
    }
    Animated.parallel([
      Animated.timing(slide, {
        toValue: -studentTheme.drawerWidth,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(backdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [backdrop, drawerOpen, slide]);

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const flagged = filterDrawerByFeatureFlags(DRAWER_MENU_SECTIONS, featureFlags);
    return flagged
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          if (item.id === 'exam-fees' && !examFeesEnabled) return false;
          if (!q) return true;
          return (
            item.label.toLowerCase().includes(q) ||
            item.keywords?.some((keyword) => keyword.includes(q))
          );
        }),
      }))
      .filter((section) => section.items.length > 0);
  }, [query, examFeesEnabled, featureFlags]);

  const studentName = home?.profile?.displayFullName ?? 'Student';
  const program = home?.profile?.programName ?? home?.profile?.programLabel ?? 'Program';
  const semester = home?.profile?.semesterLabel ?? 'Semester';
  const attendance = home?.attendance?.percentage ?? 91;
  const feeDue = home?.fees?.due ?? 0;

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
            <StudentAvatar name={studentName} photoUrl={home?.profile?.photoUrl} size={52} />
            <View style={styles.profileText}>
              <Text style={styles.profileName}>{studentName}</Text>
              <Text style={styles.profileMeta}>
                {program} • {semester}
              </Text>
              <Text style={styles.profileStatus}>{home?.profile?.status ?? 'ACTIVE'}</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Text style={styles.statLabel}>Attendance</Text>
              <Text style={styles.statValue}>{attendance}%</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statLabel}>Outstanding</Text>
              <Text style={styles.statValue}>{formatInr(feeDue)}</Text>
            </View>
          </View>

          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search modules…"
              placeholderTextColor={studentTheme.textSubtle}
              style={styles.searchInput}
            />
          </View>

          <ScrollView contentContainerStyle={styles.menuList} showsVerticalScrollIndicator={false}>
            {filteredSections.map((section) => {
              const expanded = expandedSectionId === section.id || query.length > 0;
              const isSingleItem = section.items.length === 1;

              if (isSingleItem && section.id === 'dashboard') {
                const item = section.items[0];
                return (
                  <Pressable
                    key={section.id}
                    style={styles.singleRow}
                    onPress={() => navigate(item.href)}
                  >
                    <Text style={styles.singleRowText}>
                      {section.icon} {item.label}
                    </Text>
                  </Pressable>
                );
              }

              return (
                <View key={section.id} style={styles.section}>
                  <Pressable style={styles.sectionHeader} onPress={() => toggleSection(section.id)}>
                    <Text style={styles.sectionTitle}>
                      {section.icon} {section.title}
                    </Text>
                    <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
                  </Pressable>
                  {expanded ? (
                    <View style={styles.sectionBody}>
                      {section.items.map((item) => (
                        <Pressable
                          key={item.id}
                          style={styles.menuItem}
                          onPress={() => navigate(item.href)}
                        >
                          <Text style={styles.menuItemText}>{item.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}

            <Pressable style={styles.logoutRow} onPress={() => void onLogout()}>
              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: studentTheme.drawerWidth,
    backgroundColor: studentTheme.surface,
    borderRightWidth: 1,
    borderRightColor: studentTheme.border,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  profileBlock: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: studentTheme.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  profileText: { flex: 1 },
  profileName: { fontSize: 16, fontWeight: '700', color: studentTheme.text },
  profileMeta: { fontSize: 12, color: studentTheme.textMuted, marginTop: 2 },
  profileStatus: {
    marginTop: 4,
    alignSelf: 'flex-start',
    fontSize: 10,
    fontWeight: '700',
    color: studentTheme.success,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  statPill: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statLabel: { fontSize: 10, color: studentTheme.textMuted, textTransform: 'uppercase' },
  statValue: { fontSize: 14, fontWeight: '700', color: studentTheme.text, marginTop: 2 },
  searchBox: {
    marginHorizontal: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: studentTheme.text },
  menuList: { paddingHorizontal: 12, paddingBottom: 24, gap: 6 },
  singleRow: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#eff6ff',
  },
  singleRowText: { fontSize: 15, fontWeight: '600', color: studentTheme.primary },
  section: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: studentTheme.text },
  chevron: { fontSize: 11, color: studentTheme.textMuted },
  sectionBody: { backgroundColor: '#fff' },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  menuItemText: { fontSize: 14, color: '#334155' },
  logoutRow: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  logoutText: { color: studentTheme.danger, fontWeight: '700', fontSize: 14 },
});
