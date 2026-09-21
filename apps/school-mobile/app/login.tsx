import { useEffect, useState } from 'react';
import {
  Keyboard,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { CREST, SCHOOL } from '@/brand';
import { login } from '@/auth/account';
import { markPasswordLogin, wantsPasswordLogin } from '@/auth/password-gate';
import { destinationAfterAuth } from '@/auth/post-login';
import { restoreSchoolSession } from '@/auth/restore';
import { APP_VERSION } from '@/api/config';
import { Screen } from '@/ui/kit';
import { colors, radii, space } from '@/theme/tokens';

const CONTACT_URL = 'https://stlukestura.in';

export default function LoginScreen() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idError, setIdError] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (wantsPasswordLogin()) return;
    let alive = true;
    void restoreSchoolSession()
      .then((restored) => {
        if (!alive) return;
        if (restored.route !== '/login') router.replace(restored.route);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [router]);

  const submit = async () => {
    const id = identifier.trim();
    setIdError(id ? null : 'Admission or roll number is required.');
    setPwError(password ? null : 'Password is required.');
    if (!id || !password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const session = await login(id, password);
      markPasswordLogin();
      Keyboard.dismiss();
      const next = destinationAfterAuth(session.user, session.firstLogin);
      router.replace(next);
      return;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen light insetBottom>
      <LinearGradient colors={['#dce6fb', '#eef3fc', '#ffffff']} style={styles.flex}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.inner}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Image source={CREST} style={styles.crest} resizeMode="contain" />
            <Text style={styles.school}>{SCHOOL.legalName}</Text>
            <Text style={styles.place}>{SCHOOL.placeShort}</Text>
            <Text style={styles.motto}>{SCHOOL.motto.toUpperCase()}</Text>

            <View style={styles.card}>
              <Text style={styles.hello}>Welcome Back</Text>
              <Text style={styles.sub}>Sign in to access your account</Text>

              <Text style={styles.label}>Admission / Roll Number</Text>
              <TextInput
                placeholder="Enter admission or roll number"
                autoCapitalize="characters"
                autoCorrect={false}
                value={identifier}
                onChangeText={(v) => {
                  setIdentifier(v);
                  if (idError) setIdError(null);
                }}
                style={[styles.input, idError && styles.inputBad]}
                placeholderTextColor={colors.muted}
                returnKeyType="next"
              />
              {idError ? <Text style={styles.fieldError}>{idError}</Text> : null}

              <Text style={[styles.label, styles.labelGap]}>Password</Text>
              <View style={[styles.passwordWrap, pwError && styles.inputBad]}>
                <TextInput
                  placeholder="Enter your password"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(v) => {
                    setPassword(v);
                    if (pwError) setPwError(null);
                  }}
                  style={styles.passwordInput}
                  placeholderTextColor={colors.muted}
                  returnKeyType="go"
                  onSubmitEditing={() => void submit()}
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={10}
                  style={styles.eye}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Text style={styles.eyeText}>👁</Text>
                </Pressable>
              </View>
              {pwError ? <Text style={styles.fieldError}>{pwError}</Text> : null}

              <Pressable onPress={() => router.push('/forgot-password')} hitSlop={8}>
                <Text style={styles.forgot}>Forgot Password?</Text>
              </Pressable>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable
                onPress={() => void submit()}
                disabled={busy}
                style={[styles.signIn, busy && styles.signInBusy]}
              >
                <Text style={styles.signInText}>{busy ? 'Signing in...' : 'SIGN IN  →'}</Text>
              </Pressable>
            </View>

            <View style={styles.block}>
              <Text style={styles.blockLabel}>First time here?</Text>
              <Pressable onPress={() => router.push('/activate')} style={styles.outlineBtn}>
                <Text style={styles.outlineText}>Activate Your Account</Text>
              </Pressable>
            </View>

            <View style={styles.block}>
              <Text style={styles.blockLabel}>Need help?</Text>
              <Pressable onPress={() => void Linking.openURL(CONTACT_URL)}>
                <Text style={styles.contact}>Contact School</Text>
              </Pressable>
            </View>

            <Text style={styles.version}>v{APP_VERSION}</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  inner: {
    flexGrow: 1,
    paddingHorizontal: space.lg,
    paddingTop: 28,
    paddingBottom: 32,
    alignItems: 'center',
  },
  crest: { width: 168, height: 168, marginBottom: 4 },
  school: {
    textAlign: 'center',
    fontWeight: '800',
    color: colors.navy,
    fontSize: 20,
    lineHeight: 26,
  },
  place: {
    textAlign: 'center',
    color: colors.muted,
    fontWeight: '600',
    fontSize: 13,
    marginTop: 6,
  },
  motto: {
    textAlign: 'center',
    color: '#8a94b8',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 2.4,
    marginTop: 10,
    marginBottom: 22,
  },
  card: {
    width: '100%',
    backgroundColor: colors.paper,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    shadowColor: '#1a237e',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  hello: { fontSize: 22, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  sub: { textAlign: 'center', color: colors.muted, marginTop: 4, marginBottom: 20 },
  label: { fontWeight: '700', color: colors.navy, fontSize: 13, marginBottom: 8 },
  labelGap: { marginTop: 14 },
  input: {
    backgroundColor: '#f7f8fc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e4e8f2',
    paddingHorizontal: 14,
    height: 50,
    color: colors.ink,
  },
  inputBad: { borderColor: colors.danger },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7f8fc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e4e8f2',
    paddingRight: 8,
  },
  passwordInput: { flex: 1, height: 50, paddingHorizontal: 14, color: colors.ink },
  eye: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  eyeText: { fontSize: 16 },
  fieldError: { color: colors.danger, marginTop: 6, fontSize: 12 },
  error: { color: colors.danger, marginTop: 12, textAlign: 'center' },
  forgot: {
    textAlign: 'right',
    color: colors.navy,
    fontWeight: '700',
    marginTop: 12,
    fontSize: 13,
  },
  signIn: {
    backgroundColor: colors.navy,
    borderRadius: radii.pill,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  signInBusy: { opacity: 0.65 },
  signInText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  block: { width: '100%', marginTop: 22, alignItems: 'center', gap: 10 },
  blockLabel: { color: colors.muted, fontWeight: '600' },
  outlineBtn: {
    width: '100%',
    height: 48,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: '#cdd5ea',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  outlineText: { color: colors.navy, fontWeight: '800' },
  contact: { color: colors.navy, fontWeight: '800', fontSize: 15 },
  version: { marginTop: 'auto', paddingTop: 24, color: colors.muted, fontSize: 11 },
});
