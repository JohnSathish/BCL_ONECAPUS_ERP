import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/tokens';
import { EmptyState, Loader } from '@/ui/kit';

export function OfficeShell({
  title,
  subtitle,
  children,
  action,
  loading,
  error,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  loading?: boolean;
  error?: string | null;
}) {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.bar}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.navigate('/home');
          }}
          hitSlop={10}
          style={styles.back}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.sub} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.action}>{action}</View>
      </View>
      {loading ? <Loader /> : null}
      {error ? <EmptyState title="Could not load this desk" body={error} /> : null}
      {!loading ? (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

export function Kpi({
  label,
  value,
  tint,
  hint,
}: {
  label: string;
  value: string;
  tint: string;
  hint?: string;
}) {
  return (
    <View style={[styles.kpi, { backgroundColor: tint }]}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      {hint ? <Text style={styles.kpiHint}>{hint}</Text> : null}
    </View>
  );
}

export function RowCard({
  title,
  meta,
  onPress,
  right,
}: {
  title: string;
  meta?: string;
  onPress?: () => void;
  right?: ReactNode;
}) {
  const inner = (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {meta ? <Text style={styles.rowMeta}>{meta}</Text> : null}
      </View>
      {right}
      {onPress ? <Text style={styles.chev}>›</Text> : null}
    </View>
  );
  if (onPress) return <Pressable onPress={onPress}>{inner}</Pressable>;
  return inner;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
    gap: 4,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#fff', fontSize: 32, marginTop: -4 },
  title: { color: '#fff', fontWeight: '800', fontSize: 18 },
  sub: { color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: '600', marginTop: 1 },
  action: { minWidth: 40, alignItems: 'flex-end' },
  body: {
    backgroundColor: '#eef2fb',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 14,
    gap: 10,
    paddingBottom: 40,
    minHeight: '100%',
  },
  kpi: { flexGrow: 1, minWidth: '47%', borderRadius: 16, padding: 12 },
  kpiLabel: { color: colors.muted, fontWeight: '700', fontSize: 11 },
  kpiValue: { color: colors.ink, fontWeight: '800', fontSize: 20, marginTop: 4 },
  kpiHint: { color: colors.muted, fontSize: 11, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
  },
  rowTitle: { fontWeight: '800', color: colors.ink, fontSize: 15 },
  rowMeta: { color: colors.muted, marginTop: 3, fontSize: 12 },
  chev: { color: '#c5cbe0', fontSize: 22 },
});
