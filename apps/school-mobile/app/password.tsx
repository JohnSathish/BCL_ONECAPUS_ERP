import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { changePassword, passwordStrength } from '@/auth/account';
import { NavyButton, Screen } from '@/ui/kit';
import { colors, radii, space } from '@/theme/tokens';

export default function PasswordScreen() {
  const router = useRouter();
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const strength = passwordStrength(newPassword);

  const submit = async () => {
    if (newPassword.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (newPassword !== confirm) {
      setError('New password and confirmation do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await changePassword(currentPassword, newPassword);
      setOk(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Change Password" onBack light>
      <View style={styles.box}>
        <Text style={styles.lead}>
          Enter your current password, then choose a new personal password.
        </Text>
        <View style={styles.passwordWrap}>
          <TextInput
            placeholder="Current password"
            secureTextEntry={!show}
            value={currentPassword}
            onChangeText={setCurrent}
            style={styles.passwordInput}
            placeholderTextColor={colors.muted}
          />
          <Pressable onPress={() => setShow((v) => !v)} style={styles.eye}>
            <Text>👁</Text>
          </Pressable>
        </View>
        <View style={styles.passwordWrap}>
          <TextInput
            placeholder="New password"
            secureTextEntry={!show}
            value={newPassword}
            onChangeText={setNew}
            style={styles.passwordInput}
            placeholderTextColor={colors.muted}
          />
        </View>
        {newPassword ? <Text style={styles.strength}>Strength: {strength.label}</Text> : null}
        <View style={styles.passwordWrap}>
          <TextInput
            placeholder="Confirm password"
            secureTextEntry={!show}
            value={confirm}
            onChangeText={setConfirm}
            style={styles.passwordInput}
            placeholderTextColor={colors.muted}
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {ok ? <Text style={styles.ok}>Password changed successfully.</Text> : null}
        <NavyButton
          label={busy ? 'Saving…' : 'Save password'}
          onPress={() => void submit()}
          disabled={busy}
        />
        {ok ? <NavyButton label="Back to Security" onPress={() => router.back()} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: { padding: space.lg, gap: 12 },
  lead: { color: colors.muted, lineHeight: 20 },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f5fb',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingRight: 8,
  },
  passwordInput: { flex: 1, height: 50, paddingHorizontal: 14, color: colors.ink },
  eye: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  strength: { fontWeight: '700', color: colors.navy },
  error: { color: colors.danger },
  ok: { color: colors.green, fontWeight: '700' },
});
