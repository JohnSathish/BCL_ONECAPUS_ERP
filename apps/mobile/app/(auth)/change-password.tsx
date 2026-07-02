import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { logout } from '@/auth/logout';
import { AuthTextField } from '@/components/auth/auth-text-field';
import { authColors, authTheme } from '@/components/auth/auth-theme';
import { changePassword } from '@/services/auth-account';
import {
  DEFAULT_PASSWORD_POLICY,
  evaluatePasswordPolicy,
  passwordPolicySummary,
} from '@/utils/password-policy';

const STRENGTH_COLORS = {
  weak: '#ef4444',
  fair: '#f59e0b',
  good: '#2563eb',
  strong: '#16a34a',
} as const;

function PolicyCheckRow({
  label,
  passed,
  active,
  muted,
}: {
  label: string;
  passed: boolean;
  active: boolean;
  muted: string;
}) {
  const icon = !active ? '○' : passed ? '✓' : '✕';
  const color = !active ? muted : passed ? '#16a34a' : '#ef4444';

  return (
    <View style={styles.checkRow}>
      <Text style={[styles.checkIcon, { color }]}>{icon}</Text>
      <Text style={[styles.checkLabel, { color: active ? '#334155' : muted }]}>{label}</Text>
    </View>
  );
}

export default function ChangePasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = authColors(scheme);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const policy = useMemo(() => evaluatePasswordPolicy(newPassword), [newPassword]);
  const passwordsMatch =
    confirmPassword.length > 0 && newPassword.length > 0 && newPassword === confirmPassword;
  const showMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const canSubmit =
    currentPassword.length > 0 &&
    policy.isValid &&
    passwordsMatch &&
    newPassword !== currentPassword &&
    !loading;

  async function onSubmit() {
    setFormError(null);

    if (!currentPassword.trim()) {
      setFormError('Enter your current password.');
      return;
    }
    if (!policy.isValid) {
      setFormError(policy.firstError ?? 'New password does not meet the password policy.');
      return;
    }
    if (!passwordsMatch) {
      setFormError('New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setFormError('New password must be different from your current password.');
      return;
    }

    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      await logout();
      Alert.alert(
        'Password updated',
        'Your password has been changed. Sign in again with your new password.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }],
      );
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not update password. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[...authTheme.gradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <Text style={styles.headerTitle}>Change Password</Text>
        <Text style={styles.headerLead}>
          Your account requires a new password before you can use OneCampus.
        </Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Account security</Text>
          <Text style={[styles.sectionLead, { color: colors.textMuted }]}>
            Choose a strong password you have not used on this account before.
          </Text>

          <AuthTextField
            scheme={scheme}
            label="Current password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Enter current password"
            secureTextEntry
            showToggle
            showPassword={showCurrent}
            onTogglePassword={() => setShowCurrent((value) => !value)}
          />

          <AuthTextField
            scheme={scheme}
            label="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Create a strong password"
            secureTextEntry
            showToggle
            showPassword={showNew}
            onTogglePassword={() => setShowNew((value) => !value)}
          />

          {newPassword.length > 0 ? (
            <View style={styles.strengthBlock}>
              <View style={styles.strengthHeader}>
                <Text style={[styles.strengthLabel, { color: colors.textMuted }]}>
                  Password strength
                </Text>
                <Text style={[styles.strengthValue, { color: STRENGTH_COLORS[policy.strength] }]}>
                  {policy.strength.charAt(0).toUpperCase() + policy.strength.slice(1)}
                </Text>
              </View>
              <View style={[styles.strengthTrack, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.strengthFill,
                    {
                      width: `${policy.strengthScore}%`,
                      backgroundColor: STRENGTH_COLORS[policy.strength],
                    },
                  ]}
                />
              </View>
            </View>
          ) : null}

          <AuthTextField
            scheme={scheme}
            label="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter new password"
            secureTextEntry
            showToggle
            showPassword={showConfirm}
            onTogglePassword={() => setShowConfirm((value) => !value)}
          />

          {showMismatch ? (
            <Text style={styles.inlineError}>Passwords do not match.</Text>
          ) : passwordsMatch ? (
            <Text style={styles.inlineSuccess}>Passwords match.</Text>
          ) : null}

          {newPassword.length > 0 && newPassword === currentPassword ? (
            <Text style={styles.inlineError}>
              New password must be different from your current password.
            </Text>
          ) : null}
        </View>

        <View style={[styles.policyCard, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
          <Text style={styles.policyTitle}>Password policy</Text>
          <Text style={styles.policySummary}>{passwordPolicySummary()}</Text>
          <View style={styles.checkList}>
            {policy.checks.map((check) => (
              <PolicyCheckRow
                key={check.id}
                label={check.label}
                passed={check.passed}
                active={newPassword.length > 0}
                muted={colors.textMuted}
              />
            ))}
            <PolicyCheckRow
              label={`Not one of your last ${DEFAULT_PASSWORD_POLICY.historyCount} passwords`}
              passed={true}
              active={false}
              muted={colors.textMuted}
            />
          </View>
          <Text style={styles.policyNote}>
            After updating, you will be signed out on this device and must sign in again with your
            new password.
          </Text>
        </View>

        {formError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{formError}</Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.btn, { backgroundColor: canSubmit ? authTheme.primaryLight : '#94a3b8' }]}
          onPress={() => void onSubmit()}
          disabled={!canSubmit}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Update Password</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 22,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
  },
  headerLead: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.88)',
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 14,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  sectionLead: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: -6,
  },
  strengthBlock: { gap: 6 },
  strengthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  strengthLabel: { fontSize: 12, fontWeight: '600' },
  strengthValue: { fontSize: 12, fontWeight: '700' },
  strengthTrack: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
    borderRadius: 999,
  },
  policyCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  policyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e3a8a',
  },
  policySummary: {
    fontSize: 13,
    lineHeight: 19,
    color: '#1e40af',
  },
  checkList: { gap: 6 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkIcon: {
    width: 16,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  checkLabel: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  policyNote: {
    fontSize: 12,
    lineHeight: 18,
    color: '#475569',
    marginTop: 2,
  },
  inlineError: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '600',
    marginTop: -6,
  },
  inlineSuccess: {
    fontSize: 12,
    color: '#16a34a',
    fontWeight: '600',
    marginTop: -6,
  },
  errorBanner: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorBannerText: {
    color: '#b91c1c',
    fontSize: 13,
    lineHeight: 18,
  },
  btn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
