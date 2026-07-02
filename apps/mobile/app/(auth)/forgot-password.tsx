import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiFetch } from '@/api/client';
import { AuthTextField } from '@/components/auth/auth-text-field';
import { authColors, authTheme } from '@/components/auth/auth-theme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = authColors(scheme);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch('/v1/auth/password-reset/request', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setMessage(
        'If an account exists for this email, password reset instructions have been sent.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not request password reset');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient colors={[...authTheme.gradient]} style={styles.header}>
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 20 }}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>Forgot Password</Text>
          <Text style={styles.subtitle}>Enter your registered college email</Text>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <AuthTextField
          scheme={scheme}
          label="College Email"
          placeholder="you@college.edu"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
        />
        <Pressable
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={() => void onSubmit()}
          disabled={loading}
        >
          <Text style={styles.btnText}>{loading ? 'Sending…' : 'Send reset link'}</Text>
        </Pressable>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={[styles.note, { color: colors.textMuted }]}>
          Mobile OTP reset will be added in a future release. Email reset works today.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  back: { color: '#dbeafe', fontSize: 14, marginBottom: 12 },
  title: { color: '#fff', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#bfdbfe', marginTop: 4, fontSize: 14 },
  body: { padding: 20, gap: 14 },
  btn: {
    backgroundColor: authTheme.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  message: { color: '#059669', fontSize: 13, lineHeight: 20 },
  error: { color: '#dc2626', fontSize: 13 },
  note: { fontSize: 12, lineHeight: 18 },
});
