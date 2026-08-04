import { ScrollView, StyleSheet, Text } from 'react-native';
import { PrincipalScreenShell } from '@/components/principal-portal/principal-screen-shell';
import { principalTheme } from '@/components/principal-portal/theme';

export default function PrincipalNotificationsScreen() {
  return (
    <PrincipalScreenShell title="Notifications" subtitle="Institution alerts">
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.muted}>
          Use the system notification center and Priority Alerts on Home. Dedicated notification
          list will expand in a later release.
        </Text>
      </ScrollView>
    </PrincipalScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  muted: { fontSize: 13, color: principalTheme.textMuted, lineHeight: 20 },
});
