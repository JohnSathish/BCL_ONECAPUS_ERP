import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { biometricCapability, enableBiometricLogin } from '@/auth/biometric';
import { setBiometricPrompted } from '@/auth/session';
import { NavyButton, Screen } from '@/ui/kit';
import { colors, space } from '@/theme/tokens';

export default function BiometricSetupScreen() {
  const router = useRouter();
  const [label, setLabel] = useState('fingerprint or Face ID');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void biometricCapability().then((cap) => {
      if (!cap.available) {
        void setBiometricPrompted(true);
        router.replace('/(tabs)');
        return;
      }
      setLabel(cap.label.replace('Unlock with ', ''));
    });
  }, [router]);

  const skip = async () => {
    await setBiometricPrompted(true);
    router.replace('/(tabs)');
  };

  const enable = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await enableBiometricLogin();
      await setBiometricPrompted(true);
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not enable biometric login.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Enable Biometric Login?" light>
      <View style={styles.box}>
        <Text style={styles.lead}>
          Use your fingerprint or Face ID to quickly access your school account. Your password is
          never stored on this device.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <NavyButton
          label={busy ? 'Please wait…' : 'Enable'}
          onPress={() => void enable()}
          disabled={busy}
        />
        <Pressable onPress={() => void skip()}>
          <Text style={styles.skip}>Not Now</Text>
        </Pressable>
        <Text style={styles.hint}>You can turn this on later in Settings → Security.</Text>
        <Text style={styles.hint}>Suggested method: {label}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: { padding: space.lg, gap: 14, paddingTop: 24 },
  lead: { color: colors.muted, fontSize: 16, lineHeight: 22 },
  error: { color: colors.danger },
  skip: { textAlign: 'center', color: colors.navy, fontWeight: '800', padding: 12 },
  hint: { textAlign: 'center', color: colors.muted, fontSize: 12 },
});
