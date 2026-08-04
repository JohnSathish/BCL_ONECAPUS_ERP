import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { principalTheme } from './theme';

type Props = {
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
  children: ReactNode;
};

export function PrincipalScreenShell({ title, subtitle, rightSlot, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.titles}>
          <Text style={styles.eyebrow}>Executive Command Center</Text>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {rightSlot ? <View style={styles.right}>{rightSlot}</View> : null}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: principalTheme.background },
  header: {
    backgroundColor: principalTheme.surface,
    borderBottomWidth: 1,
    borderBottomColor: principalTheme.border,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  titles: { flex: 1, gap: 2 },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: principalTheme.primaryAccent,
  },
  title: { fontSize: 18, fontWeight: '800', color: principalTheme.text },
  subtitle: { fontSize: 12, color: principalTheme.textMuted, fontWeight: '500' },
  right: { minWidth: 36, alignItems: 'flex-end', paddingBottom: 2 },
  body: { flex: 1 },
});
