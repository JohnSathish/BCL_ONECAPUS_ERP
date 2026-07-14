import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useBootstrap } from '@/hooks/useBootstrap';
import { getInstalledAppVersion, isVersionBelow } from '@/utils/app-version';

export default function MaintenanceScreen() {
  const { config, retry } = useBootstrap();
  const appVersion = getInstalledAppVersion();
  const belowMin = isVersionBelow(appVersion, config?.minVersion ?? '0.0.0');
  const isForceUpdate = Boolean(config?.forceUpdate) || belowMin;
  const message =
    (isForceUpdate ? config?.forceUpdateMessage : config?.maintenanceMessage) ??
    config?.maintenanceMessage ??
    'The system is currently undergoing scheduled maintenance. Please try again later.';

  const updateUrl =
    config?.playStoreUrl?.trim() ||
    config?.apkDownloadUrl?.trim() ||
    'https://play.google.com/store/apps/details?id=com.basecodelabs.onecampus';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{config?.appName ?? 'Campus Portal'}</Text>
      <Text style={styles.message}>{message}</Text>
      {isForceUpdate ? (
        <Text style={styles.version}>
          Your version: {appVersion} · Required: {config?.minVersion ?? '—'}
        </Text>
      ) : null}
      {!isForceUpdate ? (
        <Pressable style={styles.btn} onPress={retry}>
          <Text style={styles.btnText}>Try again</Text>
        </Pressable>
      ) : null}
      {isForceUpdate ? (
        <Pressable style={styles.btn} onPress={() => void Linking.openURL(updateUrl)}>
          <Text style={styles.btnText}>Update Now</Text>
        </Pressable>
      ) : null}
      {isForceUpdate && config?.apkDownloadUrl ? (
        <Pressable
          style={styles.linkBtn}
          onPress={() => void Linking.openURL(config.apkDownloadUrl!)}
        >
          <Text style={styles.linkText}>Download latest APK</Text>
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
