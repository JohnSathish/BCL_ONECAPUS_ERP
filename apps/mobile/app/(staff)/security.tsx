import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FacultyScreenShell } from '@/components/faculty-portal/faculty-screen-shell';
import { facultyTheme } from '@/components/faculty-portal/theme';
import { DeviceSessionsPanel } from '@/components/auth/device-sessions-panel';
import { AuthTextField } from '@/components/auth/auth-text-field';
import { logout } from '@/auth/logout';
import { changePassword } from '@/services/auth-account';
import { DEFAULT_PASSWORD_POLICY, evaluatePasswordPolicy } from '@/utils/password-policy';

const STRENGTH_COLORS = {
  weak: '#ef4444',
  fair: '#f59e0b',
  good: '#2563eb',
  strong: '#16a34a',
} as const;

const TIPS = [
  'Never share your password.',
  'Change password every 90 days.',
  'Use a unique password.',
  'Enable 2FA when available.',
  'Log out from shared computers.',
] as const;

function deviceSummary() {
  const os = Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Device';
  return { os, browser: 'Mobile App', label: `${os} · Mobile App` };
}

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: 'strong' | 'warn' | 'danger' | 'neutral';
}) {
  const bg =
    tone === 'strong'
      ? '#dcfce7'
      : tone === 'warn'
        ? '#fef3c7'
        : tone === 'danger'
          ? '#fee2e2'
          : '#f3f4f6';
  const color =
    tone === 'strong'
      ? '#15803d'
      : tone === 'warn'
        ? '#b45309'
        : tone === 'danger'
          ? '#b91c1c'
          : facultyTheme.textMuted;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function StatusRow({
  label,
  badge,
  tone,
  hint,
}: {
  label: string;
  badge: string;
  tone: 'strong' | 'warn' | 'danger' | 'neutral';
  hint?: string;
}) {
  return (
    <View style={styles.statusRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.statusLabel}>{label}</Text>
        {hint ? <Text style={styles.statusHint}>{hint}</Text> : null}
      </View>
      <StatusBadge label={badge} tone={tone} />
    </View>
  );
}

function CheckRow({ label, passed, active }: { label: string; passed: boolean; active: boolean }) {
  const color = !active ? facultyTheme.textSubtle : passed ? '#16a34a' : facultyTheme.textMuted;
  return (
    <View style={styles.checkRow}>
      <Text style={[styles.checkIcon, { color }]}>{!active ? '○' : passed ? '✓' : '·'}</Text>
      <Text style={[styles.checkLabel, { color: active && passed ? '#15803d' : color }]}>
        {label}
      </Text>
    </View>
  );
}

export default function FacultySecurityScreen() {
  const router = useRouter();
  const device = useMemo(() => deviceSummary(), []);
  const nowLabel = useMemo(
    () =>
      new Date().toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      }),
    [],
  );

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
    setSuccess(false);
    if (!canSubmit) return;
    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      await logout();
      setSuccess(true);
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
    <FacultyScreenShell
      title="Password & Security"
      subtitle="Protect your account"
      showMenu={false}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>🛡️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Password & Security</Text>
            <Text style={styles.heroLead}>
              Protect your account by using a strong password and keeping your account secure.
            </Text>
          </View>
        </View>

        {/* Change password */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardIcon}>🔐</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Change Password</Text>
              <Text style={styles.cardLead}>
                Keep your account secure by updating your password regularly.
              </Text>
            </View>
          </View>

          <AuthTextField
            scheme="light"
            label="Current password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Enter current password"
            secureTextEntry
            showToggle
            showPassword={showCurrent}
            onTogglePassword={() => setShowCurrent((v) => !v)}
          />
          <AuthTextField
            scheme="light"
            label="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Create a strong password"
            secureTextEntry
            showToggle
            showPassword={showNew}
            onTogglePassword={() => setShowNew((v) => !v)}
          />

          {newPassword.length > 0 ? (
            <View style={styles.strengthBlock}>
              <View style={styles.strengthHeader}>
                <Text style={styles.strengthLabel}>Password strength</Text>
                <Text style={[styles.strengthValue, { color: STRENGTH_COLORS[policy.strength] }]}>
                  {policy.strength.charAt(0).toUpperCase() + policy.strength.slice(1)}
                </Text>
              </View>
              <View style={styles.strengthTrack}>
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
              <View style={styles.checkList}>
                {policy.checks.map((check) => (
                  <CheckRow
                    key={check.id}
                    label={check.label}
                    passed={check.passed}
                    active={newPassword.length > 0}
                  />
                ))}
                <CheckRow
                  label={`Not one of your last ${DEFAULT_PASSWORD_POLICY.historyCount} passwords`}
                  passed={true}
                  active={false}
                />
              </View>
            </View>
          ) : null}

          <AuthTextField
            scheme="light"
            label="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter new password"
            secureTextEntry
            showToggle
            showPassword={showConfirm}
            onTogglePassword={() => setShowConfirm((v) => !v)}
          />

          {showMismatch ? (
            <Text style={styles.inlineError}>Passwords do not match.</Text>
          ) : passwordsMatch ? (
            <Text style={styles.inlineSuccess}>✓ Passwords match</Text>
          ) : null}

          {newPassword.length > 0 && newPassword === currentPassword ? (
            <Text style={styles.inlineError}>
              New password must be different from your current password.
            </Text>
          ) : null}

          {formError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{formError}</Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled]}
            onPress={() => void onSubmit()}
            disabled={!canSubmit}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {success ? '✓ Updated' : '🛡 Update Password'}
              </Text>
            )}
          </Pressable>
          <Text style={styles.footnote}>
            After updating, you will be signed out on this device and must sign in again.
          </Text>
        </View>

        {/* Security status */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardIcon}>🛡</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Security Status</Text>
              <Text style={styles.cardLead}>Account security overview</Text>
            </View>
          </View>
          <StatusRow label="Account Security" badge="Strong" tone="strong" />
          <StatusRow
            label="Password Updated"
            badge="Keep current"
            tone="warn"
            hint="Change every 90 days"
          />
          <StatusRow label="Two-Factor Authentication" badge="Not Enabled" tone="warn" />
          <StatusRow label="Last Login" badge="Today" tone="strong" hint={nowLabel} />
          <StatusRow label="Trusted Device" badge={device.label} tone="neutral" />
        </View>

        {/* 2FA */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardIcon}>🔒</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Two-Factor Authentication</Text>
              <Text style={styles.cardLead}>
                Protect your account with an additional layer of security.
              </Text>
            </View>
          </View>
          <View style={styles.twoFaRow}>
            <StatusBadge label="Coming Soon" tone="warn" />
            <Text style={styles.twoFaNote}>Available in a future release</Text>
          </View>
          <View style={styles.tileRow}>
            {['📱 SMS', '📲 App', '🛡 Shield'].map((t) => (
              <View key={t} style={styles.emptyTile}>
                <Text style={styles.emptyTileText}>{t}</Text>
              </View>
            ))}
          </View>
          <Pressable style={[styles.secondaryBtn, styles.secondaryBtnDisabled]} disabled>
            <Text style={styles.secondaryBtnText}>Enable 2FA</Text>
          </Pressable>
        </View>

        {/* Login activity */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardIcon}>📲</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Recent Login Activity</Text>
              <Text style={styles.cardLead}>
                Showing your current session. Full history coming soon.
              </Text>
            </View>
          </View>
          <View style={styles.loginRow}>
            <View style={styles.loginIcon}>
              <Text>📱</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.loginTitleRow}>
                <Text style={styles.loginTitle}>{device.browser}</Text>
                <StatusBadge label="Current Session" tone="strong" />
              </View>
              <Text style={styles.loginMeta}>
                Today · {device.os} · {nowLabel}
              </Text>
            </View>
          </View>
          <Text style={styles.placeholderNote}>
            Additional login history will appear here when available.
          </Text>
        </View>

        {/* Sessions */}
        <DeviceSessionsPanel
          title="Active Sessions"
          surfaceColor={facultyTheme.surface}
          borderColor={facultyTheme.border}
          textColor={facultyTheme.text}
          mutedColor={facultyTheme.textMuted}
        />

        {/* Tips */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardIcon}>💡</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Security Tips</Text>
              <Text style={styles.cardLead}>Best practices for your account</Text>
            </View>
          </View>
          {TIPS.map((tip) => (
            <View key={tip} style={styles.tipRow}>
              <View style={styles.tipCheckWrap}>
                <Text style={styles.tipCheck}>✓</Text>
              </View>
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </FacultyScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14, paddingBottom: 40 },
  hero: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: '#eff6ff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    padding: 16,
  },
  heroEmoji: { fontSize: 28, marginTop: 2 },
  heroTitle: { fontSize: 17, fontWeight: '800', color: facultyTheme.text },
  heroLead: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: facultyTheme.textMuted,
  },
  card: {
    backgroundColor: facultyTheme.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: facultyTheme.border,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  cardHead: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  cardIcon: { fontSize: 22, marginTop: 1 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: facultyTheme.text },
  cardLead: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
    color: facultyTheme.textMuted,
  },
  strengthBlock: { gap: 8 },
  strengthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  strengthLabel: { fontSize: 12, fontWeight: '600', color: facultyTheme.textMuted },
  strengthValue: { fontSize: 12, fontWeight: '800' },
  strengthTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: facultyTheme.border,
    overflow: 'hidden',
  },
  strengthFill: { height: '100%', borderRadius: 999 },
  checkList: { gap: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkIcon: { width: 16, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  checkLabel: { flex: 1, fontSize: 12, lineHeight: 17 },
  inlineError: { fontSize: 12, color: '#dc2626', fontWeight: '600' },
  inlineSuccess: { fontSize: 12, color: '#16a34a', fontWeight: '700' },
  errorBanner: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorBannerText: { color: '#b91c1c', fontSize: 13, lineHeight: 18 },
  primaryBtn: {
    backgroundColor: facultyTheme.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnDisabled: { backgroundColor: '#94a3b8' },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  footnote: { fontSize: 11, lineHeight: 16, color: facultyTheme.textMuted },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: facultyTheme.border,
  },
  statusLabel: { fontSize: 12, fontWeight: '600', color: facultyTheme.textMuted },
  statusHint: { marginTop: 2, fontSize: 11, color: facultyTheme.textSubtle },
  badge: {
    maxWidth: '52%',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  twoFaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  twoFaNote: { fontSize: 12, color: facultyTheme.textMuted },
  tileRow: { flexDirection: 'row', gap: 8 },
  emptyTile: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: facultyTheme.border,
    backgroundColor: '#f9fafb',
    paddingVertical: 12,
    alignItems: 'center',
  },
  emptyTileText: { fontSize: 11, fontWeight: '600', color: facultyTheme.textMuted },
  secondaryBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: facultyTheme.border,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  secondaryBtnDisabled: { opacity: 0.55 },
  secondaryBtnText: { fontSize: 13, fontWeight: '700', color: facultyTheme.textMuted },
  loginRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  loginIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  loginTitle: { fontSize: 14, fontWeight: '700', color: facultyTheme.text },
  loginMeta: { marginTop: 2, fontSize: 12, color: facultyTheme.textMuted },
  placeholderNote: {
    fontSize: 12,
    color: facultyTheme.textSubtle,
    textAlign: 'center',
    paddingTop: 4,
  },
  tipRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  tipCheckWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipCheck: {
    color: '#15803d',
    fontWeight: '800',
    fontSize: 12,
    lineHeight: 14,
  },
  tipText: { flex: 1, fontSize: 13, lineHeight: 19, color: facultyTheme.text },
});
