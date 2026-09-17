import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { startActivate } from '@/auth/account';
import { NavyButton, Screen } from '@/ui/kit';
import { colors, radii, space } from '@/theme/tokens';

export default function ActivateScreen() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const continueNext = async () => {
    if (!identifier.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await startActivate(identifier);
      setNotice(res.message);
      if (res.challengeId) {
        router.push({
          pathname: '/auth-verify',
          params: {
            purpose: 'ACTIVATE',
            challengeId: res.challengeId,
            masked: res.masked ?? '',
            channel: res.channel ?? '',
            codeFallback: res.codeFallback ? '1' : '0',
            resendSeconds: String(res.resendSeconds ?? 45),
          },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please try again later.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Activate Your Account" onBack light>
      <View style={styles.box}>
        <Text style={styles.lead}>Enter your admission or roll number to get started.</Text>
        <TextInput
          placeholder="Admission / Roll Number"
          autoCapitalize="characters"
          autoCorrect={false}
          value={identifier}
          onChangeText={setIdentifier}
          style={styles.input}
          placeholderTextColor={colors.muted}
        />
        {notice && !error ? <Text style={styles.notice}>{notice}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <NavyButton
          label={busy ? 'Please wait…' : 'Continue'}
          onPress={() => void continueNext()}
          disabled={busy}
        />
        <Pressable onPress={() => router.replace('/login')}>
          <Text style={styles.link}>Back to Sign In</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: { padding: space.lg, gap: 12 },
  lead: { color: colors.muted, lineHeight: 22 },
  input: {
    backgroundColor: '#f3f5fb',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    height: 50,
    color: colors.ink,
  },
  notice: { color: colors.navy, lineHeight: 20 },
  error: { color: colors.danger },
  link: { textAlign: 'center', color: colors.navy, fontWeight: '700', padding: 8 },
});
