import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStudentPortal } from './student-portal-context';
import { studentTheme } from './theme';

type StudentScreenHeaderProps = {
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
  showMenu?: boolean;
};

export function StudentScreenHeader({
  title,
  subtitle,
  rightSlot,
  showMenu = true,
}: StudentScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const { openDrawer } = useStudentPortal();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <View style={styles.row}>
        {showMenu ? (
          <Pressable style={styles.menuButton} onPress={openDrawer} hitSlop={8}>
            <Text style={styles.menuIcon}>☰</Text>
          </Pressable>
        ) : (
          <View style={styles.menuSpacer} />
        )}
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
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
  rightSlot: { minWidth: 40, alignItems: 'flex-end' },
});
