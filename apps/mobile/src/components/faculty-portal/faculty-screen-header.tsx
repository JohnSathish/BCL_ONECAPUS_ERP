import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFacultyPortal } from './faculty-portal-context';
import { facultyTheme } from './theme';

type FacultyScreenHeaderProps = {
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
  showMenu?: boolean;
};

export function FacultyScreenHeader({
  title,
  subtitle,
  rightSlot,
  showMenu = true,
}: FacultyScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const { openDrawer } = useFacultyPortal();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <View style={styles.row}>
        {showMenu ? (
          <Pressable style={styles.menuBtn} onPress={openDrawer} hitSlop={8}>
            <Text style={styles.menuIcon}>☰</Text>
          </Pressable>
        ) : (
          <View style={styles.menuSpacer} />
        )}
        <View style={styles.titles}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.right}>{rightSlot ?? <View style={styles.menuSpacer} />}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: facultyTheme.surface,
    borderBottomWidth: 1,
    borderBottomColor: facultyTheme.border,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: { fontSize: 18, color: facultyTheme.primaryLight, fontWeight: '700' },
  menuSpacer: { width: 36 },
  titles: { flex: 1, gap: 2 },
  title: { fontSize: 17, fontWeight: '800', color: facultyTheme.text },
  subtitle: { fontSize: 12, color: facultyTheme.textMuted, fontWeight: '500' },
  right: { minWidth: 36, alignItems: 'flex-end' },
});
