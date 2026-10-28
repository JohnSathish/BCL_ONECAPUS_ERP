import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { useStableTopInset } from '@/hooks/use-stable-top-inset';
import { useFacultyPortal } from './faculty-portal-context';
import { facultyTheme } from './theme';

type FacultyScreenHeaderProps = {
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
  showMenu?: boolean;
  tone?: 'default' | 'brand';
};

export function FacultyScreenHeader({
  title,
  subtitle,
  rightSlot,
  showMenu = true,
  tone = 'default',
}: FacultyScreenHeaderProps) {
  const topInset = useStableTopInset();
  const { openDrawer } = useFacultyPortal();

  const brand = tone === 'brand';

  return (
    <View style={[styles.wrap, brand && styles.wrapBrand, { paddingTop: topInset + 10 }]}>
      <SystemBars style={{ statusBar: brand ? 'light' : 'dark', navigationBar: 'dark' }} />
      <View style={styles.row}>
        {showMenu ? (
          <Pressable
            style={[styles.menuBtn, brand && styles.menuBtnBrand]}
            onPress={openDrawer}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Open menu"
          >
            <Text style={[styles.menuIcon, brand && styles.menuIconBrand]}>☰</Text>
          </Pressable>
        ) : (
          <View style={styles.menuSpacer} />
        )}
        <View style={styles.titles}>
          <Text style={[styles.title, brand && styles.titleBrand]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, brand && styles.subtitleBrand]} numberOfLines={1}>
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
  wrapBrand: {
    backgroundColor: '#0F3C89',
    borderBottomWidth: 0,
    paddingBottom: 18,
  },
  menuBtnBrand: { backgroundColor: '#FFFFFF' },
  menuIconBrand: { color: '#0F3C89' },
  titleBrand: { color: '#FFFFFF', fontSize: 18 },
  subtitleBrand: { color: 'rgba(255,255,255,0.82)' },
  right: { minWidth: 36, alignItems: 'flex-end' },
});
