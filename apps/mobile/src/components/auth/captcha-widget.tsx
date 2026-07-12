import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiFetch } from '@/api/client';
import { hydrateSchoolConfig } from '@/auth/school-config';
import { authColors, type AuthColorScheme } from './auth-theme';

export type Challenge = { token: string; question?: string; expression?: string };

type CaptchaWidgetProps = {
  scheme: AuthColorScheme;
  answer: string;
  onAnswerChange: (value: string) => void;
  onChallenge: (challenge: Challenge | null) => void;
};

const TRUST_ITEMS = [
  { icon: '🛡', label: 'Safe Login' },
  { icon: '🔒', label: '256-bit Encryption' },
  { icon: '✓', label: 'Secure Verification' },
] as const;

function isValidChallenge(data: unknown): data is Challenge {
  if (!data || typeof data !== 'object') return false;
  const row = data as Challenge;
  const prompt = row.expression ?? row.question;
  return (
    typeof row.token === 'string' &&
    row.token.length > 10 &&
    typeof prompt === 'string' &&
    prompt.length > 0
  );
}

async function fetchChallengeWithRetry(attempts = 3): Promise<Challenge> {
  await hydrateSchoolConfig();
  let lastError: Error | null = null;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const data = await apiFetch<Challenge>('/v1/auth/challenge', {
        skipAuth: true,
        timeoutMs: 15_000,
      });
      if (!isValidChallenge(data)) {
        throw new Error('Verification challenge was incomplete. Tap refresh.');
      }
      return data;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Could not load verification');
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 400 * (i + 1)));
      }
    }
  }
  throw lastError ?? new Error('Could not load verification. Tap retry.');
}

export function CaptchaWidget({ scheme, answer, onAnswerChange, onChallenge }: CaptchaWidgetProps) {
  const colors = authColors(scheme);
  const [activated, setActivated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const challengeText = challenge?.question ?? challenge?.expression ?? '';

  const loadChallenge = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchChallengeWithRetry();
      if (id !== requestId.current) return;
      setChallenge(data);
      onAnswerChange('');
      onChallenge(data);
      setActivated(true);
      setError(null);
    } catch (err) {
      if (id !== requestId.current) return;
      setChallenge(null);
      onChallenge(null);
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Could not load verification. Tap retry.';
      setError(message);
      // Stay on activated panel so Refresh is available after first attempt.
      setActivated(true);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [onAnswerChange, onChallenge]);

  useEffect(() => {
    // Warm school config early so the first challenge request has the right API base.
    void hydrateSchoolConfig();
  }, []);

  if (!activated) {
    return (
      <View style={styles.wrap}>
        <Pressable
          style={[styles.box, { borderColor: colors.border, backgroundColor: colors.surface }]}
          onPress={() => void loadChallenge()}
          disabled={loading}
        >
          <View style={[styles.shield, { backgroundColor: '#eff6ff' }]}>
            {loading ? (
              <ActivityIndicator color="#2563eb" />
            ) : (
              <Text style={styles.shieldIcon}>🛡</Text>
            )}
          </View>
          <View style={styles.boxText}>
            <Text style={[styles.boxTitle, { color: colors.text }]}>
              Protected by Secure Verification
            </Text>
            <Text style={[styles.boxSub, { color: colors.textMuted }]}>
              {loading ? 'Loading verification…' : 'Tap to confirm you are not a robot'}
            </Text>
          </View>
          <View style={[styles.checkbox, { borderColor: '#2563eb' }]} />
        </Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.trustRow}>
          {TRUST_ITEMS.map((item) => (
            <View
              key={item.label}
              style={[
                styles.trustChip,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={styles.trustIcon}>{item.icon}</Text>
              <Text style={[styles.trustLabel, { color: colors.textMuted }]}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={[styles.panel, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <View style={styles.verifiedRow}>
          <View style={styles.verifiedBadge}>
            {loading ? (
              <ActivityIndicator size="small" color="#059669" />
            ) : (
              <Text style={styles.check}>{challenge ? '✓' : '!'}</Text>
            )}
          </View>
          <Text style={[styles.verifiedText, { color: colors.text }]}>
            {loading
              ? 'Loading verification…'
              : challenge
                ? 'Secure verification active'
                : 'Verification unavailable'}
          </Text>
          <Pressable onPress={() => void loadChallenge()} disabled={loading} hitSlop={8}>
            <Text style={[styles.retry, loading && { opacity: 0.5 }]}>
              {loading ? '…' : 'Refresh'}
            </Text>
          </Pressable>
        </View>
        <Text style={[styles.prompt, { color: colors.text }]}>
          {loading
            ? 'Fetching a new prompt…'
            : challengeText
              ? `What is ${challengeText}?`
              : 'Solve the verification prompt'}
        </Text>
        <TextInput
          value={answer}
          onChangeText={onAnswerChange}
          keyboardType="numeric"
          placeholder="Your answer"
          placeholderTextColor={colors.textMuted}
          editable={!loading && !!challenge}
          style={[
            styles.input,
            { borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg },
          ]}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
      <View style={styles.trustRow}>
        {TRUST_ITEMS.map((item) => (
          <View
            key={item.label}
            style={[
              styles.trustChip,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={styles.trustIcon}>{item.icon}</Text>
            <Text style={[styles.trustLabel, { color: colors.textMuted }]}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  shield: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldIcon: { fontSize: 20 },
  boxText: { flex: 1, gap: 2 },
  boxTitle: { fontSize: 14, fontWeight: '700' },
  boxSub: { fontSize: 11 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
  },
  panel: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  verifiedBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: { color: '#059669', fontWeight: '700', fontSize: 12 },
  verifiedText: { flex: 1, fontSize: 13, fontWeight: '600' },
  retry: { color: '#2563eb', fontSize: 12, fontWeight: '600' },
  prompt: { fontSize: 14, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  error: { color: '#dc2626', fontSize: 12 },
  trustRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  trustChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  trustIcon: { fontSize: 11 },
  trustLabel: { fontSize: 10, fontWeight: '600' },
});
