import { StyleSheet, Text, View } from 'react-native';
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import { OpenInWebButton } from '@/components/student-portal/open-in-web-button';
import { studentTheme } from '@/components/student-portal/theme';

/** Registration stays on web for F1 — short open-in-web fallback. */
export default function RegistrationWebFallbackScreen() {
  return (
    <StudentScreenShell title="Course Registration" subtitle="Available on web">
      <View style={styles.box}>
        <Text style={styles.text}>
          Subject / course registration uses the full elective workflow on the web portal.
        </Text>
        <OpenInWebButton path="/student/registration" label="Open in web" />
      </View>
    </StudentScreenShell>
  );
}

const styles = StyleSheet.create({
  box: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: studentTheme.border,
    backgroundColor: '#fff',
    gap: 12,
  },
  text: { fontSize: 13, lineHeight: 19, color: studentTheme.textMuted },
});
