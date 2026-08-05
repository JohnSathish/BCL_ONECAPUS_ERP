import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { principalTheme } from './theme';
import { usePrincipalDrawerOptional } from './principal-drawer-context';

type Props = {
  title: string;
  subtitle?: string;
  leftSlot?: ReactNode;
  rightSlot?: ReactNode;
  /** When true (default), show hamburger that opens the Principal drawer. */
  showMenu?: boolean;
  children: ReactNode;
};

export function PrincipalScreenShell({
  title,
  subtitle,
  leftSlot,
  rightSlot,
  showMenu = true,
  children,
}: Props) {
  const insets = useSafeAreaInsets();
  const drawer = usePrincipalDrawerOptional();

  const menu =
    leftSlot ??
    (showMenu && drawer ? (
      <Pressable
        hitSlop={10}
        onPress={() => drawer.openDrawer()}
        accessibilityLabel="Open menu"
        style={styles.menuBtn}
      >
        <Ionicons name="menu" size={22} color={principalTheme.primaryAccent} />
      </Pressable>
    ) : null);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        {menu ? <View style={styles.left}>{menu}</View> : null}
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
  left: { paddingBottom: 2 },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: principalTheme.primarySoft,
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
