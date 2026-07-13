import { useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { logout } from '@/auth/logout';
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import { studentTheme } from '@/components/student-portal/theme';
import {
  ACCOUNT_DELETION_URL,
  APP_DISPLAY_NAME,
  COLLEGE_NAME,
  SUPPORT_EMAIL,
} from '@/constants/release';
import { requestAccountDeletion } from '@/services/auth-account';

/**
 * Google Play requires a clear account-deletion path for apps with accounts.
 * Campus accounts are institution-managed — this screen starts a formal request.
 */
export default function AccountDeletionScreen() {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function openPolicy() {
    await Linking.openURL(ACCOUNT_DELETION_URL);
  }

  async function emailRequest() {
    const subject = encodeURIComponent(`${APP_DISPLAY_NAME} — Account deletion request`);
    const body = encodeURIComponent(
      [
        `Institution: ${COLLEGE_NAME}`,
        `App: ${APP_DISPLAY_NAME} (edu.onecampus.mobile)`,
        '',
        'I request deletion / deactivation of my campus portal account.',
        reason.trim() ? `Reason: ${reason.trim()}` : '',
        '',
        'Please process this under institutional and applicable data-protection policies.',
      ]
        .filter(Boolean)
        .join('\n'),
    );
    await Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
  }

  async function submitRequest() {
    setSubmitting(true);
    try {
      await requestAccountDeletion(reason.trim() || undefined);
      Alert.alert(
        'Request recorded',
        'Your deletion request was submitted. The institution / support team will process it. Academic and legal retention rules may apply.',
        [
          {
            text: 'Sign out',
            onPress: () => {
              void (async () => {
                await logout();
                router.replace('/(auth)/login');
              })();
            },
          },
          { text: 'Stay signed in', style: 'cancel' },
        ],
      );
    } catch {
      Alert.alert(
        'Could not reach server',
        `You can still email ${SUPPORT_EMAIL} or open the account deletion page.`,
        [
          { text: 'Email support', onPress: () => void emailRequest() },
          { text: 'Open web page', onPress: () => void openPolicy() },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <StudentScreenShell title="Delete account" subtitle="Google Play account deletion">
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.lead}>
          Campus accounts are issued and owned by your institution ({COLLEGE_NAME}). Deleting an
          account is not instantaneous self-serve wipe — it must be approved so academic, fee, and
          legal records can be retained where required by law.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>How deletion works</Text>
          <Text style={styles.bullet}>
            1. Submit a request from this screen (or email support).
          </Text>
          <Text style={styles.bullet}>2. Your institution admin reviews the request.</Text>
          <Text style={styles.bullet}>
            3. Login access is deactivated; personal profile data is deleted or anonymised where
            allowed.
          </Text>
          <Text style={styles.bullet}>
            4. Academic / financial records may be retained under institutional retention policy.
          </Text>
        </View>

        <Text style={styles.label}>Optional reason</Text>
        <TextInput
          style={styles.input}
          placeholder="Why are you requesting deletion?"
          placeholderTextColor={studentTheme.textMuted}
          value={reason}
          onChangeText={setReason}
          multiline
        />

        <Pressable
          style={[styles.primary, submitting && styles.disabled]}
          disabled={submitting}
          onPress={() => void submitRequest()}
        >
          <Text style={styles.primaryText}>
            {submitting ? 'Submitting…' : 'Request account deletion'}
          </Text>
        </Pressable>

        <Pressable style={styles.secondary} onPress={() => void emailRequest()}>
          <Text style={styles.secondaryText}>Email {SUPPORT_EMAIL}</Text>
        </Pressable>

        <Pressable style={styles.link} onPress={() => void openPolicy()}>
          <Text style={styles.linkText}>Open account deletion policy (web)</Text>
        </Pressable>

        <Pressable style={styles.cancel} onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </StudentScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 40 },
  lead: { fontSize: 14, lineHeight: 20, color: studentTheme.text, fontWeight: '500' },
  card: {
    backgroundColor: studentTheme.surface,
    borderColor: studentTheme.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  cardTitle: { fontWeight: '800', color: studentTheme.text, marginBottom: 4 },
  bullet: { fontSize: 13, color: studentTheme.textMuted, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '700', color: studentTheme.text },
  input: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: studentTheme.border,
    borderRadius: 12,
    padding: 12,
    textAlignVertical: 'top',
    color: studentTheme.text,
    backgroundColor: studentTheme.surface,
  },
  primary: {
    backgroundColor: '#b91c1c',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '800' },
  disabled: { opacity: 0.6 },
  secondary: {
    borderWidth: 1,
    borderColor: studentTheme.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: studentTheme.surface,
  },
  secondaryText: { fontWeight: '700', color: studentTheme.text },
  link: { paddingVertical: 8, alignItems: 'center' },
  linkText: { color: '#1d4ed8', fontWeight: '700', textDecorationLine: 'underline' },
  cancel: { paddingVertical: 10, alignItems: 'center' },
  cancelText: { color: studentTheme.textMuted, fontWeight: '600' },
});
