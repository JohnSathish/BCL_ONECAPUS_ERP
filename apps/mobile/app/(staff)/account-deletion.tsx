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
import { FacultyScreenShell } from '@/components/faculty-portal/faculty-screen-shell';
import { facultyTheme } from '@/components/faculty-portal/theme';
import {
  ACCOUNT_DELETION_URL,
  APP_DISPLAY_NAME,
  COLLEGE_NAME,
  SUPPORT_EMAIL,
} from '@/constants/release';
import { requestAccountDeletion } from '@/services/auth-account';

export default function StaffAccountDeletionScreen() {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function emailRequest() {
    const subject = encodeURIComponent(`${APP_DISPLAY_NAME} — Staff account deletion request`);
    const body = encodeURIComponent(
      [
        `Institution: ${COLLEGE_NAME}`,
        'I request deletion / deactivation of my staff portal account.',
        reason.trim() ? `Reason: ${reason.trim()}` : '',
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
        'HR / administration will process your account deletion request per institutional policy.',
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
      Alert.alert('Could not reach server', `Email ${SUPPORT_EMAIL} to continue.`, [
        { text: 'Email support', onPress: () => void emailRequest() },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FacultyScreenShell title="Delete account" subtitle="Account deletion request" showMenu={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.lead}>
          Staff accounts are managed by {COLLEGE_NAME}. Use this form to request deactivation and
          deletion of personal account data where legally permitted.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Optional reason"
          placeholderTextColor={facultyTheme.textMuted}
          value={reason}
          onChangeText={setReason}
          multiline
        />
        <Pressable
          style={[styles.primary, submitting && { opacity: 0.6 }]}
          disabled={submitting}
          onPress={() => void submitRequest()}
        >
          <Text style={styles.primaryText}>Request account deletion</Text>
        </Pressable>
        <Pressable style={styles.link} onPress={() => void Linking.openURL(ACCOUNT_DELETION_URL)}>
          <Text style={styles.linkText}>Open deletion policy</Text>
        </Pressable>
        <Pressable style={styles.cancel} onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </FacultyScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 40 },
  lead: { fontSize: 14, lineHeight: 20, color: facultyTheme.text, fontWeight: '500' },
  input: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: facultyTheme.border,
    borderRadius: 12,
    padding: 12,
    textAlignVertical: 'top',
    color: facultyTheme.text,
    backgroundColor: facultyTheme.surface,
  },
  primary: {
    backgroundColor: '#b91c1c',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '800' },
  link: { paddingVertical: 8, alignItems: 'center' },
  linkText: { color: '#1d4ed8', fontWeight: '700', textDecorationLine: 'underline' },
  cancel: { paddingVertical: 10, alignItems: 'center' },
  cancelText: { color: facultyTheme.textMuted, fontWeight: '600' },
});
