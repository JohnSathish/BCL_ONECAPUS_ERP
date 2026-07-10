import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { logout } from '@/auth/logout';
import {
  fetchMobileDeviceSessions,
  revokeAllAuthSessions,
  revokeMobileDeviceSession,
  type MobileDeviceSession,
} from '@/services/auth-account';

type DeviceSessionsPanelProps = {
  title?: string;
  mutedColor?: string;
  textColor?: string;
  borderColor?: string;
  surfaceColor?: string;
};

export function DeviceSessionsPanel({
  title = 'Active Sessions',
  mutedColor = '#64748b',
  textColor = '#0f172a',
  borderColor = '#e2e8f0',
  surfaceColor = '#ffffff',
}: DeviceSessionsPanelProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<MobileDeviceSession[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await fetchMobileDeviceSessions();
      setSessions(data.sessions.slice(0, 8));
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRevoke(session: MobileDeviceSession) {
    Alert.alert(
      session.isCurrent ? 'Sign out this device?' : 'Sign out device?',
      session.isCurrent
        ? 'You will need to sign in again on this phone.'
        : `Sign out “${session.deviceLabel}”?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusyId(session.id);
              try {
                if (session.isCurrent) {
                  await logout();
                  router.replace('/(auth)/login');
                  return;
                }
                await revokeMobileDeviceSession(session.id);
                await load();
              } catch (e) {
                Alert.alert(
                  'Could not sign out',
                  e instanceof Error ? e.message : 'Try again later.',
                );
              } finally {
                setBusyId(null);
              }
            })();
          },
        },
      ],
    );
  }

  function onRevokeOthers() {
    Alert.alert(
      'Sign out other devices?',
      'All other sessions will be revoked. This device stays signed in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out others',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusyId('all');
              try {
                const others = sessions.filter((s) => !s.isCurrent);
                await Promise.all(others.map((s) => revokeMobileDeviceSession(s.id)));
                await load();
              } catch (e) {
                Alert.alert(
                  'Could not sign out',
                  e instanceof Error ? e.message : 'Try again later.',
                );
              } finally {
                setBusyId(null);
              }
            })();
          },
        },
      ],
    );
  }

  function onRevokeAll() {
    Alert.alert('Sign out all devices?', 'Every session including this phone will be signed out.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out all',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusyId('all');
            try {
              await revokeAllAuthSessions();
              await logout();
              router.replace('/(auth)/login');
            } catch (e) {
              Alert.alert(
                'Could not sign out',
                e instanceof Error ? e.message : 'Try again later.',
              );
              setBusyId(null);
            }
          })();
        },
      },
    ]);
  }

  if (loading) {
    return <ActivityIndicator style={{ marginVertical: 8 }} />;
  }

  if (sessions.length === 0) {
    return (
      <View style={[styles.card, { backgroundColor: surfaceColor, borderColor }]}>
        <Text style={[styles.title, { color: textColor }]}>{title}</Text>
        <Text style={[styles.meta, { color: mutedColor }]}>No session history available.</Text>
      </View>
    );
  }

  const hasOthers = sessions.some((s) => !s.isCurrent);

  return (
    <View style={[styles.card, { backgroundColor: surfaceColor, borderColor }]}>
      <Text style={[styles.title, { color: textColor }]}>{title}</Text>
      {sessions.map((session) => (
        <View key={session.id} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: textColor }]}>
              {session.deviceLabel}
              {session.isCurrent ? ' · Current' : ''}
            </Text>
            <Text style={[styles.meta, { color: mutedColor }]}>
              {session.clientType} · {session.appType ?? 'app'}
              {session.appVersion ? ` · v${session.appVersion}` : ''} ·{' '}
              {formatWhen(session.lastActiveAt)}
            </Text>
          </View>
          <Pressable
            onPress={() => onRevoke(session)}
            disabled={busyId != null}
            style={styles.actionBtn}
          >
            <Text style={styles.actionText}>
              {busyId === session.id ? '…' : session.isCurrent ? 'Sign out' : 'Revoke'}
            </Text>
          </Pressable>
        </View>
      ))}
      <View style={styles.footerActions}>
        {hasOthers ? (
          <Pressable onPress={onRevokeOthers} disabled={busyId != null}>
            <Text style={styles.link}>Sign out other devices</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onRevokeAll} disabled={busyId != null}>
          <Text style={[styles.link, styles.linkDanger]}>Sign out all devices</Text>
        </Pressable>
      </View>
    </View>
  );
}

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  title: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
  },
  label: { fontSize: 13, fontWeight: '600' },
  meta: { fontSize: 11, marginTop: 2 },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  actionText: { fontSize: 12, fontWeight: '600', color: '#1e40af' },
  footerActions: {
    marginTop: 10,
    gap: 8,
    alignItems: 'flex-start',
  },
  link: { fontSize: 12, fontWeight: '600', color: '#1d4ed8' },
  linkDanger: { color: '#b91c1c' },
});
