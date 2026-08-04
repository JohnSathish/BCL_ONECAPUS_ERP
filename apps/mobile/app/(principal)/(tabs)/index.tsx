import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { PrincipalScreenShell } from '@/components/principal-portal/principal-screen-shell';
import { principalTheme, severityColor, severityDot } from '@/components/principal-portal/theme';
import { COLLEGE_NAME } from '@/constants/release';
import { fetchPrincipalMobileSummary } from '@/services/principal-desk';
import type { PrincipalMobileSummary } from '@/types/principal-desk';
import { formatInr } from '@/utils/currency';

function formatKpi(value: number, money = false) {
  if (money) return formatInr(value);
  return value.toLocaleString('en-IN');
}

export default function PrincipalHomeScreen() {
  const router = useRouter();
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
  const kpis = [
    { label: 'Students Present', value: overview?.studentsPresent ?? 0 },
    { label: 'Staff Present', value: overview?.staffPresent ?? 0 },
    { label: 'Admissions Today', value: overview?.admissionsToday ?? 0 },
    {
      label: 'Fee Collection',
      value: overview?.feeCollectionToday ?? 0,
      money: true,
    },
    { label: 'Pending Approvals', value: overview?.pendingApprovals ?? 0 },
    { label: 'Unread Emails', value: overview?.unreadEmails ?? 0 },
  ];

  return (
    <PrincipalScreenShell title="Principal" subtitle={COLLEGE_NAME}>
      {loading && !data ? (
        <View style={styles.center}>
          <ActivityIndicator color={principalTheme.primaryAccent} />
          <Text style={styles.muted}>Loading command center…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />
          }
        >
          <View style={styles.hero}>
            <Text style={styles.salutation}>
              {data?.greeting.salutation || 'Good day'}, Principal
            </Text>
            <Text style={styles.college}>{COLLEGE_NAME}</Text>
            <Text style={styles.date}>{data?.greeting.dateLabel || ''}</Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.section}>Today&apos;s Overview</Text>
          <View style={styles.kpiGrid}>
            {kpis.map((kpi) => (
              <View key={kpi.label} style={styles.kpiCard}>
                <Text style={styles.kpiValue}>{formatKpi(kpi.value, Boolean(kpi.money))}</Text>
                <Text style={styles.kpiLabel}>{kpi.label}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.section}>Quick Actions</Text>
          <View style={styles.actionsRow}>
            {(data?.quickActions ?? []).map((action) => (
              <Pressable
                key={action.id}
                style={styles.actionChip}
                onPress={() => {
                  const href = action.href.replace(/#.*$/, '') as Href;
                  router.push(href);
                }}
              >
                <Text style={styles.actionText}>{action.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.section}>Priority Alerts</Text>
          <View style={styles.card}>
            {(data?.alerts ?? []).length === 0 ? (
              <Text style={styles.muted}>No critical alerts right now.</Text>
            ) : (
              data?.alerts.map((alert) => (
                <Pressable
                  key={alert.id}
                  style={styles.alertRow}
                  onPress={() => {
                    const href = alert.href.replace(/#.*$/, '') as Href;
                    router.push(href);
                  }}
                >
                  <Text style={styles.alertDot}>{severityDot[alert.severity] ?? '🔵'}</Text>
                  <View style={styles.alertBody}>
                    <Text
                      style={[
                        styles.alertTitle,
                        { color: severityColor[alert.severity] ?? principalTheme.text },
                      ]}
                    >
                      {alert.title}
                    </Text>
                    {alert.count != null ? (
                      <Text style={styles.muted}>Count: {alert.count}</Text>
                    ) : null}
                  </View>
                </Pressable>
              ))
            )}
          </View>

          <Text style={styles.section} nativeID="schedule">
            Today&apos;s Schedule
          </Text>
          <View style={styles.card}>
            {(data?.schedule ?? []).length === 0 ? (
              <Text style={styles.muted}>No meetings or events scheduled nearby.</Text>
            ) : (
              data?.schedule.map((item, i) => (
                <View key={`${item.dayGroup}-${i}`} style={styles.scheduleRow}>
                  <View style={styles.scheduleMeta}>
                    <Text style={styles.scheduleDay}>{item.dayGroup}</Text>
                    <Text style={styles.scheduleTime}>{item.time}</Text>
                  </View>
                  <Text style={styles.scheduleLabel}>{item.label}</Text>
                </View>
              ))
            )}
          </View>

          {(data?.intelligence.bullets?.length ?? 0) > 0 ? (
            <>
              <Text style={styles.section}>Executive Briefing</Text>
              <View style={styles.card}>
                {data?.intelligence.bullets.map((b, i) => (
                  <Text key={`${i}-${b.slice(0, 12)}`} style={styles.bullet}>
                    • {b}
                  </Text>
                ))}
              </View>
            </>
          ) : null}
        </ScrollView>
      )}
    </PrincipalScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  hero: {
    backgroundColor: principalTheme.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: principalTheme.border,
    gap: 4,
  },
  salutation: { fontSize: 20, fontWeight: '800', color: principalTheme.text },
  college: { fontSize: 14, fontWeight: '600', color: principalTheme.primaryAccent },
  date: { fontSize: 12, color: principalTheme.textMuted },
  section: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: principalTheme.textMuted,
  },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpiCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: principalTheme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: principalTheme.border,
    padding: 12,
    gap: 4,
  },
  kpiValue: { fontSize: 18, fontWeight: '800', color: principalTheme.text },
  kpiLabel: { fontSize: 11, color: principalTheme.textMuted, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionChip: {
    backgroundColor: principalTheme.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionText: { fontSize: 12, fontWeight: '700', color: principalTheme.primaryAccent },
  card: {
    backgroundColor: principalTheme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: principalTheme.border,
    padding: 12,
    gap: 10,
  },
  alertRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  alertDot: { fontSize: 14, marginTop: 2 },
  alertBody: { flex: 1, gap: 2 },
  alertTitle: { fontSize: 13, fontWeight: '700' },
  scheduleRow: {
    borderBottomWidth: 1,
    borderBottomColor: principalTheme.border,
    paddingBottom: 8,
    gap: 4,
  },
  scheduleMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  scheduleDay: { fontSize: 11, fontWeight: '700', color: principalTheme.primaryAccent },
  scheduleTime: { fontSize: 11, color: principalTheme.textSubtle, fontFamily: 'monospace' },
  scheduleLabel: { fontSize: 13, fontWeight: '600', color: principalTheme.text },
  bullet: { fontSize: 13, color: principalTheme.text, lineHeight: 20 },
  muted: { fontSize: 13, color: principalTheme.textMuted },
  error: { color: principalTheme.urgent, fontSize: 13 },
});
