import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  authenticateWithBiometrics,
  biometricCapability,
  biometricFailMessage,
} from '@/auth/biometric';
import { getUser } from '@/auth/session';
import { refreshAccessToken } from '@/auth/token-refresh';
import { CREST, SCHOOL } from '@/brand';
import { Screen } from '@/ui/kit';
import { destinationAfterAuth } from '@/auth/post-login';
import { justDidPasswordLogin } from '@/auth/password-gate';
import { colors, radii, space } from '@/theme/tokens';

export default function UnlockScreen() {
  const router = useRouter();
  const [name, setName] = useState('Student');
  const [label, setLabel] = useState('Unlock with fingerprint');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getUser().then((user) => {
      if (justDidPasswordLogin() || user?.mustResetPassword) {
        router.replace(destinationAfterAuth(user));
        return;
      }
      if (user?.displayName) setName(user.displayName);
    });
    void biometricCapability().then((cap) => setLabel(cap.label));
  }, [router]);

  const unlock = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const auth = await authenticateWithBiometrics(label);
      if (!auth.ok) {
        if (auth.reason !== 'cancel') {
          setError(
            biometricFailMessage(auth.reason) ??
              'Biometric unlock was cancelled. You can try again or use your password.',
          );
        }
        return;
      }
      await refreshAccessToken({ biometricUnlock: true });
      const user = await getUser();
      router.replace(destinationAfterAuth(user));
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'ACCOUNT_DISABLED') {
        router.replace('/account-disabled');
        return;
      }
      if (msg.toLowerCase().includes('offline')) {
        const user = await getUser();
        router.replace(destinationAfterAuth(user));
        return;
      }
      setError('Session could not be renewed. Sign in with your password.');
    } finally {
      setBusy(false);
    }
  }, [busy, label, router]);

  return (
    <Screen light insetBottom>
      <View style={styles.box}>
        <Image source={CREST} style={styles.crest} resizeMode="contain" />
        <Text style={styles.school}>{SCHOOL.legalName}</Text>
        <Text style={styles.hello}>Welcome Back</Text>
        <Text style={styles.name}>{name}</Text>
        <Pressable onPress={() => void unlock()} style={styles.bio} disabled={busy}>
          <Text style={styles.icon}>🔒</Text>
          <Text style={styles.label}>{busy ? 'Unlocking…' : label}</Text>
        </Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable onPress={() => router.replace('/login')}>
          <Text style={styles.password}>Use Password</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', padding: space.lg, paddingTop: 48, gap: 10 },
  crest: { width: 88, height: 88, marginBottom: 8 },
  school: { fontWeight: '800', color: colors.navy, textAlign: 'center' },
  hello: { fontSize: 26, fontWeight: '800', color: colors.ink, marginTop: 16 },
  name: { fontSize: 18, color: colors.muted, fontWeight: '700' },
  bio: {
    marginTop: 28,
    width: '100%',
    borderRadius: radii.lg,
    backgroundColor: '#f3f5fb',
    alignItems: 'center',
    paddingVertical: 28,
    gap: 10,
  },
  icon: { fontSize: 18, color: colors.navy, fontWeight: '800', letterSpacing: 1 },
  label: { color: colors.navy, fontWeight: '800', fontSize: 16 },
  error: { color: colors.danger, textAlign: 'center', marginTop: 8 },
  password: { color: colors.navy, fontWeight: '800', marginTop: 20, padding: 8 },
});
