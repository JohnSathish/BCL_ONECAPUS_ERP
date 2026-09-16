import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { schoolUi } from '@/theme/school-ui';
import { useSchoolSession } from '@/store/school-session';
import { t } from '@/i18n';

export function SchoolShell({
  title,
  children,
  onRefresh,
  loading,
}: {
  title: string;
  children: ReactNode;
  onRefresh?: () => void;
  loading?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const offline = useSchoolSession((s) => s.offline);
  const lastSyncedAt = useSchoolSession((s) => s.lastSyncedAt);
  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {offline ? (
          <Text style={styles.offline}>
            {t('offline')}
            {lastSyncedAt ? ` · ${new Date(lastSyncedAt).toLocaleTimeString()}` : ''}
          </Text>
        ) : null}
        {onRefresh ? (
          <Pressable onPress={onRefresh} accessibilityRole="button" accessibilityLabel="Refresh">
            <Text style={styles.refresh}>↻</Text>
          </Pressable>
        ) : null}
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={schoolUi.colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>{children}</ScrollView>
      )}
    </View>
  );
}

export function SchoolCard({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={styles.card} accessibilityRole="button">
        {children}
      </Pressable>
    );
  }
  return <View style={styles.card}>{children}</View>;
}

export function SchoolEmpty({ title, body }: { title: string; body?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
    </View>
  );
}

export function SchoolSkeleton() {
  return (
    <View>
      <View style={styles.skelWide} />
      <View style={styles.skel} />
      <View style={styles.skel} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: schoolUi.colors.background },
  header: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  title: { flex: 1, fontSize: 22, fontWeight: '800', color: schoolUi.colors.text },
  refresh: { fontSize: 22, color: schoolUi.colors.primary },
  offline: { color: schoolUi.colors.warning, fontWeight: '700', fontSize: 12 },
  body: { padding: 16, paddingBottom: 40, gap: 12 },
  card: {
    backgroundColor: schoolUi.colors.surface,
    borderRadius: schoolUi.radius.lg,
    padding: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  empty: { alignItems: 'center', padding: 28 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: schoolUi.colors.text },
  emptyBody: { marginTop: 6, color: schoolUi.colors.muted, textAlign: 'center' },
  skelWide: { height: 88, borderRadius: 18, backgroundColor: '#e8edf5', marginBottom: 12 },
  skel: { height: 56, borderRadius: 14, backgroundColor: '#e8edf5', marginBottom: 10 },
});
