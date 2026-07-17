import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import {
  createAchievementShare,
  fetchMyActivityTranscript,
  fetchMyDepartmentActivityRegistrations,
  fetchOpenDepartmentActivities,
  registerForDepartmentActivity,
  withdrawDepartmentActivity,
  type ActivityTranscript,
  type DeptActivity,
  type DeptActivityRegistration,
} from '@/services/department-activities';

export default function DepartmentActivitiesScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState<DeptActivity[]>([]);
  const [mine, setMine] = useState<DeptActivityRegistration[]>([]);
  const [transcript, setTranscript] = useState<ActivityTranscript | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const [openList, myList, transcriptData] = await Promise.all([
        fetchOpenDepartmentActivities(),
        fetchMyDepartmentActivityRegistrations(),
        fetchMyActivityTranscript().catch(() => null),
      ]);
      setOpen(openList ?? []);
      setMine(myList ?? []);
      setTranscript(transcriptData);
      setMessage('');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to load activities');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const register = async (activity: DeptActivity) => {
    setBusyId(activity.id);
    try {
      await registerForDepartmentActivity(activity.id);
      setMessage('Registered successfully. Your QR pass is under My Registrations.');
      await load();
    } catch (e) {
      Alert.alert('Registration', e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  const withdraw = async (activityId: string) => {
    setBusyId(activityId);
    try {
      await withdrawDepartmentActivity(activityId);
      await load();
    } catch (e) {
      Alert.alert('Withdraw', e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  const shareAchievement = async (certificateLinkId: string, title: string) => {
    setBusyId(certificateLinkId);
    try {
      const result = await createAchievementShare(certificateLinkId);
      await Share.share({
        message: `${title}\n${result.shareUrl}`,
        url: result.shareUrl,
      });
    } catch (e) {
      Alert.alert('Share', e instanceof Error ? e.message : 'Unable to share');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <StudentScreenShell title="Department Activities">
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
            />
          }
        >
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <Text style={styles.heading}>Open for registration</Text>
          {open.length === 0 ? (
            <Text style={styles.empty}>No open activities right now.</Text>
          ) : (
            open.map((a) => (
              <View key={a.id} style={styles.card}>
                <Text style={styles.title}>{a.title}</Text>
                <Text style={styles.meta}>
                  {a.department?.name ?? 'Department'} · {a.activityType}
                </Text>
                <Text style={styles.meta}>
                  {new Date(a.eventDate).toLocaleDateString()} · {a.venue || 'Venue TBA'}
                </Text>
                <Pressable
                  style={styles.btn}
                  disabled={busyId === a.id}
                  onPress={() => void register(a)}
                >
                  <Text style={styles.btnText}>
                    {busyId === a.id ? 'Registering…' : 'Register'}
                  </Text>
                </Pressable>
              </View>
            ))
          )}

          <Text style={styles.heading}>My registrations</Text>
          {mine.length === 0 ? (
            <Text style={styles.empty}>You have not registered for any activity.</Text>
          ) : (
            mine.map((r) => (
              <View key={r.id} style={styles.card}>
                <Text style={styles.title}>{r.activity?.title ?? 'Activity'}</Text>
                <Text style={styles.meta}>Status: {r.status}</Text>
                <Text style={styles.passLabel}>QR Pass</Text>
                <Text selectable style={styles.pass}>
                  {r.qrPassToken}
                </Text>
                {r.status === 'REGISTERED' ? (
                  <Pressable
                    style={[styles.btn, styles.btnGhost]}
                    disabled={busyId === r.activity?.id}
                    onPress={() => r.activity?.id && void withdraw(r.activity.id)}
                  >
                    <Text style={styles.btnGhostText}>Withdraw</Text>
                  </Pressable>
                ) : null}
              </View>
            ))
          )}

          <Text style={styles.heading}>Activity transcript</Text>
          {transcript ? (
            <Text style={styles.meta}>
              {transcript.summary.total} activities · {transcript.summary.attended} attended ·{' '}
              {transcript.summary.withCertificates} certificates
            </Text>
          ) : null}
          {!transcript || transcript.entries.length === 0 ? (
            <Text style={styles.empty}>No transcript entries yet.</Text>
          ) : (
            transcript.entries.map((entry) => (
              <View key={entry.registrationId} style={styles.card}>
                <Text style={styles.title}>{entry.activity.title}</Text>
                <Text style={styles.meta}>
                  {entry.activity.activityTypeLabel}
                  {entry.activity.department?.name ? ` · ${entry.activity.department.name}` : ''}
                </Text>
                <Text style={styles.meta}>
                  {new Date(entry.activity.eventDate).toLocaleDateString()}
                  {entry.attended ? ' · Attended' : ''}
                  {entry.result ? ` · ${entry.result.positionLabel}` : ''}
                </Text>
                {entry.certificates.map((cert) => (
                  <Pressable
                    key={cert.certificateLinkId}
                    style={[styles.btn, styles.btnGhost]}
                    disabled={busyId === cert.certificateLinkId}
                    onPress={() =>
                      void shareAchievement(cert.certificateLinkId, entry.activity.title)
                    }
                  >
                    <Text style={styles.btnGhostText}>
                      {busyId === cert.certificateLinkId
                        ? 'Preparing…'
                        : `Share ${cert.certificateType === 'PARTICIPATION' ? 'participation' : 'award'}`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ))
          )}

          <Link href="/certificates" asChild>
            <Pressable style={[styles.btn, styles.btnLink]}>
              <Text style={styles.btnText}>My Certificates</Text>
            </Pressable>
          </Link>
        </ScrollView>
      )}
    </StudentScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40, gap: 10 },
  heading: { fontSize: 16, fontWeight: '700', marginTop: 12, marginBottom: 4 },
  empty: { color: '#64748b', marginBottom: 8 },
  message: {
    backgroundColor: '#ecfdf5',
    color: '#065f46',
    padding: 10,
    borderRadius: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  title: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  meta: { fontSize: 13, color: '#64748b' },
  passLabel: { fontSize: 12, fontWeight: '600', marginTop: 6, color: '#334155' },
  pass: {
    fontFamily: 'monospace',
    fontSize: 12,
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 6,
  },
  btn: {
    marginTop: 8,
    backgroundColor: '#0b1f3a',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '600' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#cbd5e1' },
  btnGhostText: { color: '#334155', fontWeight: '600' },
  btnLink: { marginTop: 16 },
});
