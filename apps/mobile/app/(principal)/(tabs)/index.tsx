import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { principalTheme, severityColor } from '@/components/principal-portal/theme';
import { StudentAvatar } from '@/components/student-portal/student-avatar';
import { COLLEGE_NAME } from '@/constants/release';
import { fetchPrincipalMobileSummary } from '@/services/principal-desk';
import type { PrincipalMobileSummary } from '@/types/principal-desk';
import { formatInr } from '@/utils/currency';

const SCREEN_W = Dimensions.get('window').width;

function formatKpi(value: number, money = false) {
  if (money) return formatInr(value);
  return value.toLocaleString('en-IN');
}

function trendLabel(pct: number | null | undefined, fallback: string) {
  if (pct == null || Number.isNaN(pct)) return fallback;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct}% vs last period`;
}

function AttendanceRing({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <View style={styles.ringWrap}>
      <View style={styles.ringOuter}>
        <View
          style={[
            styles.ringArc,
            {
              borderColor: principalTheme.primaryAccent,
              // Visual fill cue — RN has no SVG ring by default; use layered circle.
              borderTopColor: clamped >= 25 ? principalTheme.primaryAccent : principalTheme.border,
              borderRightColor:
                clamped >= 50 ? principalTheme.primaryAccent : principalTheme.border,
              borderBottomColor:
                clamped >= 75 ? principalTheme.primaryAccent : principalTheme.border,
              borderLeftColor: clamped >= 12 ? principalTheme.primaryAccent : principalTheme.border,
              transform: [{ rotate: '-45deg' }],
            },
          ]}
        />
        <View style={styles.ringInner}>
          <Text style={styles.ringValue}>{clamped.toFixed(1)}%</Text>
          <Text style={styles.ringCaption}>Overall{'\n'}Attendance</Text>
        </View>
      </View>
    </View>
  );
}

function ActionIcon({ name, color }: { name?: string; color: string }) {
  const map: Record<string, keyof typeof Ionicons.glyphMap> = {
    megaphone: 'megaphone',
    calendar: 'calendar',
    document: 'document-text',
    person: 'person',
    chat: 'chatbubbles',
    list: 'list',
    search: 'search',
    school: 'school',
  };
  const glyph = (name && map[name]) || 'ellipse';
  return <Ionicons name={glyph} size={22} color={color} />;
}

export default function PrincipalHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<PrincipalMobileSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const summary = await fetchPrincipalMobileSummary();
      setData(summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const overview = data?.overview;
  const displayName = data?.greeting.userName || 'Principal';
  const photoUrl = data?.greeting.photoUrl ?? null;
  const notifCount = overview?.notificationCount ?? overview?.unreadEmails ?? 0;

  const kpis = useMemo(() => {
    const o = overview;
    if (!o) return [];
    return [
      {
        id: 'students',
        label: 'Students',
        value: formatKpi(data?.institution.studentCount ?? 0),
        hint: `${formatKpi(o.studentsPresent)} present today`,
        icon: 'school' as const,
        tint: '#3B82F6',
        soft: '#EFF6FF',
      },
      {
        id: 'staff',
        label: 'Total Staff',
        value: formatKpi(data?.institution.staffCount ?? 0),
        hint: `${formatKpi(o.staffPresent)} on duty`,
        icon: 'people' as const,
        tint: '#10B981',
        soft: '#ECFDF5',
      },
      {
        id: 'departments',
        label: 'Departments',
        value: formatKpi(o.departmentCount ?? 0),
        hint: o.shiftCount ? `Across ${o.shiftCount} shifts` : 'Active departments',
        icon: 'business' as const,
        tint: '#8B5CF6',
        soft: '#F5F3FF',
      },
      {
        id: 'classes',
        label: 'Classes Today',
        value: formatKpi(o.classesToday ?? 0),
        hint: 'Across all shifts',
        icon: 'book' as const,
        tint: '#F97316',
        soft: '#FFF7ED',
      },
      {
        id: 'fees',
        label: 'Fees Collection',
        value: formatKpi(o.feeCollectionMonth ?? o.feeCollectionToday ?? 0, true),
        hint: trendLabel(o.feeTrendPct, 'This month'),
        icon: 'cash' as const,
        tint: '#14B8A6',
        soft: '#F0FDFA',
      },
    ];
  }, [data?.institution.staffCount, data?.institution.studentCount, overview]);

  const actionColors = [
    principalTheme.purple,
    principalTheme.accent,
    principalTheme.info,
    principalTheme.orange,
    principalTheme.urgent,
    principalTheme.teal,
  ];

  const go = (href: string) => {
    const cleaned = href.replace(/#.*$/, '') as Href;
    router.push(cleaned);
  };

  if (loading && !data) {
    return (
      <View style={[styles.boot, { paddingTop: insets.top }]}>
        <ActivityIndicator color={principalTheme.primaryAccent} size="large" />
        <Text style={styles.bootText}>Loading Principal Dashboard…</Text>
      </View>
    );
  }

  const attendancePct = overview?.attendancePct ?? 0;
  const studentsAtt = overview?.studentsAttendancePct ?? null;
  const staffAtt = overview?.staffAttendancePct ?? null;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />
        }
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[principalTheme.hero, principalTheme.heroDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 10 }]}
        >
          <View style={styles.heroTop}>
            <Pressable
              hitSlop={10}
              onPress={() => router.push('/(principal)/(tabs)/profile' as Href)}
            >
              <Ionicons name="menu" size={24} color="#fff" />
            </Pressable>
            <View style={styles.heroTitles}>
              <Text style={styles.heroTitle}>Principal Dashboard</Text>
              <Text style={styles.heroSubtitle}>BCL OneCampus ERP</Text>
            </View>
            <View style={styles.heroIcons}>
              <Pressable
                style={styles.heroIconBtn}
                onPress={() => router.push('/(principal)/student-lookup' as Href)}
              >
                <Ionicons name="search-outline" size={22} color="#fff" />
              </Pressable>
              <Pressable
                style={styles.heroIconBtn}
                onPress={() => router.push('/(principal)/(tabs)/notifications' as Href)}
              >
                <Ionicons name="notifications-outline" size={22} color="#fff" />
                {notifCount > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{notifCount > 9 ? '9+' : notifCount}</Text>
                  </View>
                ) : null}
              </Pressable>
              <Pressable
                style={styles.heroIconBtn}
                onPress={() => go('/(principal)/(tabs)#schedule')}
              >
                <Ionicons name="calendar-outline" size={22} color="#fff" />
              </Pressable>
            </View>
          </View>

          <View style={styles.welcomeRow}>
            <StudentAvatar name={displayName} photoUrl={photoUrl} size={48} style={styles.avatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.welcome}>
                Welcome back, <Text style={styles.welcomeName}>{displayName}</Text>
              </Text>
              <Text style={styles.roleLine}>Principal</Text>
              <Text style={styles.collegeLine}>{COLLEGE_NAME}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.sheet}>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.kpiStrip}
          >
            {kpis.map((kpi) => (
              <View key={kpi.id} style={styles.kpiCard}>
                <View style={[styles.kpiIcon, { backgroundColor: kpi.soft }]}>
                  <Ionicons name={kpi.icon} size={18} color={kpi.tint} />
                </View>
                <Text style={styles.kpiLabel}>{kpi.label}</Text>
                <Text style={styles.kpiValue} numberOfLines={1}>
                  {kpi.value}
                </Text>
                <Text style={styles.kpiHint} numberOfLines={2}>
                  {kpi.hint}
                </Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.twoCol}>
            <View style={[styles.panel, styles.panelHalf]}>
              <Text style={styles.panelTitle}>Attendance Overview</Text>
              <AttendanceRing pct={attendancePct} />
              <View style={styles.attRows}>
                <View style={styles.attRow}>
                  <Text style={styles.attLabel}>Students</Text>
                  <Text style={styles.attValue}>
                    {studentsAtt != null ? `${studentsAtt}%` : '—'}
                  </Text>
                </View>
                <View style={styles.attRow}>
                  <Text style={styles.attLabel}>Staff</Text>
                  <Text style={styles.attValue}>{staffAtt != null ? `${staffAtt}%` : '—'}</Text>
                </View>
              </View>
              <Pressable onPress={() => go('/(principal)/(tabs)')}>
                <Text style={styles.link}>View Attendance Report →</Text>
              </Pressable>
            </View>

            <View style={[styles.panel, styles.panelHalf]}>
              <Text style={styles.panelTitle}>Academic Overview</Text>
              <View style={styles.academicGrid}>
                <View style={styles.academicCell}>
                  <Text style={styles.academicValue}>{formatKpi(overview?.programCount ?? 0)}</Text>
                  <Text style={styles.academicLabel}>Programs</Text>
                  <Text style={styles.academicHint}>Active</Text>
                </View>
                <View style={styles.academicCell}>
                  <Text style={styles.academicValue}>
                    {formatKpi(overview?.semestersRunning ?? 0)}
                  </Text>
                  <Text style={styles.academicLabel}>Semesters</Text>
                  <Text style={styles.academicHint}>Running</Text>
                </View>
                <View style={styles.academicCell}>
                  <Text style={styles.academicValue}>{formatKpi(overview?.subjectCount ?? 0)}</Text>
                  <Text style={styles.academicLabel}>Subjects</Text>
                  <Text style={styles.academicHint}>Offered</Text>
                </View>
                <View style={styles.academicCell}>
                  <Text style={styles.academicValue}>
                    {data?.campusHealth?.score != null ? `${data.campusHealth.score}` : '—'}
                  </Text>
                  <Text style={styles.academicLabel}>Campus</Text>
                  <Text style={styles.academicHint}>Health score</Text>
                </View>
              </View>
              <Pressable onPress={() => go('/(principal)/(tabs)')}>
                <Text style={styles.link}>View Academic Report →</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
          </View>
          <View style={styles.actionsGrid}>
            {(data?.quickActions ?? []).map((action, index) => (
              <Pressable key={action.id} style={styles.actionItem} onPress={() => go(action.href)}>
                <View
                  style={[
                    styles.actionCircle,
                    { backgroundColor: `${actionColors[index % actionColors.length]}22` },
                  ]}
                >
                  <ActionIcon
                    name={action.icon}
                    color={actionColors[index % actionColors.length]}
                  />
                </View>
                <Text style={styles.actionLabel} numberOfLines={2}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.twoCol}>
            <View style={[styles.panel, styles.panelHalf]}>
              <Text style={styles.panelTitle}>Important Alerts</Text>
              {(data?.alerts ?? []).length === 0 ? (
                <Text style={styles.muted}>No critical alerts right now.</Text>
              ) : (
                (data?.alerts ?? []).slice(0, 3).map((alert) => (
                  <Pressable key={alert.id} style={styles.alertRow} onPress={() => go(alert.href)}>
                    <View
                      style={[
                        styles.alertIcon,
                        {
                          backgroundColor: `${severityColor[alert.severity] ?? principalTheme.info}18`,
                        },
                      ]}
                    >
                      <Ionicons
                        name={
                          alert.severity === 'critical'
                            ? 'alert-circle'
                            : alert.severity === 'high'
                              ? 'time'
                              : 'information-circle'
                        }
                        size={16}
                        color={severityColor[alert.severity] ?? principalTheme.info}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.alertTitle}>{alert.title}</Text>
                      {alert.actionHint ? (
                        <Text
                          style={[
                            styles.alertHint,
                            {
                              color: severityColor[alert.severity] ?? principalTheme.primaryAccent,
                            },
                          ]}
                        >
                          {alert.actionHint}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                ))
              )}
            </View>

            <View style={[styles.panel, styles.panelHalf]}>
              <Text style={styles.panelTitle}>Recent Notices</Text>
              {(data?.notices ?? []).length === 0 ? (
                (data?.schedule ?? []).length === 0 ? (
                  <Text style={styles.muted}>No recent notices.</Text>
                ) : (
                  (data?.schedule ?? []).slice(0, 3).map((item, i) => (
                    <View key={`${item.label}-${i}`} style={styles.noticeRow}>
                      <Text style={styles.noticeTitle} numberOfLines={2}>
                        {item.label}
                      </Text>
                      <Text style={styles.noticeMeta}>
                        {item.dayGroup} · {item.time}
                      </Text>
                    </View>
                  ))
                )
              ) : (
                (data?.notices ?? []).slice(0, 3).map((notice) => (
                  <Pressable
                    key={notice.id}
                    style={styles.noticeRow}
                    onPress={() => (notice.href ? go(notice.href) : undefined)}
                  >
                    <View style={styles.noticeHead}>
                      <Text style={styles.noticeTitle} numberOfLines={2}>
                        {notice.title}
                      </Text>
                      {notice.tag ? (
                        <View style={styles.tag}>
                          <Text style={styles.tagText}>{notice.tag}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.noticeMeta}>{notice.dateLabel}</Text>
                  </Pressable>
                ))
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      <Pressable
        style={[styles.fab, { bottom: 24 + insets.bottom }]}
        onPress={() => router.push('/(principal)/compose' as Href)}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: principalTheme.background },
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: principalTheme.background,
  },
  bootText: { color: principalTheme.textMuted, fontWeight: '600' },
  hero: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  heroTitles: { flex: 1 },
  heroTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  heroSubtitle: { color: principalTheme.textOnHeroMuted, fontSize: 11, fontWeight: '600' },
  heroIcons: { flexDirection: 'row', gap: 8 },
  heroIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: principalTheme.urgent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  welcomeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  welcome: { color: principalTheme.textOnHeroMuted, fontSize: 13 },
  welcomeName: { color: '#fff', fontWeight: '800' },
  roleLine: { color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 2 },
  collegeLine: { color: principalTheme.textOnHeroMuted, fontSize: 11, marginTop: 1 },
  sheet: {
    marginTop: -14,
    paddingHorizontal: 14,
    gap: 12,
  },
  error: {
    color: principalTheme.urgent,
    backgroundColor: principalTheme.criticalBg,
    padding: 10,
    borderRadius: 10,
    fontSize: 12,
    fontWeight: '600',
  },
  kpiStrip: { gap: 10, paddingVertical: 4, paddingRight: 8 },
  kpiCard: {
    width: Math.min(148, SCREEN_W * 0.38),
    backgroundColor: principalTheme.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: principalTheme.border,
    gap: 4,
  },
  kpiIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  kpiLabel: { fontSize: 11, color: principalTheme.textMuted, fontWeight: '600' },
  kpiValue: { fontSize: 18, fontWeight: '800', color: principalTheme.text },
  kpiHint: { fontSize: 10, color: principalTheme.accent, fontWeight: '600' },
  twoCol: { gap: 10 },
  panel: {
    backgroundColor: principalTheme.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: principalTheme.border,
    gap: 10,
  },
  panelHalf: { width: '100%' },
  panelTitle: { fontSize: 14, fontWeight: '800', color: principalTheme.text },
  ringWrap: { alignItems: 'center', paddingVertical: 4 },
  ringOuter: {
    width: 118,
    height: 118,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringArc: {
    position: 'absolute',
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 10,
  },
  ringInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: principalTheme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  ringValue: { fontSize: 18, fontWeight: '800', color: principalTheme.text },
  ringCaption: {
    fontSize: 9,
    textAlign: 'center',
    color: principalTheme.textMuted,
    fontWeight: '600',
    lineHeight: 12,
  },
  attRows: { gap: 6 },
  attRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attLabel: { fontSize: 12, color: principalTheme.textMuted, fontWeight: '600' },
  attValue: { fontSize: 13, fontWeight: '800', color: principalTheme.accent },
  link: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
    color: principalTheme.primaryAccent,
  },
  academicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  academicCell: {
    width: '47%',
    backgroundColor: principalTheme.primarySoft,
    borderRadius: 12,
    padding: 10,
    gap: 2,
  },
  academicValue: { fontSize: 16, fontWeight: '800', color: principalTheme.text },
  academicLabel: { fontSize: 11, fontWeight: '700', color: principalTheme.text },
  academicHint: { fontSize: 10, color: principalTheme.textMuted },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: principalTheme.text },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: principalTheme.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: principalTheme.border,
    padding: 12,
  },
  actionItem: { width: '30%', alignItems: 'center', gap: 6, marginBottom: 4 },
  actionCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 10,
    textAlign: 'center',
    fontWeight: '700',
    color: principalTheme.text,
  },
  alertRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingVertical: 6 },
  alertIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitle: { fontSize: 12, fontWeight: '700', color: principalTheme.text, lineHeight: 16 },
  alertHint: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  noticeRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: principalTheme.border,
    gap: 4,
  },
  noticeHead: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  noticeTitle: { flex: 1, fontSize: 12, fontWeight: '700', color: principalTheme.text },
  noticeMeta: { fontSize: 10, color: principalTheme.textMuted, fontWeight: '600' },
  tag: {
    backgroundColor: principalTheme.primarySoft,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: { fontSize: 9, fontWeight: '800', color: principalTheme.primaryAccent },
  muted: { fontSize: 12, color: principalTheme.textMuted },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: principalTheme.purple,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
