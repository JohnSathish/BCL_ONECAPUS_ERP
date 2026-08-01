import { useEffect, useRef } from 'react';
import {
  Alert,
  Animated,
  Linking,
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
import { APP_VERSION } from '@/api/client';
import { authTheme } from '@/components/auth/auth-theme';
import { SchoolInstitutionChip } from '@/components/auth/school-institution-chip';
import {
  DEFAULT_PORTAL_STATS,
  DEFAULT_PORTAL_UPDATES,
  DON_BOSCO_QUOTE,
  INSTITUTION_AFFILIATION_LINES,
  INSTITUTION_BADGES,
  NAAC_ACCREDITATION_LABEL,
  COLLEGE_PORTAL_SUBTITLE,
  POWERED_BY,
  POWERED_BY_TAGLINE,
  PRIVACY_POLICY_URL,
  SIGN_IN_CTA,
  SUPPORT_EMAIL,
  WELCOME_FEATURE_CARDS,
  WELCOME_QUICK_ACCESS,
} from '@/constants/release';
import { useBootstrap } from '@/hooks/useBootstrap';
import { useSchoolConfig } from '@/hooks/use-school-config';
import { InstitutionLogo } from '@/components/auth/institution-logo';
import { getInstalledAppVersion, isVersionBelow } from '@/utils/app-version';

const STICKY_BAR_HEIGHT = 72;
let softUpdatePrompted = false;

function formatStat(value: number, fallback: number) {
  const n = value > 0 ? value : fallback;
  return `${n.toLocaleString('en-IN')}+`;
}

function SignInButton({
  onPress,
  pulse,
  compact,
}: {
  onPress: () => void;
  pulse?: Animated.Value;
  compact?: boolean;
}) {
  const content = (
    <Pressable onPress={onPress}>
      <LinearGradient
        colors={['#1E40AF', '#2563EB', '#1d4ed8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.signInBtn, compact && styles.signInBtnCompact]}
      >
        <Text style={[styles.signInText, compact && styles.signInTextCompact]}>{SIGN_IN_CTA}</Text>
        <Text style={styles.signInArrow}>→</Text>
      </LinearGradient>
    </Pressable>
  );

  if (pulse) {
    return <Animated.View style={{ transform: [{ scale: pulse }] }}>{content}</Animated.View>;
  }
  return content;
}

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const { config } = useBootstrap();
  const { school } = useSchoolConfig();

  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroSlide = useRef(new Animated.Value(24)).current;
  const bodyOpacity = useRef(new Animated.Value(0)).current;
  const buttonPulse = useRef(new Animated.Value(1)).current;

  const stats = config?.portalHighlights?.stats;
  const bootstrapUpdates = config?.portalHighlights?.updates ?? [];
  const updates = bootstrapUpdates.length > 0 ? bootstrapUpdates : [...DEFAULT_PORTAL_UPDATES];
  const loginNotices = config?.loginNotices;
  const notice =
    loginNotices?.showBanner === false
      ? null
      : loginNotices?.bannerTitle?.trim() || config?.maintenanceMessage?.trim() || null;

  const institutionName =
    config?.branding?.displayName?.trim() || school?.name || 'Your Institution';

  useEffect(() => {
    if (config?.maintenanceMode) {
      router.replace('/(auth)/maintenance');
      return;
    }
    if (!config) return;
    const installed = getInstalledAppVersion();
    const belowMin = isVersionBelow(installed, config.minVersion);
    const force = config.forceUpdate || belowMin;
    if (force) {
      router.replace('/(auth)/maintenance');
      return;
    }
    if (!softUpdatePrompted && isVersionBelow(installed, config.latestVersion)) {
      softUpdatePrompted = true;
      const updateUrl =
        config.playStoreUrl?.trim() ||
        config.apkDownloadUrl?.trim() ||
        'https://play.google.com/store/apps/details?id=com.basecodelabs.onecampus';
      Alert.alert(
        'Update available',
        config.softUpdateMessage?.trim() ||
          'A new version of the campus app is available. Update now to enjoy the latest features and improvements.',
        [
          { text: 'Later', style: 'cancel' },
          {
            text: 'Update Now',
            onPress: () => {
              void Linking.openURL(updateUrl);
            },
          },
        ],
      );
    }
  }, [config, router]);

  const studentStat = formatStat(stats?.students ?? 0, DEFAULT_PORTAL_STATS.students);
  const facultyStat = formatStat(stats?.faculty ?? 0, DEFAULT_PORTAL_STATS.faculty);
  const deptStat = formatStat(stats?.departments ?? 0, DEFAULT_PORTAL_STATS.departments);
  const academicYear = stats?.academicYear ?? DEFAULT_PORTAL_STATS.academicYear;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(heroSlide, { toValue: 0, duration: 700, useNativeDriver: true }),
      Animated.timing(bodyOpacity, {
        toValue: 1,
        duration: 900,
        delay: 250,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(buttonPulse, { toValue: 1.03, duration: 1200, useNativeDriver: true }),
        Animated.timing(buttonPulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ]),
    ).start();
  }, [bodyOpacity, buttonPulse, heroOpacity, heroSlide]);

  const bg = scheme === 'dark' ? '#0f172a' : '#F8FAFC';
  const cardBg = scheme === 'dark' ? '#1e293b' : '#ffffff';
  const text = scheme === 'dark' ? '#f8fafc' : '#0f172a';
  const textMuted = scheme === 'dark' ? '#94a3b8' : '#64748b';

  function goToLogin() {
    router.push('/(auth)/login');
  }

  function onQuickAccess(item: (typeof WELCOME_QUICK_ACCESS)[number]) {
    if ('route' in item && item.route) {
      router.push(item.route);
      return;
    }
    if ('url' in item && item.url) {
      void Linking.openURL(item.url).catch(() => {
        Alert.alert(item.label, 'Could not open link. Try again later.');
      });
      return;
    }
    Alert.alert(item.label, 'This service will be available in a future release.');
  }

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <ScrollView
        bounces={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + STICKY_BAR_HEIGHT + 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <LinearGradient
            colors={['#1e3a8a', '#2563eb', '#1d4ed8']}
            style={[styles.heroOverlay, { paddingTop: insets.top + 16 }]}
          >
            <Animated.View
              style={{
                opacity: heroOpacity,
                transform: [{ translateY: heroSlide }],
                alignItems: 'center',
              }}
            >
              <SchoolInstitutionChip light />
              <View style={styles.logoRing}>
                <InstitutionLogo branding={config?.branding} size={46} style={styles.logoImage} />
              </View>
              <Text style={styles.collegeLine}>{institutionName.toUpperCase()}</Text>
              {INSTITUTION_AFFILIATION_LINES.map((line) => (
                <Text key={line} style={styles.affiliationLine}>
                  {line}
                </Text>
              ))}
              <View style={styles.roleRow}>
                {['Student', 'Faculty', 'Parent', 'Staff'].map((role) => (
                  <View key={role} style={styles.roleChip}>
                    <Text style={styles.roleChipText}>{role}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.tagline}>{COLLEGE_PORTAL_SUBTITLE}</Text>
              <View style={styles.naacBadge}>
                <Text style={styles.naacStars}>★★★★★</Text>
                <Text style={styles.naacText}>{NAAC_ACCREDITATION_LABEL}</Text>
              </View>
            </Animated.View>
          </LinearGradient>
        </View>

        {/* Primary CTA — above the fold */}
        <View style={[styles.primaryCtaWrap, { marginTop: -32 }]}>
          <SignInButton onPress={goToLogin} pulse={buttonPulse} />
          <View style={styles.ctaDivider}>
            <View style={styles.ctaDividerLine} />
          </View>
        </View>

        <Animated.View style={[styles.body, { opacity: bodyOpacity }]}>
          {/* Quick Access */}
          <Text style={[styles.sectionTitle, { color: text }]}>Quick Access</Text>
          <Text style={[styles.sectionLead, { color: textMuted }]}>
            Public campus services — no login required for most links
          </Text>
          <View style={styles.quickGrid}>
            {WELCOME_QUICK_ACCESS.map((item) => (
              <Pressable
                key={item.id}
                style={[styles.quickCard, { backgroundColor: cardBg, borderColor: '#e2e8f0' }]}
                onPress={() => onQuickAccess(item)}
              >
                <Text style={styles.quickIcon}>{item.icon}</Text>
                <Text style={[styles.quickLabel, { color: text }]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.welcomeTitle, { color: text }]}>Welcome</Text>
          <Text style={[styles.welcomeLead, { color: textMuted }]}>
            Manage your academics, attendance, fees, examinations, learning, and campus services
            from one secure platform.
          </Text>

          <View style={styles.badgeRow}>
            {INSTITUTION_BADGES.map((badge) => (
              <View key={badge} style={[styles.badge, { backgroundColor: cardBg }]}>
                <Text style={[styles.badgeText, { color: authTheme.primaryLight }]}>{badge}</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { color: text }]}>Campus Services</Text>
          <View style={styles.featureGrid}>
            {WELCOME_FEATURE_CARDS.map((feature) => (
              <View
                key={feature.id}
                style={[
                  styles.featureCard,
                  { backgroundColor: cardBg, borderColor: `${feature.tone}22` },
                ]}
              >
                <View style={[styles.featureIconWrap, { backgroundColor: `${feature.tone}18` }]}>
                  <Text style={styles.featureIcon}>{feature.icon}</Text>
                </View>
                <Text style={[styles.featureLabel, { color: text }]}>{feature.label}</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { color: text }]}>Campus at a Glance</Text>
          <View style={styles.statsGrid}>
            <StatCard
              icon="👨‍🎓"
              value={studentStat}
              label="Students"
              cardBg={cardBg}
              text={text}
              textMuted={textMuted}
            />
            <StatCard
              icon="👩‍🏫"
              value={facultyStat}
              label="Faculty"
              cardBg={cardBg}
              text={text}
              textMuted={textMuted}
            />
            <StatCard
              icon="🏛"
              value={deptStat}
              label="Departments"
              cardBg={cardBg}
              text={text}
              textMuted={textMuted}
            />
            <StatCard
              icon="📖"
              value="NEP 2020"
              label={academicYear}
              cardBg={cardBg}
              text={text}
              textMuted={textMuted}
            />
          </View>

          <View style={styles.updatesHeader}>
            <Text style={[styles.sectionTitle, { color: text, marginTop: 0 }]}>Latest Updates</Text>
            <Pressable onPress={() => Alert.alert('Latest Updates', updates.join('\n\n'))}>
              <Text style={styles.viewAll}>View All →</Text>
            </Pressable>
          </View>
          <View style={[styles.updatesCard, { backgroundColor: cardBg }]}>
            {updates.slice(0, 5).map((item, index) => (
              <View key={`${item}-${index}`} style={styles.updateRow}>
                <Text style={styles.updateDot}>•</Text>
                <Text style={[styles.updateText, { color: textMuted }]}>{item}</Text>
              </View>
            ))}
          </View>

          {notice ? (
            <>
              <Text style={[styles.sectionTitle, { color: text }]}>Important Notice</Text>
              <View style={styles.noticeCard}>
                <Text style={styles.noticeLabel}>Announcement</Text>
                <Text style={styles.noticeText}>{notice}</Text>
                <Pressable onPress={() => Alert.alert('Important Notice', notice)}>
                  <Text style={styles.noticeLink}>Read more →</Text>
                </Pressable>
              </View>
            </>
          ) : null}

          <View style={[styles.quoteCard, { backgroundColor: cardBg }]}>
            <Text style={[styles.quoteText, { color: text }]}>"{DON_BOSCO_QUOTE.text}"</Text>
            <Text style={[styles.quoteAuthor, { color: textMuted }]}>
              — {DON_BOSCO_QUOTE.author}
            </Text>
          </View>

          <View style={styles.footerLinks}>
            <Pressable onPress={() => router.push('/(auth)/forgot-password')}>
              <Text style={styles.footerLink}>Need Help?</Text>
            </Pressable>
            <Pressable onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
              <Text style={styles.footerLink}>IT Support</Text>
            </Pressable>
            <Pressable onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}>
              <Text style={styles.footerLink}>Privacy Policy</Text>
            </Pressable>
          </View>
          <Text style={[styles.version, { color: textMuted }]}>Version {APP_VERSION}</Text>
          <Text style={[styles.powered, { color: textMuted }]}>{POWERED_BY}</Text>
          <Text style={[styles.poweredSub, { color: textMuted }]}>{POWERED_BY_TAGLINE}</Text>
        </Animated.View>
      </ScrollView>

      {/* Sticky bottom Sign In — always one tap away */}
      <View
        style={[
          styles.stickyBar,
          {
            paddingBottom: insets.bottom + 8,
            backgroundColor: scheme === 'dark' ? '#1e293b' : '#ffffff',
            borderTopColor: scheme === 'dark' ? '#334155' : '#e2e8f0',
          },
        ]}
      >
        <View style={styles.stickyDivider} />
        <SignInButton onPress={goToLogin} compact />
      </View>
    </View>
  );
}

function StatCard({
  icon,
  value,
  label,
  cardBg,
  text,
  textMuted,
}: {
  icon: string;
  value: string;
  label: string;
  cardBg: string;
  text: string;
  textMuted: string;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: cardBg }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color: text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  heroSection: {
    overflow: 'hidden',
    backgroundColor: '#1e3a8a',
  },
  heroOverlay: {
    flex: 1,
    minHeight: 300,
    paddingHorizontal: 24,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  logoRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    marginBottom: 14,
  },
  logoImage: { width: 72, height: 72, borderRadius: 36 },
  welcomeMessage: {
    color: 'rgba(219,234,254,0.95)',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  collegeLine: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.6,
    textAlign: 'center',
    marginTop: 2,
    paddingHorizontal: 12,
    lineHeight: 26,
  },
  affiliationLine: {
    color: 'rgba(219,234,254,0.88)',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 15,
    paddingHorizontal: 10,
  },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  roleChip: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  roleChipText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  tagline: {
    color: '#e0e7ff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
    letterSpacing: 0.2,
  },
  naacBadge: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  naacStars: { color: authTheme.accent, fontSize: 12, letterSpacing: 1 },
  naacText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  primaryCtaWrap: {
    paddingHorizontal: 20,
    gap: 12,
  },
  ctaDivider: { alignItems: 'center', marginTop: 4 },
  ctaDividerLine: {
    width: '100%',
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  body: { paddingHorizontal: 20, paddingTop: 8, gap: 14 },
  welcomeTitle: { fontSize: 24, fontWeight: '800' },
  welcomeLead: { fontSize: 14, lineHeight: 22 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  badgeText: { fontSize: 10, fontWeight: '700' },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginTop: 4 },
  sectionLead: { fontSize: 12, marginTop: -8 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickCard: {
    width: '47%',
    flexGrow: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    shadowColor: '#1e40af',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  quickIcon: { fontSize: 22 },
  quickLabel: { fontSize: 12, fontWeight: '700', lineHeight: 16 },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  featureCard: {
    width: '31%',
    flexGrow: 1,
    minWidth: 100,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    shadowColor: '#1e40af',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  featureIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureIcon: { fontSize: 22 },
  featureLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  updatesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  viewAll: { color: authTheme.primaryLight, fontSize: 13, fontWeight: '700' },
  updatesCard: {
    borderRadius: 16,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  updateRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  updateDot: { color: authTheme.primaryLight, fontWeight: '700', lineHeight: 20 },
  updateText: { flex: 1, fontSize: 13, lineHeight: 20 },
  noticeCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fde68a',
    gap: 6,
  },
  noticeLabel: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  noticeText: { color: '#92400e', fontSize: 14, fontWeight: '600', lineHeight: 20 },
  noticeLink: { color: '#d97706', fontWeight: '700', fontSize: 13, marginTop: 2 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: '48%',
    flexGrow: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  statIcon: { fontSize: 22 },
  statValue: { fontSize: 18, fontWeight: '800', marginTop: 6 },
  statLabel: { fontSize: 11, marginTop: 2, textAlign: 'center' },
  quoteCard: {
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: authTheme.accent,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  quoteText: { fontSize: 15, fontStyle: 'italic', lineHeight: 22 },
  quoteAuthor: { marginTop: 8, fontSize: 13, fontWeight: '600' },
  signInBtn: {
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#1E40AF',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  signInBtnCompact: {
    paddingVertical: 14,
    marginHorizontal: 16,
  },
  signInText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  signInTextCompact: { fontSize: 16 },
  signInArrow: { color: '#fff', fontSize: 20, fontWeight: '700' },
  stickyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  stickyDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginBottom: 8,
    marginHorizontal: 16,
  },
  footerLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
  },
  footerLink: { color: authTheme.primaryLight, fontSize: 13, fontWeight: '600' },
  version: { textAlign: 'center', fontSize: 11, marginTop: 8 },
  powered: { textAlign: 'center', fontSize: 11, marginTop: 4 },
  poweredSub: { textAlign: 'center', fontSize: 10, marginTop: 2 },
});
