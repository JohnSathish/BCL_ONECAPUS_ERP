import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchAuthLoginContext } from '@/auth/auth-context';
import { performRfidRedeem } from '@/auth/login-flow';
import { authColors, authTheme } from '@/components/auth/auth-theme';

type NfcManagerModule = {
  default: {
    start: () => Promise<void>;
    isSupported: () => Promise<boolean>;
    requestTechnology: (tech: unknown) => Promise<void>;
    getTag: () => Promise<{ id?: string | number[] } | null>;
    cancelTechnologyRequest: () => Promise<void>;
  };
  NfcTech: { Ndef: unknown };
};

async function tryReadNfcUid(): Promise<string | null> {
  try {
    // Optional peer dependency — desk/testing builds may omit NFC.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-nfc-manager') as NfcManagerModule;
    const NfcManager = mod.default;
    const { NfcTech } = mod;
    await NfcManager.start();
    const supported = await NfcManager.isSupported();
    if (!supported) return null;
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const tag = await NfcManager.getTag();
    await NfcManager.cancelTechnologyRequest().catch(() => undefined);
    if (!tag?.id) return null;
    if (typeof tag.id === 'string') return tag.id;
    if (Array.isArray(tag.id)) {
      return tag.id
        .map((b) => Number(b).toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
    }
    return null;
  } catch {
    return null;
  }
}

export default function RfidLoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = authColors(scheme);
  const [cardUid, setCardUid] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [nfcAvailable, setNfcAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ctx = await fetchAuthLoginContext();
        if (!cancelled) setAllowed(Boolean(ctx.loginMethods.allowRfidLogin));
      } catch {
        if (!cancelled) setAllowed(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
      try {
        // Probe without starting a full NFC session.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('react-native-nfc-manager');
        if (!cancelled) setNfcAvailable(true);
      } catch {
        if (!cancelled) setNfcAvailable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const completeLogin = useCallback(
    async (uid: string) => {
      const value = uid.trim();
      if (value.length < 4) {
        setError('Enter a valid card UID (at least 4 characters).');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const result = await performRfidRedeem(value);
        if (result.mustResetPassword) {
          router.replace('/(auth)/change-password');
        } else {
          router.replace(result.route.href as never);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'RFID login failed');
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  async function onScanNfc() {
    setError(null);
    setLoading(true);
    try {
      const uid = await tryReadNfcUid();
      if (!uid) {
        setError('Could not read an NFC/RFID tag. Enter the Card UID manually.');
        setLoading(false);
        return;
      }
      setCardUid(uid);
      await completeLogin(uid);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'NFC read failed');
      setLoading(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient colors={[...authTheme.gradient]} style={styles.header}>
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 20 }}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>RFID Login</Text>
          <Text style={styles.subtitle}>
            Use a college RFID card at a desk reader, or enter the Card UID for testing.
          </Text>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        {checking ? (
          <ActivityIndicator color={colors.primary} />
        ) : !allowed ? (
          <Text style={{ color: colors.textMuted, lineHeight: 20 }}>
            RFID login is not enabled for this institution. Ask an administrator to turn on RFID
            login in tenant security settings.
          </Text>
        ) : (
          <>
            {nfcAvailable ? (
              <Pressable
                style={[styles.btn, loading && { opacity: 0.7 }]}
                disabled={loading}
                onPress={() => void onScanNfc()}
              >
                <Text style={styles.btnText}>Read NFC / RFID tag</Text>
              </Pressable>
            ) : (
              <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
                Native NFC is not installed on this build. Enter the Card UID manually below.
              </Text>
            )}

            <Text style={[styles.label, { color: colors.text }]}>Card UID</Text>
            <TextInput
              value={cardUid}
              onChangeText={setCardUid}
              placeholder="e.g. A1B2C3D4"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: scheme === 'dark' ? '#1e293b' : '#fff',
                },
              ]}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.btn, styles.btnSecondary, loading && { opacity: 0.7 }]}
              disabled={loading}
              onPress={() => void completeLogin(cardUid)}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Sign in with Card UID</Text>
              )}
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  back: { color: '#fff', fontWeight: '600', marginBottom: 12 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.85)', marginTop: 8, lineHeight: 20 },
  body: { padding: 20, gap: 12 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    letterSpacing: 1,
  },
  error: { color: '#dc2626', fontSize: 13 },
  btn: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnSecondary: { backgroundColor: '#1d4ed8' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
