import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { FacultyScreenHeader } from './faculty-screen-header';
import { facultyTheme } from './theme';

type FacultyScreenShellProps = {
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
  showMenu?: boolean;
  children: ReactNode;
};

export function FacultyScreenShell({
  title,
  subtitle,
  rightSlot,
  showMenu = true,
  children,
}: FacultyScreenShellProps) {
  return (
    <View style={styles.root}>
      <FacultyScreenHeader
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
  root: { flex: 1, backgroundColor: facultyTheme.background },
  body: { flex: 1 },
});
