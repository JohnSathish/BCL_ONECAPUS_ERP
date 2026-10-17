import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { FacultyScreenHeader } from './faculty-screen-header';
import { facultyTheme } from './theme';

type FacultyScreenShellProps = {
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
  showMenu?: boolean;
  tone?: 'default' | 'brand';
  children: ReactNode;
};

export function FacultyScreenShell({
  title,
  subtitle,
  rightSlot,
  showMenu = true,
  tone = 'default',
  children,
}: FacultyScreenShellProps) {
  return (
    <View style={styles.root}>
      <FacultyScreenHeader
        title={title}
        subtitle={subtitle}
        rightSlot={rightSlot}
        showMenu={showMenu}
        tone={tone}
      />
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: facultyTheme.background },
  body: { flex: 1 },
});
