import { useState } from 'react';
import { Button, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';
import { apiFetch, setAppType } from '@/api/client';
import { getDeviceId } from '@/auth/device';
import { saveSession } from '@/auth/session';

type Challenge = { token: string; question: string };
type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: { permissions?: string[]; roles?: string[] };
};

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadChallenge() {
    const data = await apiFetch<Challenge>('/v1/auth/challenge', { skipAuth: true });
    setChallenge(data);
    setAnswer('');
  }

  async function onLogin() {
    if (!challenge) return;
    setLoading(true);
    setError(null);
    try {
      const session = await apiFetch<LoginResponse>('/v1/auth/login', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({
          email,
          password,
          challengeToken: challenge.token,
          challengeAnswer: Number(answer),
        }),
      });
      await saveSession(session.accessToken, session.refreshToken);
      const perms = session.user.permissions ?? [];
      const isStaff = perms.includes('staff:portal:self');
      const isStudent = perms.includes('student:portal:self');
      setAppType(isStaff && !isStudent ? 'staff' : 'student');
      const deviceId = await getDeviceId();
      await apiFetch('/v1/mobile-app/devices/register', {
        method: 'POST',
        body: JSON.stringify({
          deviceId,
          appType: isStaff && !isStudent ? 'STAFF' : 'STUDENT',
          platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
        }),
      });
      router.replace((isStaff && !isStudent ? '/(staff)/index' : '/(student)') as never);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
      await loadChallenge();
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: '600' }}>Sign in</Text>
      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
        style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}
      />
      {challenge ? (
        <>
          <Text>{challenge.question}</Text>
          <TextInput
            placeholder="Answer"
            keyboardType="numeric"
            value={answer}
            onChangeText={setAnswer}
            style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}
          />
        </>
      ) : (
        <Button title="Load challenge" onPress={() => void loadChallenge()} />
      )}
      <Button
        title={loading ? 'Signing in…' : 'Sign in'}
        onPress={() => void onLogin()}
        disabled={loading || !challenge}
      />
      {error ? <Text style={{ color: 'crimson' }}>{error}</Text> : null}
    </ScrollView>
  );
}
