import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useBootstrap } from '@/hooks/useBootstrap';
import { APP_VERSION } from '@/api/client';

export default function MaintenanceScreen() {
  const { config, retry } = useBootstrap();
  const isForceUpdate = config?.forceUpdate ?? false;
  const message =
    config?.forceUpdateMessage ??
    config?.maintenanceMessage ??
    'The app is temporarily unavailable. Please try again later.';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{config?.appName ?? 'BCL OneCampus ERP'}</Text>
      <Text style={styles.message}>{message}</Text>
      {isForceUpdate ? (
        <Text style={styles.version}>
          Your version: {APP_VERSION} · Required: {config?.minVersion ?? '—'}
        </Text>
      ) : null}
      <Pressable style={styles.btn} onPress={retry}>
        <Text style={styles.btnText}>Try again</Text>
      </Pressable>
      {isForceUpdate ? (
        <Pressable
          style={styles.linkBtn}
          onPress={() =>
            void Linking.openURL(
              'https://play.google.com/store/apps/details?id=com.basecodelabs.onecampus',
            )
          }
        >
          <Text style={styles.linkText}>Update on Google Play</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    gap: 14,
    backgroundColor: '#f8fafc',
  },
  title: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  message: { fontSize: 15, color: '#475569', lineHeight: 22 },
  version: { fontSize: 12, color: '#64748b' },
  btn: {
    marginTop: 8,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  linkBtn: { alignItems: 'center', paddingVertical: 8 },
  linkText: { color: '#2563eb', fontWeight: '700', fontSize: 14 },
});
