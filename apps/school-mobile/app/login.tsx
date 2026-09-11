import { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { fetchChallenge, login, type Challenge } from '@/auth/login';
import { GoldButton } from '@/ui/kit';
import { colors, radii, space } from '@/theme/tokens';

export default function LoginScreen() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [answer, setAnswer] = useState('');
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchChallenge()
      .then(setChallenge)
      .catch((err: Error) => setError(err.message));
  }, []);

  const submit = async () => {
    if (!challenge) return;
    setBusy(true);
    setError(null);
    try {
      await login(identifier, password, challenge, Number(answer));
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in');
      void fetchChallenge()
        .then(setChallenge)
        .catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient colors={[colors.navyDeep, colors.navy]} style={styles.fill}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.inner}
      >
        <Image source={require('../assets/icon.png')} style={styles.crest} />
        <Text style={styles.kicker}>St. Luke's Secondary School, Tura</Text>
        <Text style={styles.hello}>Welcome back</Text>
        <View style={styles.card}>
          <TextInput
            placeholder="Email or username"
            autoCapitalize="none"
            value={identifier}
            onChangeText={setIdentifier}
            style={styles.input}
            placeholderTextColor={colors.muted}
          />
          <TextInput
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            placeholderTextColor={colors.muted}
          />
          <Text style={styles.hint}>
            {challenge?.expression ?? challenge?.question ?? 'Loading verification…'}
          </Text>
          <TextInput
            placeholder="Answer"
            keyboardType="number-pad"
            value={answer}
            onChangeText={setAnswer}
            style={styles.input}
            placeholderTextColor={colors.muted}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <GoldButton label={busy ? 'Signing in…' : 'Enter school'} onPress={() => void submit()} />
        </View>
        <Text style={styles.foot}>Stay signed in until you log out.</Text>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', padding: space.lg, gap: 12 },
  crest: { width: 88, height: 88, alignSelf: 'center', borderRadius: 20 },
  kicker: { color: colors.gold, textAlign: 'center', fontWeight: '700' },
  hello: { color: '#fff', fontSize: 28, fontWeight: '800', textAlign: 'center' },
  card: {
    backgroundColor: colors.cream,
    borderRadius: radii.lg,
    padding: space.md,
    gap: 10,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    height: 48,
    color: colors.ink,
  },
  hint: { color: colors.navy, fontWeight: '600' },
  error: { color: colors.danger },
  foot: { color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
});
