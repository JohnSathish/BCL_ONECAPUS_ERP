import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { changePassword } from '@/auth/login';
import { NavyButton, Screen } from '@/ui/kit';
import { colors, radii, space } from '@/theme/tokens';

export default function PasswordScreen() {
  const router = useRouter();
  const [currentPassword, setCurrent] = useState('StLuke@123');
  const [newPassword, setNew] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Update password" light>
      <View style={styles.box}>
        <Text style={styles.lead}>
          You signed in with the school default password. Set a personal password now. You will stay
          signed in after this.
        </Text>
        <TextInput
          placeholder="Current password"
          secureTextEntry
          value={currentPassword}
          onChangeText={setCurrent}
          style={styles.input}
          placeholderTextColor={colors.muted}
        />
        <TextInput
          placeholder="New password"
          secureTextEntry
          value={newPassword}
          onChangeText={setNew}
          style={styles.input}
          placeholderTextColor={colors.muted}
        />
        <TextInput
          placeholder="Confirm new password"
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
          style={styles.input}
          placeholderTextColor={colors.muted}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <NavyButton label={busy ? 'Saving…' : 'Save and continue'} onPress={() => void submit()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: { padding: space.lg, gap: 12 },
  lead: { color: colors.muted, lineHeight: 20 },
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
});
