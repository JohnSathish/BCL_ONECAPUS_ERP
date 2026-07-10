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
import { useRouter } from 'expo-router';
import { FacultyScreenShell } from '@/components/faculty-portal/faculty-screen-shell';
import { facultyTheme } from '@/components/faculty-portal/theme';
import {
  fetchFacultyTodaySessions,
  type FacultyAttendanceSession,
} from '@/services/faculty-attendance';
import {
  attendanceActionLabel,
  attendanceMarkStateLabel,
  formatSessionTimeRange,
  getAttendanceMarkState,
  sessionCountsLine,
  sessionDisplaySubtitle,
  sessionDisplayTitle,
  type AttendanceMarkState,
} from '@/utils/attendance-session';

const MARK_STATE_STYLES: Record<
  AttendanceMarkState,
  { badgeBg: string; badgeText: string; badgeBorder: string; cardBorder: string }
> = {
  pending: {
    badgeBg: '#FEF3C7',
    badgeText: '#92400E',
    badgeBorder: '#FCD34D',
    cardBorder: facultyTheme.border,
  },
  marked: {
    badgeBg: '#D1FAE5',
    badgeText: '#065F46',
    badgeBorder: '#6EE7B7',
    cardBorder: '#A7F3D0',
  },
  locked: {
    badgeBg: '#FFEDD5',
    badgeText: '#9A3412',
    badgeBorder: '#FDBA74',
    cardBorder: '#FED7AA',
  },
};

export default function FacultyAttendanceScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessions, setSessions] = useState<FacultyAttendanceSession[]>([]);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const rows = await fetchFacultyTodaySessions();
      setSessions(rows);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = sessions.filter((s) => getAttendanceMarkState(s) === 'pending').length;
  const marked = sessions.filter((s) => getAttendanceMarkState(s) === 'marked').length;
  const locked = sessions.filter((s) => getAttendanceMarkState(s) === 'locked').length;

  return (
    <FacultyScreenShell title="Attendance" subtitle="Mark & review class attendance">
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, styles.summaryPending]}>
            <Text style={[styles.summaryValue, styles.summaryPendingValue]}>{pending}</Text>
            <Text style={styles.summaryLabel}>Pending</Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryMarked]}>
            <Text style={[styles.summaryValue, styles.summaryMarkedValue]}>{marked}</Text>
            <Text style={styles.summaryLabel}>Marked</Text>
          </View>
          {locked > 0 ? (
            <View style={[styles.summaryCard, styles.summaryLocked]}>
              <Text style={[styles.summaryValue, styles.summaryLockedValue]}>{locked}</Text>
              <Text style={styles.summaryLabel}>Locked</Text>
            </View>
          ) : null}
        </View>

        {loading ? (
          <ActivityIndicator color={facultyTheme.primaryLight} style={{ marginTop: 24 }} />
        ) : sessions.length === 0 ? (
          <Text style={styles.empty}>No attendance sessions for today.</Text>
        ) : (
          sessions.map((session) => {
            const markState = getAttendanceMarkState(session);
            const palette = MARK_STATE_STYLES[markState];
            const countsLine = sessionCountsLine(session);

            return (
              <Pressable
                key={session.id}
                style={[styles.card, { borderColor: palette.cardBorder }]}
                onPress={() => router.push(`/(staff)/mark-attendance/${session.id}` as never)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.time}>
                    {formatSessionTimeRange(session.startTime, session.endTime)}
                  </Text>
                  <View
                    style={[
                      styles.badge,
                      {
                        backgroundColor: palette.badgeBg,
                        borderColor: palette.badgeBorder,
                      },
                    ]}
                  >
                    <Text style={[styles.badgeText, { color: palette.badgeText }]}>
                      {attendanceMarkStateLabel(markState)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.title}>{sessionDisplayTitle(session)}</Text>
                <Text style={styles.meta}>{sessionDisplaySubtitle(session)}</Text>

                {countsLine ? <Text style={styles.counts}>{countsLine}</Text> : null}

                <Text
                  style={[
                    styles.action,
                    markState === 'marked' && styles.actionMarked,
                    markState === 'locked' && styles.actionLocked,
                  ]}
                >
                  {attendanceActionLabel(markState)}
                </Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </FacultyScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10, paddingBottom: 28 },
  summaryRow: { flexDirection: 'row', gap: 8 },
  summaryCard: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  summaryPending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  summaryMarked: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  summaryLocked: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  summaryValue: { fontSize: 24, fontWeight: '800' },
  summaryPendingValue: { color: '#B45309' },
  summaryMarkedValue: { color: '#047857' },
  summaryLockedValue: { color: '#C2410C' },
  summaryLabel: { fontSize: 11, color: facultyTheme.textMuted, marginTop: 2, fontWeight: '600' },
  empty: { fontSize: 13, color: facultyTheme.textMuted, marginTop: 12 },
  card: {
    backgroundColor: facultyTheme.surface,
    borderRadius: 14,
    padding: 14,
    gap: 4,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  time: { flex: 1, fontSize: 12, fontWeight: '700', color: facultyTheme.primaryLight },
  title: { fontSize: 15, fontWeight: '800', color: facultyTheme.text },
  meta: { fontSize: 12, color: facultyTheme.textMuted },
  counts: { fontSize: 11, color: facultyTheme.textMuted, marginTop: 2 },
  action: { fontSize: 12, fontWeight: '700', color: facultyTheme.primaryLight, marginTop: 6 },
  actionMarked: { color: '#047857' },
  actionLocked: { color: '#C2410C' },
});
