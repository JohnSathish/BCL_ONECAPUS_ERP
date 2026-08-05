import { StyleSheet, View } from 'react-native';
import { NotificationCenterPanel } from '@/components/notifications/notification-center-panel';
import { PrincipalScreenShell } from '@/components/principal-portal/principal-screen-shell';
import { principalTheme } from '@/components/principal-portal/theme';

export default function PrincipalNotificationsScreen() {
  return (
    <PrincipalScreenShell title="Notifications" subtitle="Mail · leave · campus alerts">
      <View style={styles.root}>
        <NotificationCenterPanel
          role="staff"
          theme={{
            primary: principalTheme.primaryAccent,
            surface: principalTheme.surface,
            border: principalTheme.border,
            text: principalTheme.text,
            textMuted: principalTheme.textMuted,
            textSubtle: principalTheme.textSubtle,
            urgent: principalTheme.urgent,
          }}
        />
      </View>
    </PrincipalScreenShell>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
