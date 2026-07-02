import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { fetchMobileDeviceSessions, type MobileDeviceSession } from '@/services/auth-account';

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
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<MobileDeviceSession[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const data = await fetchMobileDeviceSessions();
        setSessions(data.sessions.slice(0, 5));
      } catch {
        setSessions([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
              {session.clientType} · {session.appType ?? 'app'} · {formatWhen(session.lastActiveAt)}
            </Text>
          </View>
        </View>
      ))}
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
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
  },
  title: { fontSize: 14, fontWeight: '800' },
  row: { gap: 2 },
  label: { fontSize: 13, fontWeight: '600' },
  meta: { fontSize: 11 },
});
