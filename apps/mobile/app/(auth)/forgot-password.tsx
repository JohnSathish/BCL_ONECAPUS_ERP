import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authColors, authTheme } from '@/components/auth/auth-theme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = authColors(scheme);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient colors={[...authTheme.gradient]} style={styles.header}>
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 20 }}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>Forgot Password</Text>
          <Text style={styles.subtitle}>
            Students sign in with college roll number. Password recovery is handled by the college
            office.
          </Text>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>What to do</Text>
        <Text style={[styles.step, { color: colors.textMuted }]}>
          1. Contact the college administrator or office staff with your roll number.
        </Text>
        <Text style={[styles.step, { color: colors.textMuted }]}>
          2. Ask them to reset your password (they can set it back to your roll number).
        </Text>
        <Text style={[styles.step, { color: colors.textMuted }]}>
          3. Sign in with the temporary password, then complete the mandatory password change.
        </Text>
        <Text style={[styles.note, { color: colors.textMuted }]}>
          Email and mobile OTP reset will be available in a future release once a verified email or
          phone number is on your profile.
        </Text>
        <Pressable style={styles.btn} onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.btnText}>Return to login</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  back: { color: '#fff', fontWeight: '600', marginBottom: 12 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.85)', marginTop: 8, lineHeight: 20 },
  body: { padding: 20, gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  step: { fontSize: 14, lineHeight: 20 },
  note: { fontSize: 12, lineHeight: 18, marginTop: 8 },
  btn: {
    marginTop: 16,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
