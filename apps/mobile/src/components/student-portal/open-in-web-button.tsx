import { Pressable, StyleSheet, Text, View } from 'react-native';
import { openWebPortal } from '@/utils/web-portal';
import { studentTheme } from '@/components/student-portal/theme';

/** Compact fallback link — not a full-page “web only” banner. */
export function OpenInWebButton({ path, label = 'Open in web' }: { path: string; label?: string }) {
  return (
    <View style={styles.wrap}>
      <Pressable style={styles.btn} onPress={() => void openWebPortal(path)}>
        <Text style={styles.text}>{label} →</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-start' },
  btn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: studentTheme.border,
    backgroundColor: '#fff',
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    color: studentTheme.primary,
  },
});
