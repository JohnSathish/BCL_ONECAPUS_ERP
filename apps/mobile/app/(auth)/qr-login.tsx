import { useCallback, useEffect, useRef, useState } from 'react';
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
import { CameraView, useCameraPermissions } from 'expo-camera';
import { performQrRedeem } from '@/auth/login-flow';
import { authColors, authTheme } from '@/components/auth/auth-theme';

function extractTokenFromScan(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as { token?: string };
      if (typeof parsed.token === 'string') return parsed.token.trim();
    } catch {
      /* fall through */
    }
  }
  return trimmed;
}

export default function QrLoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = authColors(scheme);
  const [permission, requestPermission] = useCameraPermissions();
  const [manualToken, setManualToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useCamera, setUseCamera] = useState(true);
  const redeeming = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  const completeLogin = useCallback(
    async (raw: string) => {
      const token = extractTokenFromScan(raw);
      if (token.length < 16) {
        setError('Paste or scan a valid login QR code.');
        return;
      }
      if (redeeming.current || loading) return;
      redeeming.current = true;
      setLoading(true);
      setError(null);
      try {
        const result = await performQrRedeem(token);
        if (result.mustResetPassword) {
          router.replace('/(auth)/change-password');
        } else {
          router.replace(result.route.href as never);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'QR login failed');
        redeeming.current = false;
      } finally {
        setLoading(false);
      }
    },
    [loading, router],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient colors={[...authTheme.gradient]} style={styles.header}>
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 20 }}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>Scan Student QR</Text>
          <Text style={styles.subtitle}>
            Point the camera at the login QR from the student web portal, or paste the one-time
            code.
          </Text>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        {useCamera && permission?.granted ? (
          <View style={styles.cameraWrap}>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => {
                if (!redeeming.current) void completeLogin(data);
              }}
            />
            <View style={styles.scanFrame} />
          </View>
        ) : (
          <View style={[styles.cameraFallback, { borderColor: colors.border }]}>
            <Text style={{ color: colors.textMuted, textAlign: 'center' }}>
              {!permission?.granted
                ? 'Camera permission is required to scan. You can still paste a code below.'
                : 'Camera preview paused.'}
            </Text>
            {!permission?.granted ? (
              <Pressable style={styles.secondaryBtn} onPress={() => void requestPermission()}>
                <Text style={styles.secondaryBtnText}>Allow camera</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        <Pressable onPress={() => setUseCamera((v) => !v)}>
          <Text style={[styles.toggle, { color: colors.primary }]}>
            {useCamera ? 'Hide camera / paste only' : 'Show camera scanner'}
          </Text>
        </Pressable>

        <Text style={[styles.label, { color: colors.text }]}>Or paste QR token</Text>
        <TextInput
          value={manualToken}
          onChangeText={setManualToken}
          placeholder="Paste one-time login code"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
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
          style={[styles.btn, loading && { opacity: 0.7 }]}
          disabled={loading}
          onPress={() => void completeLogin(manualToken)}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Sign in with QR</Text>
          )}
        </Pressable>
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
  body: { padding: 20, gap: 12, flex: 1 },
  cameraWrap: {
    height: 260,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
  },
  cameraFallback: {
    height: 160,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 12,
  },
  scanFrame: {
    position: 'absolute',
    top: '20%',
    left: '15%',
    right: '15%',
    bottom: '20%',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    borderRadius: 12,
  },
  toggle: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  input: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  error: { color: '#dc2626', fontSize: 13 },
  btn: {
    marginTop: 8,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  secondaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
