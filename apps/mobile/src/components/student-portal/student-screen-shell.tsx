import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { StudentScreenHeader } from './student-screen-header';
import { studentTheme } from './theme';

type StudentScreenShellProps = {
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
  showMenu?: boolean;
  children: ReactNode;
};

export function StudentScreenShell({
  title,
  subtitle,
  rightSlot,
  showMenu = true,
  children,
}: StudentScreenShellProps) {
  return (
    <View style={styles.root}>
      <StudentScreenHeader
        title={title}
        subtitle={subtitle}
        rightSlot={rightSlot}
        showMenu={showMenu}
      />
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: studentTheme.background },
  body: { flex: 1 },
});
