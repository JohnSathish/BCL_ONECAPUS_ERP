import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { sendOtp, verifyActivationCode, verifyOtp } from '@/auth/account';
import { NavyButton, Screen } from '@/ui/kit';
import { colors, radii, space } from '@/theme/tokens';

export default function AuthVerifyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    purpose?: string;
    challengeId?: string;
    masked?: string;
    channel?: string;
    codeFallback?: string;
    resendSeconds?: string;
  }>();
  const purpose = params.purpose === 'RESET' ? 'RESET' : 'ACTIVATE';
  const challengeId = String(params.challengeId || '');
  const [otp, setOtp] = useState('');
  const [code, setCode] = useState('');
  const [useCode, setUseCode] = useState(params.channel === 'CODE');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(Number(params.resendSeconds || 0));
  const [masked, setMasked] = useState(params.masked || 'your registered contact');

  useEffect(() => {
    if (!challengeId || params.channel === 'CODE') return;
    void sendOtp(challengeId, purpose)
      .then((res) => {
        setWait(res.resendSeconds ?? 45);
        if (res.masked) setMasked(res.masked);
      })
      .catch(() => undefined);
  }, [challengeId, params.channel, purpose]);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setInterval(() => setWait((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [wait]);

  const title = purpose === 'RESET' ? 'Reset Password' : 'Verify Your Account';

  const requestOtp = async () => {
    if (!challengeId || wait > 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await sendOtp(challengeId, purpose);
      setWait(res.resendSeconds ?? 45);
      if (res.masked) setMasked(res.masked);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Too many attempts. Please try again later.');
    } finally {
      setBusy(false);
    }
  };

  const submitOtp = async () => {
    if (otp.trim().length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await verifyOtp(challengeId, otp.trim(), purpose);
      router.replace({
        pathname: '/auth-password',
        params: { challengeId, purpose },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That verification code is not valid.');
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async () => {
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await verifyActivationCode(challengeId, code.trim());
      router.replace({
        pathname: '/auth-password',
        params: { challengeId, purpose },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That activation code is not valid.');
    } finally {
      setBusy(false);
    }
  };

  const digits = useMemo(() => otp.replace(/\D/g, '').slice(0, 6), [otp]);

  return (
    <Screen title={title} onBack light insetBottom>
      <View style={styles.box}>
        {!useCode ? (
          <>
            <Text style={styles.lead}>We sent a verification code to</Text>
            <Text style={styles.masked}>{masked}</Text>
            <TextInput
              value={digits}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
              style={styles.otp}
              placeholder="______"
              placeholderTextColor={colors.muted}
              textAlign="center"
            />
            <NavyButton
              label={busy ? 'Please wait…' : 'Verify'}
              onPress={() => void submitOtp()}
              disabled={busy || digits.length !== 6}
            />
            {wait > 0 ? (
              <Text style={styles.wait}>Resend in {wait} seconds</Text>
            ) : (
              <Pressable onPress={() => void requestOtp()}>
                <Text style={styles.link}>Resend OTP</Text>
              </Pressable>
            )}
            {params.codeFallback === '1' ? (
              <Pressable onPress={() => setUseCode(true)}>
                <Text style={styles.link}>Use School Activation Code</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.lead}>
              Enter the one-time activation code given by the school office.
            </Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.input}
              placeholder="7K4P-92MX"
              placeholderTextColor={colors.muted}
            />
            <NavyButton
              label={busy ? 'Please wait…' : 'Continue'}
              onPress={() => void submitCode()}
              disabled={busy}
            />
            {params.channel !== 'CODE' ? (
              <Pressable onPress={() => setUseCode(false)}>
                <Text style={styles.link}>Use OTP instead</Text>
              </Pressable>
            ) : null}
          </>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: { padding: space.lg, gap: 12 },
  lead: { color: colors.muted, textAlign: 'center' },
  masked: { textAlign: 'center', fontWeight: '800', color: colors.navy, fontSize: 18 },
  otp: {
    letterSpacing: 10,
    fontSize: 28,
    fontWeight: '800',
    height: 56,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#f3f5fb',
    color: colors.ink,
  },
  input: {
    backgroundColor: '#f3f5fb',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    height: 50,
    color: colors.ink,
  },
  wait: { textAlign: 'center', color: colors.muted },
  link: { textAlign: 'center', color: colors.navy, fontWeight: '700', padding: 8 },
  error: { color: colors.danger, textAlign: 'center' },
});
