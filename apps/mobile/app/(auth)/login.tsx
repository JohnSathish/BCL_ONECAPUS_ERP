import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_VERSION } from '@/api/client';
import {
  getSemesterLabel,
  getTimeGreeting,
  looksLikeCapsLock,
  useIdentifierHint,
} from '@/auth/identifier-hint';
import { performLogin } from '@/auth/login-flow';
import { authColors, authTheme } from '@/components/auth/auth-theme';
import { CaptchaWidget, type Challenge } from '@/components/auth/captcha-widget';
import { SchoolInstitutionChip } from '@/components/auth/school-institution-chip';
import {
  COLLEGE_NAME,
  DEFAULT_PORTAL_STATS,
  DEFAULT_PORTAL_UPDATES,
  POWERED_BY,
  PRIVACY_POLICY_URL,
  PRODUCT_NAME,
  SUPPORT_PHONE,
  WHATSAPP_SUPPORT_URL,
} from '@/constants/release';
import { useBootstrap } from '@/hooks/useBootstrap';
import { useSchoolConfig } from '@/hooks/use-school-config';
import { InstitutionLogo } from '@/components/auth/institution-logo';

const MORE_LOGIN_OPTIONS = [
  { label: 'Scan Student QR', id: 'qr' },
  { label: 'Scan College RFID', id: 'rfid' },
  { label: 'Biometric Login', id: 'bio' },
  { label: 'Microsoft / Google SSO', id: 'sso' },
] as const;

const NEWS_ICONS = ['📢', '🎓', '📅', '💰', '🏆', '📝'] as const;

function pickNewsIcon(text: string, index: number) {
  const lower = text.toLowerCase();
  if (/admission|apply|enrol/.test(lower)) return '📢';
  if (/convocation|graduate|rank|congrat/.test(lower)) return '🏆';
  if (/fee|payment|due/.test(lower)) return '💰';
  if (/exam|internal|assessment|schedule/.test(lower)) return '📝';
  if (/semester|session|academic|nep/.test(lower)) return '📅';
  return NEWS_ICONS[index % NEWS_ICONS.length];
}

function campusShortName() {
  return 'Tura Campus';
}

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ reason?: string }>();
  const sessionExpired = params.reason === 'session_expired';
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = authColors(scheme);
  const { config, error: bootstrapError } = useBootstrap();
  const { school } = useSchoolConfig();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [newsIndex, setNewsIndex] = useState(0);

  const buttonScale = useRef(new Animated.Value(1)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const newsFade = useRef(new Animated.Value(1)).current;

  const greeting = getTimeGreeting();
  const identifierHint = useIdentifierHint(identifier);
  const capsWarning = looksLikeCapsLock(password);
  const offline = !config && !!bootstrapError;

  const stats = config?.portalHighlights?.stats;
  const bootstrapUpdates = config?.portalHighlights?.updates ?? [];
  const updates = bootstrapUpdates.length > 0 ? bootstrapUpdates : [...DEFAULT_PORTAL_UPDATES];
  const newsItems = useMemo(
    () => updates.map((text, index) => ({ icon: pickNewsIcon(text, index), text })),
    [updates],
  );

  const academicYear = stats?.academicYear ?? DEFAULT_PORTAL_STATS.academicYear;
  const semesterLabel = getSemesterLabel();
  const announcement = config?.maintenanceMessage?.trim() || updates[0] || null;
  const announceDetail = updates[1] ?? 'Tap View for details';

  const surface = scheme === 'dark' ? '#1e293b' : '#ffffff';
  const pageBg = scheme === 'dark' ? '#0f172a' : '#eef2ff';

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(buttonScale, { toValue: 1.015, duration: 1500, useNativeDriver: true }),
        Animated.timing(buttonScale, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ]),
    ).start();
  }, [buttonScale, fadeIn]);

  useEffect(() => {
    if (newsItems.length <= 1) return;
    const timer = setInterval(() => {
      Animated.sequence([
        Animated.timing(newsFade, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(newsFade, { toValue: 1, duration: 320, useNativeDriver: true }),
      ]).start();
      setNewsIndex((i) => (i + 1) % newsItems.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [newsFade, newsItems.length]);

  async function onLogin() {
    if (!challenge) {
      setError('Complete the security check first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await performLogin({
        identifier,
        password,
        challenge,
        challengeAnswer: Number(captchaAnswer),
        rememberMe,
      });
      if (result.mustResetPassword) {
        router.replace('/(auth)/change-password');
        return;
      }
      router.replace(result.route.href as never);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  function onMoreLoginOptions() {
    Alert.alert('More Login Options', 'Choose an alternative sign-in method.', [
      ...MORE_LOGIN_OPTIONS.map((opt) => ({
        text: opt.label,
        onPress: () =>
          Alert.alert(opt.label, `${opt.label} will be available in a future OneCampus release.`),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }

  const currentNews = newsItems[newsIndex % newsItems.length];

  return (
    <View style={[styles.root, { backgroundColor: pageBg }]}>
      <ScrollView
        bounces={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Compact header */}
        <LinearGradient
          colors={['#1e3a8a', '#2563eb', '#1d4ed8']}
          style={[styles.header, { paddingTop: insets.top + 12 }]}
        >
          <SchoolInstitutionChip light />
          <View style={styles.logoRing}>
            <InstitutionLogo branding={config?.branding} size={40} style={styles.logoImage} />
          </View>
          <Text style={styles.collegeName}>{school?.name ?? COLLEGE_NAME}</Text>
          <Text style={styles.productName}>{PRODUCT_NAME}</Text>

          <View style={styles.headerDivider} />

          <Text style={styles.greetingLine}>
            {greeting.icon} {greeting.text}
          </Text>
          <Text style={styles.greetingWelcome}>Welcome back to</Text>
          <Text style={styles.greetingProduct}>{PRODUCT_NAME}</Text>

          <Text style={styles.metaLine}>
            {semesterLabel} · AY {academicYear} · {campusShortName()}
          </Text>
        </LinearGradient>

        {offline ? (
          <Pressable style={styles.offlineStrip} onPress={() => router.replace('/')}>
            <Text style={styles.offlineText}>Offline — Connect to internet to sign in</Text>
          </Pressable>
        ) : null}

        {sessionExpired ? (
          <View style={styles.sessionExpiredStrip}>
            <Text style={styles.sessionExpiredTitle}>Your session has expired.</Text>
            <Text style={styles.sessionExpiredBody}>Please sign in again to continue.</Text>
          </View>
        ) : null}

        {announcement ? (
          <Pressable
            style={styles.announceStrip}
            onPress={() => Alert.alert('Campus Notice', `${announcement}\n\n${announceDetail}`)}
          >
            <Text style={styles.announceIcon}>📢</Text>
            <View style={styles.announceTextWrap}>
              <Text style={styles.announceTitle} numberOfLines={1}>
                {announcement}
              </Text>
              <Text style={styles.announceSub} numberOfLines={1}>
                {announceDetail}
              </Text>
            </View>
            <Text style={styles.announceView}>View →</Text>
          </Pressable>
        ) : null}

        <Animated.View style={[styles.content, { opacity: fadeIn }]}>
          {/* Unified login surface */}
          <View style={[styles.surface, { backgroundColor: surface }]}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Username</Text>
            <Text style={[styles.supportsLine, { color: colors.textMuted }]}>
              Supports: Email · Roll No. · Employee ID · Mobile
            </Text>
            <View
              style={[
                styles.inputRow,
                { borderColor: colors.border, backgroundColor: colors.inputBg },
              ]}
            >
              <TextInput
                value={identifier}
                onChangeText={setIdentifier}
                placeholder="College email, roll no., or employee ID"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                style={[styles.input, { color: colors.text }]}
              />
            </View>

            {identifierHint ? (
              <Text style={[styles.roleHint, { color: identifierHint.tone }]}>
                {identifierHint.icon} {identifierHint.label}
              </Text>
            ) : null}

            <Text style={[styles.fieldLabel, { color: colors.text, marginTop: 14 }]}>Password</Text>
            <View
              style={[
                styles.inputRow,
                { borderColor: colors.border, backgroundColor: colors.inputBg },
              ]}
            >
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                style={[styles.input, { color: colors.text }]}
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                <Text style={styles.toggle}>{showPassword ? 'Hide' : '👁 Show'}</Text>
              </Pressable>
            </View>
            {capsWarning ? <Text style={styles.capsWarning}>⚠ Caps Lock may be ON</Text> : null}

            <View style={styles.row}>
              <Pressable style={styles.rememberRow} onPress={() => setRememberMe((v) => !v)}>
                <View style={[styles.checkbox, rememberMe && styles.checkboxOn]} />
                <Text style={[styles.rememberText, { color: colors.text }]}>Remember me</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/(auth)/forgot-password')}>
                <Text style={styles.forgot}>Forgot Password?</Text>
              </Pressable>
            </View>

            <CaptchaWidget
              scheme={scheme}
              answer={captchaAnswer}
              onAnswerChange={setCaptchaAnswer}
              onChallenge={setChallenge}
            />

            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <Pressable
                style={[styles.loginBtnWrap, (loading || offline) && styles.loginBtnDisabled]}
                onPress={() => void onLogin()}
                disabled={loading || offline}
              >
                <LinearGradient
                  colors={['#2563eb', '#1d4ed8', '#1e40af']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.loginBtn}
                >
                  <Text style={styles.loginBtnTitle}>
                    {loading ? 'Signing in…' : 'Secure Sign In'}
                  </Text>
                  <Text style={styles.loginBtnSub}>Access OneCampus</Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable onPress={onMoreLoginOptions} style={styles.moreOptions}>
              <Text style={styles.moreOptionsText}>More login options</Text>
            </Pressable>

            <View style={styles.trustLine}>
              <Text style={styles.trustItem}>NEP 2020</Text>
              <Text style={styles.trustDot}>·</Text>
              <Text style={styles.trustItem}>NAAC</Text>
              <Text style={styles.trustDot}>·</Text>
              <Text style={styles.trustItem}>NEHU</Text>
              <Text style={styles.trustDot}>·</Text>
              <Text style={styles.trustItem}>Secure Login</Text>
            </View>
          </View>

          {/* Campus news carousel */}
          <Animated.View
            style={[styles.newsCarousel, { backgroundColor: surface, opacity: newsFade }]}
          >
            <Text style={styles.newsIcon}>{currentNews?.icon ?? '📢'}</Text>
            <Text style={[styles.newsText, { color: colors.text }]} numberOfLines={2}>
              {currentNews?.text ?? 'Campus updates loading…'}
            </Text>
            {newsItems.length > 1 ? (
              <View style={styles.newsDots}>
                {newsItems.slice(0, 5).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.newsDot,
                      i === newsIndex % newsItems.length && styles.newsDotActive,
                    ]}
                  />
                ))}
              </View>
            ) : null}
          </Animated.View>

          <Pressable style={styles.guestBtn} onPress={() => router.push('/(auth)/guest')}>
            <Text style={styles.guestBtnText}>Continue as Guest</Text>
            <Text style={styles.guestBtnSub}>
              Admission tracking · Public notices · College contact
            </Text>
          </Pressable>

          {/* Today's updates — compact cards */}
          <Text style={[styles.sectionLabel, { color: colors.text }]}>Today's Updates</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.updateCards}
          >
            {newsItems.slice(0, 5).map((item, index) => (
              <View
                key={`${item.text}-${index}`}
                style={[styles.updateCard, { backgroundColor: surface }]}
              >
                <Text style={styles.updateIcon}>{item.icon}</Text>
                <Text style={[styles.updateCardText, { color: colors.text }]} numberOfLines={2}>
                  {item.text}
                </Text>
              </View>
            ))}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={[styles.footerHeading, { color: colors.text }]}>Need Help?</Text>
            <View style={styles.footerRow}>
              <Pressable onPress={() => void Linking.openURL(WHATSAPP_SUPPORT_URL)}>
                <Text style={styles.footerAction}>WhatsApp Support</Text>
              </Pressable>
              <Text style={styles.footerSep}>·</Text>
              <Pressable onPress={() => void Linking.openURL(`tel:${SUPPORT_PHONE}`)}>
                <Text style={styles.footerAction}>Call IT Support</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}>
              <Text style={[styles.footerMuted, { color: colors.textMuted }]}>Privacy Policy</Text>
            </Pressable>
            <Text style={[styles.footerMuted, { color: colors.textMuted }]}>
              Version {APP_VERSION}
            </Text>
            <Text style={[styles.footerPowered, { color: colors.textMuted }]}>{POWERED_BY}</Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 18,
    alignItems: 'center',
  },
  logoRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  logoImage: { width: 46, height: 46, borderRadius: 23 },
  collegeName: { color: '#fff', fontSize: 15, fontWeight: '800', textAlign: 'center' },
  productName: { color: '#dbeafe', fontSize: 13, fontWeight: '600', marginTop: 2 },
  headerDivider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginVertical: 12,
  },
  greetingLine: { color: '#fff', fontSize: 16, fontWeight: '800' },
  greetingWelcome: { color: '#bfdbfe', fontSize: 12, marginTop: 4 },
  greetingProduct: { color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 2 },
  metaLine: { color: '#93c5fd', fontSize: 11, fontWeight: '600', marginTop: 8 },
  offlineStrip: {
    backgroundColor: '#fef2f2',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#fecaca',
  },
  offlineText: { color: '#b91c1c', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  sessionExpiredStrip: {
    backgroundColor: '#fff7ed',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#fed7aa',
  },
  sessionExpiredTitle: {
    color: '#c2410c',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  sessionExpiredBody: {
    color: '#9a3412',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
  announceStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fffbeb',
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
  },
  announceIcon: { fontSize: 16 },
  announceTextWrap: { flex: 1, gap: 1 },
  announceTitle: { color: '#92400e', fontSize: 13, fontWeight: '700' },
  announceSub: { color: '#b45309', fontSize: 11 },
  announceView: { color: '#d97706', fontSize: 12, fontWeight: '700' },
  content: { paddingHorizontal: 16, paddingTop: 14, gap: 14 },
  surface: {
    borderRadius: 20,
    padding: 18,
    gap: 8,
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  fieldLabel: { fontSize: 14, fontWeight: '700' },
  supportsLine: { fontSize: 11, marginTop: -4, marginBottom: 2 },
  inputRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
  },
  input: { flex: 1, paddingVertical: 12, fontSize: 15 },
  roleHint: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  toggle: { color: '#2563eb', fontWeight: '600', fontSize: 13 },
  capsWarning: { color: '#d97706', fontSize: 11, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#94a3b8',
  },
  checkboxOn: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  rememberText: { fontSize: 13 },
  forgot: { color: '#2563eb', fontWeight: '600', fontSize: 13 },
  loginBtnWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 4,
    shadowColor: '#1e40af',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  loginBtnDisabled: { opacity: 0.65 },
  loginBtn: { paddingVertical: 18, alignItems: 'center' },
  loginBtnTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  loginBtnSub: { color: '#dbeafe', fontSize: 12, fontWeight: '600', marginTop: 2 },
  error: { color: '#dc2626', textAlign: 'center', fontSize: 13 },
  moreOptions: { alignItems: 'center', paddingVertical: 4 },
  moreOptionsText: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  trustLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  trustItem: { color: '#64748b', fontSize: 10, fontWeight: '700' },
  trustDot: { color: '#cbd5e1', fontSize: 10 },
  newsCarousel: {
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  newsIcon: { fontSize: 22 },
  newsText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  newsDots: { flexDirection: 'column', gap: 4 },
  newsDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#cbd5e1' },
  newsDotActive: { backgroundColor: '#2563eb', height: 8 },
  guestBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: 'rgba(37,99,235,0.06)',
  },
  guestBtnText: { color: '#1d4ed8', fontSize: 14, fontWeight: '800' },
  guestBtnSub: { color: '#64748b', fontSize: 11, marginTop: 2, textAlign: 'center' },
  sectionLabel: { fontSize: 15, fontWeight: '800', marginTop: 4 },
  updateCards: { gap: 10, paddingRight: 8 },
  updateCard: {
    width: Math.min(156, SCREEN_WIDTH * 0.42),
    borderRadius: 14,
    padding: 12,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  updateIcon: { fontSize: 20 },
  updateCardText: { fontSize: 12, fontWeight: '600', lineHeight: 16 },
  footer: { alignItems: 'center', gap: 6, marginTop: 8, paddingBottom: 8 },
  footerHeading: { fontSize: 14, fontWeight: '800' },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerAction: { color: '#0d9488', fontSize: 13, fontWeight: '700' },
  footerSep: { color: '#cbd5e1' },
  footerMuted: { fontSize: 11 },
  footerPowered: { fontSize: 11, fontWeight: '600' },
});
