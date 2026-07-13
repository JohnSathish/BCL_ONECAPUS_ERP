import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import { completeFeeCheckout } from '@/payments/checkout';
import {
  applyStcEnrollment,
  confirmStcPayment,
  fetchStcAttendanceSummary,
  fetchStcCertEligibility,
  fetchStcMyLearning,
  payStcEnrollment,
  type StcCourseCard,
  type StcEnrollment,
} from '@/services/short-term-courses';

type Tab = 'available' | 'mine' | 'attendance' | 'certificate';

export default function ShortTermCoursesScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const initial =
    params.tab === 'mine' || params.tab === 'attendance' || params.tab === 'certificate'
      ? params.tab
      : 'available';
  const [tab, setTab] = useState<Tab>(initial);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [catalogue, setCatalogue] = useState<StcCourseCard[]>([]);
  const [enrollments, setEnrollments] = useState<StcEnrollment[]>([]);
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchStcMyLearning();
      setCatalogue(data.catalogue ?? []);
      setEnrollments(data.enrollments ?? []);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to load short-term courses');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const apply = async (course: StcCourseCard) => {
    if (!course.openBatch?.id) return;
    setBusyId(course.id);
    try {
      let result = await applyStcEnrollment(course.openBatch.id);
      let checkoutBundle = result.checkout;
      if (!checkoutBundle?.checkout && result.enrollment?.status === 'PAYMENT_PENDING') {
        const paid = await payStcEnrollment(result.enrollment.id);
        checkoutBundle = paid.checkout;
        result = { ...result, enrollment: paid.enrollment };
      }
      const checkout = checkoutBundle?.checkout ?? checkoutBundle;
      if (checkout) {
        await completeFeeCheckout(checkout);
        await confirmStcPayment(
          result.enrollment.id,
          checkout.paymentId ?? checkoutBundle?.payment?.id,
        );
      }
      setMessage(
        result.waitlisted
          ? 'Added to waiting list.'
          : `Registration ${result.enrollment?.status ?? 'done'}.`,
      );
      await load();
    } catch (e) {
      Alert.alert('Registration', e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <StudentScreenShell title="Short-Term Courses">
      <View style={styles.tabs}>
        {(
          [
            ['available', 'Available'],
            ['mine', 'My Courses'],
            ['attendance', 'Attendance'],
            ['certificate', 'Certificate'],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            style={[styles.tab, tab === key && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
            />
          }
          contentContainerStyle={styles.content}
        >
          {message ? <Text style={styles.message}>{message}</Text> : null}

          {tab === 'available'
            ? catalogue.map((c) => (
                <View key={c.id} style={styles.card}>
                  <Text style={styles.code}>{c.code}</Text>
                  <Text style={styles.title}>{c.name}</Text>
                  <Text style={styles.meta}>
                    {c.durationDays} days · {c.mode} ·{' '}
                    {c.feeType === 'FREE' ? 'Free' : `₹${Number(c.fees?.courseFee ?? 0)}`}
                  </Text>
                  <Text style={styles.desc} numberOfLines={3}>
                    {c.description}
                  </Text>
                  <Pressable
                    style={[
                      styles.btn,
                      (!c.registrationOpen || busyId === c.id) && styles.btnDisabled,
                    ]}
                    disabled={!c.registrationOpen || busyId === c.id}
                    onPress={() => void apply(c)}
                  >
                    <Text style={styles.btnText}>
                      {busyId === c.id ? 'Applying…' : 'Apply Now'}
                    </Text>
                  </Pressable>
                </View>
              ))
            : null}

          {tab === 'mine'
            ? enrollments.map((e) => (
                <View key={e.id} style={styles.card}>
                  <Text style={styles.title}>{e.batch?.course?.name}</Text>
                  <Text style={styles.meta}>
                    {e.batch?.batchCode} · {e.status}
                  </Text>
                </View>
              ))
            : null}

          {tab === 'attendance'
            ? enrollments.map((e) => <AttendanceRow key={e.id} enrollment={e} />)
            : null}

          {tab === 'certificate'
            ? enrollments.map((e) => <CertRow key={e.id} enrollment={e} />)
            : null}

          {(tab === 'available' ? catalogue : enrollments).length === 0 ? (
            <Text style={styles.empty}>Nothing to show yet.</Text>
          ) : null}
        </ScrollView>
      )}
    </StudentScreenShell>
  );
}

function AttendanceRow({ enrollment }: { enrollment: StcEnrollment }) {
  const [summary, setSummary] = useState<{
    percent: number;
    present: number;
    sessions: number;
  } | null>(null);
  useEffect(() => {
    void fetchStcAttendanceSummary(enrollment.id)
      .then(setSummary)
      .catch(() => null);
  }, [enrollment.id]);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{enrollment.batch?.course?.name}</Text>
      <Text style={styles.meta}>
        Attendance {summary?.percent ?? '—'}% ({summary?.present ?? 0}/{summary?.sessions ?? 0})
      </Text>
    </View>
  );
}

function CertRow({ enrollment }: { enrollment: StcEnrollment }) {
  const [elig, setElig] = useState<{ eligible: boolean; reason?: string } | null>(null);
  useEffect(() => {
    void fetchStcCertEligibility(enrollment.id)
      .then(setElig)
      .catch(() => null);
  }, [enrollment.id]);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{enrollment.batch?.course?.name}</Text>
      <Text style={styles.meta}>
        {enrollment.certificate
          ? 'Certificate issued — open Certificates to download.'
          : elig?.eligible
            ? 'Eligible for certificate.'
            : (elig?.reason ?? 'Not eligible yet.')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingTop: 8 },
  tab: {
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tabActive: { backgroundColor: '#0f172a' },
  tabText: { fontSize: 12, fontWeight: '600', color: '#334155' },
  tabTextActive: { color: '#fff' },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    gap: 6,
  },
  code: { fontSize: 11, fontWeight: '700', color: '#047857', textTransform: 'uppercase' },
  title: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  meta: { fontSize: 12, color: '#64748b' },
  desc: { fontSize: 13, color: '#475569', marginTop: 4 },
  btn: {
    marginTop: 10,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  message: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    color: '#334155',
    fontSize: 13,
  },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 24 },
});
