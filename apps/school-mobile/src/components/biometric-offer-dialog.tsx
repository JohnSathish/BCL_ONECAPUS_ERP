import { useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { CREST } from '@/brand';
import {
  biometricFailMessage,
  declineBiometricOffer,
  enableBiometricLogin,
  shouldOfferBiometricSetup,
  skipBiometricOfferThisSession,
} from '@/auth/biometric';
import { colors, radii, space } from '@/theme/tokens';

type Phase = 'hidden' | 'ask' | 'success' | 'notice';

export function BiometricOfferDialog() {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const [phase, setPhase] = useState<Phase>('hidden');
  const [notice, setNotice] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const registering = useRef(false);

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
    }, 450);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  const close = () => {
    skipBiometricOfferThisSession();
    setPhase('hidden');
    setNotice(null);
  };

  const closeSoon = (ms: number) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(close, ms);
  };

  const notNow = async () => {
    await declineBiometricOffer();
    close();
  };

  const register = async () => {
    if (registering.current) return;
    registering.current = true;
    skipBiometricOfferThisSession();
    setPhase('hidden');
    setNotice(null);
    try {
      const result = await enableBiometricLogin();
      if (result.ok) {
        setPhase('success');
        closeSoon(1100);
        return;
      }
      const message = biometricFailMessage(result.reason);
      if (!message) return;
      setNotice(message);
      setPhase('notice');
      closeSoon(1600);
    } catch {
      setNotice('Could not verify fingerprint. You can use your password.');
      setPhase('notice');
      closeSoon(1600);
    } finally {
      registering.current = false;
    }
  };

  if (phase === 'hidden') return null;

  const cardBg = dark ? '#161c2c' : '#ffffff';
  const titleColor = dark ? '#f4f6fb' : colors.navy;
  const bodyColor = dark ? '#b8c0d0' : colors.muted;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => void notNow()}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Image source={CREST} style={styles.crest} resizeMode="contain" />
          <View style={styles.iconWrap}>
            <Text style={styles.iconMark}>◉</Text>
          </View>
          {phase === 'success' ? (
            <>
              <Text style={[styles.title, { color: colors.green }]}>
                Fingerprint Login Enabled ✓
              </Text>
              <Text style={[styles.body, { color: bodyColor }]}>
                You stay signed in. Fingerprint is only used if the app needs to confirm it is you.
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.title, { color: titleColor }]}>Enable Fingerprint Login?</Text>
              <Text style={[styles.body, { color: bodyColor }]}>
                You can use your fingerprint to sign in quickly next time. Your password is never
                stored on this device.
              </Text>
              {notice ? <Text style={styles.error}>{notice}</Text> : null}
              {phase === 'ask' ? (
                <View style={styles.actions}>
                  <Pressable onPress={() => void notNow()} style={styles.secondary} hitSlop={8}>
                    <Text style={styles.secondaryText}>Not Now</Text>
                  </Pressable>
                  <Pressable onPress={() => void register()} style={styles.primary}>
                    <Text style={styles.primaryText}>Register Fingerprint</Text>
                  </Pressable>
                </View>
              ) : null}
              {phase === 'ask' ? (
                <Text style={styles.hint}>You can turn this on later in Settings → Security.</Text>
              ) : null}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radii.lg,
    padding: space.lg,
    alignItems: 'center',
    shadowColor: '#0b1048',
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  crest: { width: 56, height: 56, marginBottom: 8 },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#eef1fb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  iconMark: { fontSize: 22, color: colors.navy, fontWeight: '800' },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  error: {
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 12,
    fontSize: 13,
  },
  actions: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  secondary: {
    flex: 1,
    borderRadius: radii.pill,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#eef1f8',
  },
  secondaryText: { color: colors.navy, fontWeight: '800', fontSize: 14 },
  primary: {
    flex: 1.35,
    borderRadius: radii.pill,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.navy,
  },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  hint: { marginTop: 12, color: colors.muted, fontSize: 11, textAlign: 'center' },
});
