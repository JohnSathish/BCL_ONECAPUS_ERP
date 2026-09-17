import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { passwordStrength, setPasswordFromChallenge } from '@/auth/account';
import { NavyButton, Screen } from '@/ui/kit';
import { colors, radii, space } from '@/theme/tokens';

export default function AuthPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ challengeId?: string; purpose?: string }>();
  const purpose = params.purpose === 'RESET' ? 'RESET' : 'ACTIVATE';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const strength = passwordStrength(password);

  const submit = async () => {
    if (busy) return;
    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords must match.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await setPasswordFromChallenge(
        String(params.challengeId || ''),
        password,
        confirm,
        purpose,
      );
      router.replace({
        pathname: '/auth-success',
        params: {
          purpose,
          admission: res.admissionHint ?? '',
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Create Your Password" onBack light>
      <View style={styles.box}>
        <Text style={styles.req}>Minimum 8 characters. Do not use your admission number.</Text>
        <View style={styles.passwordWrap}>
          <TextInput
            placeholder="New password"
            secureTextEntry={!show}
            value={password}
            onChangeText={setPassword}
            style={styles.passwordInput}
            placeholderTextColor={colors.muted}
          />
          <Pressable onPress={() => setShow((v) => !v)} style={styles.eye}>
            <Text>👁</Text>
          </Pressable>
        </View>
        {password ? <Text style={styles.strength}>Strength: {strength.label}</Text> : null}
        <View style={styles.passwordWrap}>
          <TextInput
            placeholder="Confirm your password"
            secureTextEntry={!show}
            value={confirm}
            onChangeText={setConfirm}
            style={styles.passwordInput}
            placeholderTextColor={colors.muted}
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <NavyButton
          label={busy ? 'Please wait…' : 'Create Password'}
          onPress={() => void submit()}
          disabled={busy}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: { padding: space.lg, gap: 12 },
  req: { color: colors.muted, lineHeight: 20 },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f5fb',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingRight: 8,
  },
  passwordInput: { flex: 1, height: 50, paddingHorizontal: 14, color: colors.ink },
  eye: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  strength: { fontWeight: '700', color: colors.navy },
  error: { color: colors.danger },
});
