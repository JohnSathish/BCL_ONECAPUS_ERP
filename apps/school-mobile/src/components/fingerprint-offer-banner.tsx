import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { CREST } from '@/brand';
import {
  biometricFailMessage,
  declineBiometricOffer,
  enableBiometricLogin,
  shouldOfferBiometricSetup,
  skipBiometricOfferThisSession,
} from '@/auth/biometric';
import { colors, radii, space } from '@/theme/tokens';

type Phase = 'hidden' | 'ask' | 'waiting' | 'success' | 'notice';

/**
 * Keep this component mounted while BiometricPrompt runs.
 * During the scan, hide the bottom card so it does not cover an in-display sensor.
 */
export function FingerprintOfferBanner() {
  const [phase, setPhase] = useState<Phase>('hidden');
  const [notice, setNotice] = useState<string | null>(null);
  const registering = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      void shouldOfferBiometricSetup()
        .then((offer) => {
          if (alive && offer) setPhase('ask');
        })
        .catch(() => undefined);
    }, 1600);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  const hide = () => {
    skipBiometricOfferThisSession();
    setPhase('hidden');
    setNotice(null);
  };

  const closeSoon = (ms: number) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(hide, ms);
  };

  const notNow = async () => {
    await declineBiometricOffer();
    hide();
  };

  const register = async () => {
    if (registering.current) return;
    registering.current = true;
    setNotice(null);
    setPhase('waiting');
    try {
      const result = await enableBiometricLogin();
      if (result.ok) {
        setPhase('success');
        closeSoon(1400);
        return;
      }
      const message = biometricFailMessage(result.reason);
      if (!message) {
        setPhase('ask');
        return;
      }
      setNotice(message);
      setPhase('notice');
    } catch {
      setNotice('Could not read the fingerprint. Try again.');
      setPhase('notice');
    } finally {
      registering.current = false;
    }
  };

  if (phase === 'hidden') return null;

  if (phase === 'waiting') {
    return (
      <View pointerEvents="none" style={styles.topHintWrap}>
        <View style={styles.topHint}>
          <Text style={styles.topHintText}>Touch the fingerprint sensor</Text>
        </View>
      </View>
    );
  }

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={styles.card}>
        <Image source={CREST} style={styles.crest} resizeMode="contain" />
        {phase === 'success' ? (
          <Text style={styles.success}>Fingerprint Login Enabled ✓</Text>
        ) : (
          <>
            <Text style={styles.title}>Enable Fingerprint Login?</Text>
            <Text style={styles.body}>
              Optional. Use your fingerprint next time, or skip and keep using your password.
            </Text>
            {notice ? <Text style={styles.error}>{notice}</Text> : null}
            <View style={styles.actions}>
              <Pressable onPress={() => void notNow()} style={styles.secondary}>
                <Text style={styles.secondaryText}>Not Now</Text>
              </Pressable>
              <Pressable onPress={() => void register()} style={styles.primary}>
                <Text style={styles.primaryText}>
                  {phase === 'notice' ? 'Try Again' : 'Enable'}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 72,
    paddingHorizontal: space.md,
    zIndex: 50,
  },
  topHintWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 12,
    paddingHorizontal: space.md,
    zIndex: 50,
  },
  topHint: {
    alignSelf: 'center',
    backgroundColor: colors.navy,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  topHintText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: radii.lg,
    padding: space.md,
    alignItems: 'center',
    shadowColor: '#0b1048',
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  crest: { width: 40, height: 40, marginBottom: 8 },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.navy,
    textAlign: 'center',
    marginBottom: 6,
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: 12,
  },
  success: { fontSize: 16, fontWeight: '800', color: colors.green, textAlign: 'center' },
  error: { color: colors.danger, textAlign: 'center', marginBottom: 8, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 10, width: '100%' },
  secondary: {
    flex: 1,
    borderRadius: radii.pill,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#eef1f8',
  },
  secondaryText: { color: colors.navy, fontWeight: '800' },
  primary: {
    flex: 1,
    borderRadius: radii.pill,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.navy,
  },
  primaryText: { color: '#fff', fontWeight: '800' },
});
