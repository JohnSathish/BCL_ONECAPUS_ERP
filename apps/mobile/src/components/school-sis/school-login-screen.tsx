import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { performLogin } from '@/auth/login-flow';
import {
  authenticateWithBiometrics,
  canUseBiometrics,
  isBiometricEnrolled,
  setBiometricEnrolled,
} from '@/auth/biometric';
import { SchoolCrest } from '@/components/school-sis/school-crest';
import { SCHOOL_BRAND } from '@/constants/school-branding';

export function SchoolLoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish(href: string) {
    router.replace(href as never);
  }

  async function onLogin() {
    setLoading(true);
    setError(null);
    try {
      const result = await performLogin({
        identifier,
        password,
        rememberMe,
      });
      if (result.mustResetPassword) {
        router.replace('/(auth)/change-password');
        return;
      }
      const capability = await canUseBiometrics();
      const enrolled = await isBiometricEnrolled();
      if (capability.available && !enrolled) {
        Alert.alert(
          'Enable fingerprint / Face ID?',
          'Unlock the school app next time. Your password is not stored.',
          [
            {
              text: 'Not now',
              style: 'cancel',
              onPress: () => void finish(String(result.route.href)),
            },
            {
              text: 'Enable',
              onPress: () => {
                void (async () => {
                  const auth = await authenticateWithBiometrics('Confirm to enable unlock');
                  if (auth.ok) await setBiometricEnrolled(true);
                  await finish(String(result.route.href));
                })();
              },
            },
          ],
        );
        return;
      }
      await finish(String(result.route.href));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        bounces={false}
      >
        <LinearGradient
          colors={[SCHOOL_BRAND.navyDeep, SCHOOL_BRAND.navyMid]}
          style={[styles.header, { paddingTop: insets.top + 16 }]}
        >
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
            <Text style={styles.back}>‹ Back</Text>
          </Pressable>
          <SchoolCrest size={112} />
          <Text style={styles.title}>{SCHOOL_BRAND.legalName}</Text>
          <Text style={styles.motto}>{SCHOOL_BRAND.motto}</Text>
          <Text style={styles.address}>{SCHOOL_BRAND.fullAddress}</Text>
        </LinearGradient>

        <View style={styles.card}>
          <Text style={styles.hello}>Sign in</Text>
          <Text style={styles.hint}>Admission number, email or username</Text>
          <TextInput
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="e.g. SLS26-0001 or student@stlukestura.in"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            accessibilityLabel="Username"
          />
          <Text style={[styles.hint, { marginTop: 14 }]}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              placeholder="Enter password"
              placeholderTextColor="#94a3b8"
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              accessibilityLabel="Password"
            />
            <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
              <Text style={styles.show}>{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>
          <View style={styles.row}>
            <Pressable onPress={() => setRememberMe((v) => !v)} style={styles.remember}>
              <View style={[styles.box, rememberMe && styles.boxOn]} />
              <Text style={styles.rememberText}>Remember me</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/(auth)/forgot-password')}>
              <Text style={styles.forgot}>Forgot password?</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => void onLogin()}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
          >
            <LinearGradient colors={[SCHOOL_BRAND.navyMid, '#2436a0']} style={styles.cta}>
              <Text style={styles.ctaText}>{loading ? 'Signing in…' : 'Sign in to school'}</Text>
            </LinearGradient>
          </Pressable>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SCHOOL_BRAND.cream },
  header: { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 28 },
  back: { alignSelf: 'flex-start', color: SCHOOL_BRAND.gold, fontWeight: '700', marginBottom: 8 },
  title: {
    marginTop: 12,
    color: '#fff',
    fontWeight: '800',
    fontSize: 17,
    textAlign: 'center',
  },
  motto: { marginTop: 6, color: SCHOOL_BRAND.gold, fontWeight: '700' },
  address: { marginTop: 8, color: '#c5d0ea', textAlign: 'center', fontSize: 13, lineHeight: 18 },
  card: {
    marginTop: -16,
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 20,
    shadowColor: '#12215a',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  hello: { fontSize: 22, fontWeight: '800', color: SCHOOL_BRAND.navyDeep },
  hint: { marginTop: 12, marginBottom: 6, color: '#64748b', fontWeight: '600', fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    marginBottom: 4,
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  show: { color: SCHOOL_BRAND.navyMid, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  remember: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  box: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: '#94a3b8' },
  boxOn: { backgroundColor: SCHOOL_BRAND.navyMid, borderColor: SCHOOL_BRAND.navyMid },
  rememberText: { color: '#334155', fontWeight: '600' },
  forgot: { color: SCHOOL_BRAND.navyMid, fontWeight: '700' },
  cta: { marginTop: 20, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  error: { marginTop: 12, color: '#b91c1c', fontWeight: '600' },
});
