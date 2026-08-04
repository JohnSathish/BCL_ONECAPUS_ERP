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
import { useRouter, type Href } from 'expo-router';
import { PrincipalScreenShell } from '@/components/principal-portal/principal-screen-shell';
import { principalTheme } from '@/components/principal-portal/theme';
import {
  approvePrincipalStaffLeave,
  approvePrincipalStudentLeave,
  fetchPrincipalLeaveQueue,
} from '@/services/principal-desk';
import type { PrincipalLeaveQueue } from '@/types/principal-desk';

type Kind = 'staff' | 'student';

export default function PrincipalApprovalsScreen() {
  const router = useRouter();
  const [queue, setQueue] = useState<PrincipalLeaveQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      setQueue(await fetchPrincipalLeaveQueue('all'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load approvals');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function decide(kind: Kind, id: string, action: 'APPROVE' | 'REJECT') {
    const title = action === 'APPROVE' ? 'Approve leave?' : 'Reject leave?';
    Alert.alert(title, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: action === 'APPROVE' ? 'Approve' : 'Reject',
        style: action === 'REJECT' ? 'destructive' : 'default',
        onPress: () => {
          void runDecide(
            kind,
            id,
            action,
            action === 'REJECT' ? 'Rejected by Principal' : undefined,
          );
        },
      },
    ]);
  }

  async function runDecide(
    kind: Kind,
    id: string,
    action: 'APPROVE' | 'REJECT',
    rejectionReason?: string,
  ) {
    setBusyId(id);
    setError('');
    try {
      if (kind === 'staff') {
        await approvePrincipalStaffLeave(id, action, rejectionReason);
      } else {
        await approvePrincipalStudentLeave(id, action, rejectionReason);
      }
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <PrincipalScreenShell title="Approvals" subtitle={`${queue?.total ?? 0} pending`}>
      {loading && !queue ? (
        <View style={styles.center}>
          <ActivityIndicator color={principalTheme.primaryAccent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />
          }
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.section}>Staff leave</Text>
          {(queue?.staff ?? []).length === 0 ? (
            <Text style={styles.muted}>No pending staff leave.</Text>
          ) : (
            queue?.staff.map((item) => (
              <View key={item.id} style={styles.card}>
                <Pressable
                  onPress={() => router.push(`/(principal)/leave/${item.id}?kind=staff` as Href)}
                >
                  <Text style={styles.name}>
                    {item.staffProfile?.fullName ?? 'Staff'}{' '}
                    <Text style={styles.meta}>
                      {item.staffProfile?.employeeCode ? `(${item.staffProfile.employeeCode})` : ''}
                    </Text>
                  </Text>
                  <Text style={styles.meta}>
                    {item.leaveType?.name ?? 'Leave'} · {String(item.fromDate ?? '').slice(0, 10)} →{' '}
                    {String(item.toDate ?? '').slice(0, 10)}
                  </Text>
                  {item.reason ? <Text style={styles.reason}>{item.reason}</Text> : null}
                </Pressable>
                <View style={styles.row}>
                  <Pressable
                    style={[styles.btn, styles.approve]}
                    disabled={busyId === item.id}
                    onPress={() => decide('staff', item.id, 'APPROVE')}
                  >
                    <Text style={styles.btnText}>Approve</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.btn, styles.reject]}
                    disabled={busyId === item.id}
                    onPress={() => decide('staff', item.id, 'REJECT')}
                  >
                    <Text style={styles.btnText}>Reject</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}

          <Text style={styles.section}>Student leave</Text>
          {(queue?.student ?? []).length === 0 ? (
            <Text style={styles.muted}>No pending student leave.</Text>
          ) : (
            queue?.student.map((item) => (
              <View key={item.id} style={styles.card}>
                <Pressable
                  onPress={() => router.push(`/(principal)/leave/${item.id}?kind=student` as Href)}
                >
                  <Text style={styles.name}>
                    {item.student?.fullName ?? 'Student'}{' '}
                    <Text style={styles.meta}>
                      {item.student?.enrollmentNumber ? `(${item.student.enrollmentNumber})` : ''}
                    </Text>
                  </Text>
                  <Text style={styles.meta}>
                    {String(item.fromDate ?? '').slice(0, 10)} →{' '}
                    {String(item.toDate ?? '').slice(0, 10)}
                  </Text>
                  {item.reason ? <Text style={styles.reason}>{item.reason}</Text> : null}
                </Pressable>
                <View style={styles.row}>
                  <Pressable
                    style={[styles.btn, styles.approve]}
                    disabled={busyId === item.id}
                    onPress={() => decide('student', item.id, 'APPROVE')}
                  >
                    <Text style={styles.btnText}>Approve</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.btn, styles.reject]}
                    disabled={busyId === item.id}
                    onPress={() => decide('student', item.id, 'REJECT')}
                  >
                    <Text style={styles.btnText}>Reject</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </PrincipalScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40, gap: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  section: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: principalTheme.textMuted,
  },
  card: {
    backgroundColor: principalTheme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: principalTheme.border,
    padding: 12,
    gap: 10,
  },
  name: { fontSize: 15, fontWeight: '700', color: principalTheme.text },
  meta: { fontSize: 12, color: principalTheme.textMuted },
  reason: { fontSize: 13, color: principalTheme.text, marginTop: 4 },
  row: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  approve: { backgroundColor: principalTheme.accent },
  reject: { backgroundColor: principalTheme.urgent },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  muted: { fontSize: 13, color: principalTheme.textMuted },
  error: { color: principalTheme.urgent, fontSize: 13 },
});
