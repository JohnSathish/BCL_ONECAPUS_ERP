import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { login } from '@/auth/login';
import { NavyButton, Screen } from '@/ui/kit';
import { colors, radii, space } from '@/theme/tokens';

export default function LoginScreen() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const session = await login(identifier, password);
      router.replace(session.user.mustResetPassword ? '/password' : '/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen light>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.inner}
      >
        <Image source={require('../assets/icon.png')} style={styles.crest} />
        <Text style={styles.school}>St. Luke's Secondary School</Text>
        <Text style={styles.place}>Tura, Meghalaya</Text>
        <Text style={styles.hello}>Welcome</Text>
        <Text style={styles.sub}>Sign in to continue</Text>
        <View style={styles.field}>
          <Text style={styles.label}>Admission / Roll number</Text>
          <TextInput
            placeholder="e.g. SLS26-0001 or 1"
            autoCapitalize="characters"
            autoCorrect={false}
            value={identifier}
            onChangeText={setIdentifier}
            style={styles.input}
            placeholderTextColor={colors.muted}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            placeholder="First login: StLuke@123"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            placeholderTextColor={colors.muted}
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <NavyButton
          label={busy ? 'Signing in…' : 'Next'}
          onPress={() => void submit()}
          disabled={busy}
        />
        <Text style={styles.hint}>
          Students use admission number or class roll number. First login password is StLuke@123;
          you will set your own password after that. You stay signed in until you log out.
        </Text>
        <Pressable onPress={() => void Linking.openURL('https://stlukestura.in')}>
          <Text style={styles.contact}>
            New here? <Text style={styles.link}>Contact School</Text>
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  inner: { flex: 1, padding: space.lg, gap: 10, justifyContent: 'center' },
  crest: { width: 88, height: 88, alignSelf: 'center', borderRadius: 44 },
  school: { textAlign: 'center', fontWeight: '800', color: colors.navy, fontSize: 18 },
  place: { textAlign: 'center', color: colors.muted, marginBottom: 8 },
  hello: { textAlign: 'center', fontSize: 28, fontWeight: '800', color: colors.ink },
  sub: { textAlign: 'center', color: colors.muted, marginBottom: 8 },
  field: { gap: 6 },
  label: { fontWeight: '700', color: colors.navy, fontSize: 13 },
  input: {
    backgroundColor: '#f3f5fb',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    height: 50,
    color: colors.ink,
  },
  error: { color: colors.danger },
  hint: { color: colors.muted, textAlign: 'center', fontSize: 12, lineHeight: 18 },
  contact: { textAlign: 'center', color: colors.muted, marginTop: 8 },
  link: { color: colors.navy, fontWeight: '800' },
});
