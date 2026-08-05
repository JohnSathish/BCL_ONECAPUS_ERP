import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { logout } from '@/auth/logout';
import { getUserSnapshot } from '@/auth/session';
import { PrincipalScreenShell } from '@/components/principal-portal/principal-screen-shell';
import { usePrincipalDrawerOptional } from '@/components/principal-portal/principal-drawer-context';
import { principalTheme } from '@/components/principal-portal/theme';
import { COLLEGE_NAME, PRIVACY_POLICY_URL, TERMS_URL } from '@/constants/release';

export default function PrincipalProfileScreen() {
  const router = useRouter();
  const drawer = usePrincipalDrawerOptional();
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    void getUserSnapshot().then((s) => {
      setRoles(s?.roles ?? []);
    });
  }, []);

  return (
    <PrincipalScreenShell title="Settings" subtitle="Principal account">
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.name}>Principal</Text>
          <Text style={styles.meta}>{COLLEGE_NAME}</Text>
          <Text style={styles.meta}>Roles: {roles.join(', ') || 'principal'}</Text>
        </View>

        <Text style={styles.section}>Command menu</Text>
        <Pressable style={styles.linkRow} onPress={() => drawer?.openDrawer()}>
          <Text style={styles.link}>Open sidebar navigation</Text>
        </Pressable>

        <Text style={styles.section}>Mail & settings</Text>
        <Pressable
          style={styles.linkRow}
          onPress={() => router.push('/(principal)/(tabs)/inbox' as Href)}
        >
          <Text style={styles.link}>Open Inbox</Text>
        </Pressable>
        <Text style={styles.hint}>
          Gmail OAuth connect can also be completed in Principal Desk → Communication Hub Settings
          on web if the in-app browser flow is interrupted.
        </Text>

        <Text style={styles.section}>Legal</Text>
        <Pressable style={styles.linkRow} onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}>
          <Text style={styles.link}>Privacy Policy</Text>
        </Pressable>
        <Pressable style={styles.linkRow} onPress={() => void Linking.openURL(TERMS_URL)}>
          <Text style={styles.link}>Terms of Use</Text>
        </Pressable>

        <Pressable
          style={styles.logout}
          onPress={() => {
            void logout().finally(() => router.replace('/(auth)/login'));
          }}
        >
          <Text style={styles.logoutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </PrincipalScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10, paddingBottom: 40 },
  card: {
    backgroundColor: principalTheme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: principalTheme.border,
    padding: 16,
    gap: 4,
  },
  name: { fontSize: 18, fontWeight: '800', color: principalTheme.text },
  meta: { fontSize: 13, color: principalTheme.textMuted },
  section: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: principalTheme.textMuted,
  },
  linkRow: {
    backgroundColor: principalTheme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: principalTheme.border,
    padding: 14,
  },
  link: { fontSize: 14, fontWeight: '600', color: principalTheme.primaryAccent },
  hint: { fontSize: 12, color: principalTheme.textMuted, lineHeight: 18 },
  logout: {
    marginTop: 16,
    backgroundColor: principalTheme.urgent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: { color: '#fff', fontWeight: '800' },
});
