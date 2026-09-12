import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, space } from '@/theme/tokens';

export function Screen({
  children,
  title,
  action,
  onBack,
  light,
}: {
  children: ReactNode;
  title?: string;
  action?: ReactNode;
  onBack?: boolean;
  light?: boolean;
}) {
  const router = useRouter();
  return (
    <SafeAreaView style={[styles.safe, light && styles.safeLight]} edges={['top', 'left', 'right']}>
      {title ? (
        <View style={styles.bar}>
          {onBack ? (
            <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
              <Text style={styles.backText}>‹</Text>
            </Pressable>
          ) : (
            <View style={styles.back} />
          )}
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.right}>{action}</View>
        </View>
      ) : null}
      {children}
    </SafeAreaView>
  );
}

export function Card({
  children,
  onPress,
  padded = true,
}: {
  children: ReactNode;
  onPress?: () => void;
  padded?: boolean;
}) {
  const body = <View style={[styles.card, !padded && styles.cardFlush]}>{children}</View>;
  if (onPress) {
    return <Pressable onPress={onPress}>{body}</Pressable>;
  }
  return body;
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

export function Loader() {
  return (
    <View style={styles.empty}>
      <ActivityIndicator color={colors.navy} />
    </View>
  );
}

export function NavyButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.navyBtn, disabled && { opacity: 0.6 }]}
    >
      <Text style={styles.navyBtnText}>{label}</Text>
    </Pressable>
  );
}

export function GoldButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.goldBtn}>
      <Text style={styles.goldBtnText}>{label}</Text>
    </Pressable>
  );
}

export function Feed({ children }: { children: ReactNode }) {
  return (
    <ScrollView contentContainerStyle={styles.feed} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

export function Chips({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chips}
    >
      {options.map((option) => {
        const on = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={[styles.chip, on && styles.chipOn]}
          >
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{option}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Row({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: string;
  label: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={styles.rowIcon}>
        <Text style={{ fontSize: 16 }}>{icon}</Text>
      </View>
      <Text style={[styles.rowLabel, danger && { color: colors.danger }]}>{label}</Text>
      <Text style={styles.chev}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.page },
  safeLight: { backgroundColor: colors.paper },
  bar: {
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 28, color: colors.navy, marginTop: -4 },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: colors.navy },
  right: { minWidth: 32, alignItems: 'flex-end' },
  card: {
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    padding: space.md,
    shadowColor: '#1a237e',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    gap: 6,
  },
  cardFlush: { padding: 0, overflow: 'hidden' },
  empty: { padding: space.xl, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  emptyBody: { textAlign: 'center', color: colors.muted },
  navyBtn: {
    backgroundColor: colors.navy,
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  navyBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  goldBtn: {
    backgroundColor: colors.gold,
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  goldBtnText: { color: colors.navyDeep, fontWeight: '800' },
  feed: { padding: space.md, gap: space.md, paddingBottom: 48 },
  chips: { gap: 8, paddingHorizontal: space.md, paddingBottom: 8 },
  chip: {
    backgroundColor: '#eef1f8',
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipOn: { backgroundColor: colors.navy },
  chipText: { color: colors.navy, fontWeight: '700', fontSize: 13 },
  chipTextOn: { color: '#fff' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    gap: 12,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#eef1f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1, fontWeight: '700', color: colors.ink },
  chev: { color: colors.muted, fontSize: 20 },
});
