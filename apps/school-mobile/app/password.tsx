import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { changePassword, passwordStrength } from '@/auth/account';
import { confirmLogout } from '@/auth/logout';
import { getUser } from '@/auth/session';
import { Loader, NavyButton, Screen } from '@/ui/kit';
import { colors, radii, space } from '@/theme/tokens';

const MIN_LENGTH = 8;

function Field({
  value,
  onChange,
  placeholder,
  visible,
  onToggle,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.passwordWrap}>
      <TextInput
        placeholder={placeholder}
        secureTextEntry={!visible}
        value={value}
        onChangeText={onChange}
        style={styles.passwordInput}
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable
        onPress={onToggle}
        style={styles.eye}
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
      >
        <Text style={styles.eyeText}>{visible ? 'Hide' : 'Show'}</Text>
      </Pressable>
    </View>
  );
}

export default function PasswordScreen() {
  const router = useRouter();
  const [required, setRequired] = useState(false);
  const [ready, setReady] = useState(false);
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const strength = passwordStrength(newPassword);

  useEffect(() => {
    void getUser()
      .then((user) => {
        setRequired(Boolean(user?.mustResetPassword));
      })
      .finally(() => setReady(true));
  }, []);

  const submit = async () => {
    if (!currentPassword.trim()) {
      setError('Enter your current password.');
      return;
    }
    if (newPassword.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (newPassword === currentPassword) {
      setError('Choose a different password from the current one.');
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

  if (!ready) {
    return (
      <Screen title="Change Password" light>
        <Loader />
      </Screen>
    );
  }

  return (
    <Screen title="Change Password" onBack={!required} light insetBottom>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.box} keyboardShouldPersistTaps="handled">
          <Text style={styles.lead}>
            {required
              ? 'This account is using a temporary password. Set a new password before opening the dashboard.'
              : 'Enter your current password, then choose a new personal password.'}
          </Text>
          <Text style={styles.label}>Current Password</Text>
          <Field
            value={currentPassword}
            onChange={setCurrent}
            placeholder="Current password"
            visible={showCurrent}
            onToggle={() => setShowCurrent((v) => !v)}
          />
          <Text style={styles.label}>New Password</Text>
          <Field
            value={newPassword}
            onChange={setNew}
            placeholder="New password"
            visible={showNew}
            onToggle={() => setShowNew((v) => !v)}
          />
          {newPassword ? (
            <View>
              <Text style={styles.strength}>Strength: {strength.label}</Text>
              <View style={styles.meter}>
                {[0, 1, 2, 3].map((step) => (
                  <View
                    key={step}
                    style={[
                      styles.meterBar,
                      strength.score > step && styles.meterOn,
                      strength.score > 2 && strength.score > step && styles.meterGood,
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.hint}>
                Use at least {MIN_LENGTH} characters. Mix letters, numbers, and a symbol for a
                stronger password.
              </Text>
            </View>
          ) : null}
          <Text style={styles.label}>Confirm New Password</Text>
          <Field
            value={confirm}
            onChange={setConfirm}
            placeholder="Confirm new password"
            visible={showConfirm}
            onToggle={() => setShowConfirm((v) => !v)}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {ok ? <Text style={styles.ok}>Password updated successfully.</Text> : null}
          {!ok ? (
            <NavyButton
              label={busy ? 'Saving…' : 'Change Password'}
              onPress={() => void submit()}
              disabled={busy}
            />
          ) : (
            <NavyButton
              label={required ? 'Continue to Dashboard' : 'Done'}
              onPress={() => (required ? router.replace('/home') : router.back())}
            />
          )}
          {required && !ok ? (
            <Pressable onPress={() => confirmLogout(() => router.replace('/login'))}>
              <Text style={styles.signOut}>Sign out</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  box: { padding: space.lg, gap: 12, paddingBottom: 40 },
  lead: { color: colors.muted, lineHeight: 20 },
  label: { fontWeight: '700', color: colors.navy, fontSize: 13, marginTop: 4 },
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
  eye: { paddingHorizontal: 8, height: 36, alignItems: 'center', justifyContent: 'center' },
  eyeText: { color: colors.navy, fontWeight: '800', fontSize: 12 },
  strength: { fontWeight: '700', color: colors.navy },
  meter: { flexDirection: 'row', gap: 6, marginTop: 6 },
  meterBar: {
    flex: 1,
    height: 6,
    borderRadius: 99,
    backgroundColor: '#e2e8f0',
  },
  meterOn: { backgroundColor: '#f59e0b' },
  meterGood: { backgroundColor: '#16a34a' },
  hint: { color: colors.muted, fontSize: 12, marginTop: 6, lineHeight: 18 },
  error: { color: colors.danger, fontWeight: '700' },
  ok: { color: colors.green, fontWeight: '700' },
  signOut: { textAlign: 'center', color: colors.danger, fontWeight: '800', padding: 8 },
});
