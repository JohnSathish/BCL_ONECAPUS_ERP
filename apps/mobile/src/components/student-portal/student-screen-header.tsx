import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { useStableTopInset } from '@/hooks/use-stable-top-inset';
import { useStudentPortal } from './student-portal-context';
import { studentTheme } from './theme';

type StudentScreenHeaderProps = {
  title: string;
  subtitle?: string;
  motto?: string;
  rightSlot?: ReactNode;
  showMenu?: boolean;
};

export function StudentScreenHeader({
  title,
  subtitle,
  motto,
  rightSlot,
  showMenu = true,
}: StudentScreenHeaderProps) {
  const topInset = useStableTopInset();
  const { openDrawer } = useStudentPortal();

  return (
    <View style={[styles.header, { paddingTop: topInset + 10 }]}>
      <SystemBars style={{ statusBar: 'light', navigationBar: 'dark' }} />
      <View style={styles.row}>
        {showMenu ? (
          <Pressable
            style={styles.menuButton}
            onPress={openDrawer}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Open menu"
          >
            <Text style={styles.menuIcon}>☰</Text>
          </Pressable>
        ) : (
          <View style={styles.menuSpacer} />
        )}
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {motto ? <Text style={styles.motto}>“{motto}”</Text> : null}
        </View>
        <View style={styles.rightSlot}>{rightSlot}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: studentTheme.primary,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: studentTheme.primary,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuSpacer: { width: 40 },
  menuIcon: { color: '#fff', fontSize: 20, fontWeight: '700' },
  titleBlock: { flex: 1 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  subtitle: { color: '#dbeafe', fontSize: 12, marginTop: 2 },
  motto: { color: 'rgba(255,255,255,0.86)', fontSize: 12, marginTop: 6, fontStyle: 'italic' },
  rightSlot: { minWidth: 40, alignItems: 'flex-end' },
});
