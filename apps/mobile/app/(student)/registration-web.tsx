import { StyleSheet, Text, View } from 'react-native';
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import { OpenInWebButton } from '@/components/student-portal/open-in-web-button';
import { studentTheme } from '@/components/student-portal/theme';

/** Subject renewal stays on web for v1 — opens a private browser session with login required. */
export default function RegistrationWebFallbackScreen() {
  return (
    <StudentScreenShell title="Subject renewal" subtitle="Secure web sign-in required">
      <View style={styles.box}>
        <Text style={styles.text}>
          Semester subject renewal (locked Major/Minor plus AEC, MDC, SEC, VTC/VAC electives) uses
          the college web portal. For security, the campus portal opens a private browser session
          and asks you to sign in again — it will not reuse an existing browser login.
        </Text>
        <OpenInWebButton
          path="/student/registration?renewal=1"
          label="Sign in on web for subject renewal"
        />
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
