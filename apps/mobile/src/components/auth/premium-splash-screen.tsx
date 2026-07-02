import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_VERSION } from '@/api/client';
import {
  NAAC_ACCREDITATION_LABEL,
  PRODUCT_NAME,
  SPLASH_AFFILIATION_LINE,
  SPLASH_DAILY_CAMPUS_BACKGROUNDS,
  SPLASH_DID_YOU_KNOW,
  SPLASH_DURATION_MS,
  SPLASH_LOADING_PHASES,
  SPLASH_QUOTES,
  SPLASH_ROTATING_MODULES,
} from '@/constants/release';
import { useBootstrap } from '@/hooks/useBootstrap';
import { resolveCollegeLogoUri } from '@/utils/upload-asset-url';

const MODULE_INTERVAL_MS = 1000;
const TIP_INTERVAL_MS = 2600;
const PARTICLE_COUNT = 8;

function loadingPhaseForProgress(progress: number): string {
  if (progress < 25) return SPLASH_LOADING_PHASES[0];
  if (progress < 50) return SPLASH_LOADING_PHASES[1];
  if (progress < 75) return SPLASH_LOADING_PHASES[2];
  return SPLASH_LOADING_PHASES[3];
}

function getDailyCampusUri() {
  const day = new Date().getDay();
  return SPLASH_DAILY_CAMPUS_BACKGROUNDS[day]?.uri ?? '';
}

function ParticleField() {
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, index) => ({
        id: index,
        left: `${10 + ((index * 19) % 80)}%` as `${number}%`,
        top: `${8 + ((index * 27) % 70)}%` as `${number}%`,
        size: 2 + (index % 2),
        delay: index * 220,
      })),
    [],
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((particle) => (
        <FloatingParticle key={particle.id} {...particle} />
      ))}
    </View>
  );
}

function FloatingParticle({
  left,
  top,
  size,
  delay,
}: {
  left: `${number}%`;
  top: `${number}%`;
  size: number;
  delay: number;
}) {
  const opacity = useRef(new Animated.Value(0.08)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.08,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [delay, opacity]);

  return (
    <Animated.View
      style={[
        styles.particle,
        { left, top, width: size, height: size, borderRadius: size / 2, opacity },
      ]}
    />
  );
}

function GridOverlay() {
  const lines = useMemo(() => Array.from({ length: 6 }, (_, i) => i), []);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {lines.map((line) => (
        <View key={`h-${line}`} style={[styles.gridLineH, { top: `${(line + 1) * 14}%` }]} />
      ))}
      {lines.map((line) => (
        <View key={`v-${line}`} style={[styles.gridLineV, { left: `${(line + 1) * 14}%` }]} />
      ))}
    </View>
  );
}

function DailyCampusBackdrop() {
  const campusUri = useMemo(() => getDailyCampusUri(), []);
  const [failed, setFailed] = useState(false);

  if (!campusUri || failed) {
    return (
      <ImageBackground
        source={require('../../../assets/splash.png')}
        style={StyleSheet.absoluteFill}
        imageStyle={styles.campusImage}
        resizeMode="cover"
      />
    );
  }

  return (
    <ImageBackground
      source={{ uri: campusUri }}
      style={StyleSheet.absoluteFill}
      imageStyle={styles.campusImage}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}

export function PremiumSplashScreen() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const compact = height < 700;
  const { config } = useBootstrap();

  const logoUri = useMemo(() => resolveCollegeLogoUri(config?.branding), [config]);
  const [logoFailed, setLogoFailed] = useState(false);
  const logoSource = logoFailed ? require('../../../assets/icon.png') : { uri: logoUri };

  useEffect(() => {
    setLogoFailed(false);
  }, [logoUri]);

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.9)).current;
  const logoGlowScale = useRef(new Animated.Value(0.85)).current;
  const logoGlowOpacity = useRef(new Animated.Value(0.25)).current;
  const collegeOpacity = useRef(new Animated.Value(0)).current;
  const collegeTranslate = useRef(new Animated.Value(12)).current;
  const erpOpacity = useRef(new Animated.Value(0)).current;
  const erpTranslate = useRef(new Animated.Value(14)).current;
  const moduleOpacity = useRef(new Animated.Value(1)).current;
  const tipOpacity = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const [moduleIndex, setModuleIndex] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [loadingLabel, setLoadingLabel] = useState<string>(SPLASH_LOADING_PHASES[0]);
  const [quoteIndex] = useState(() => Math.floor(Math.random() * SPLASH_QUOTES.length));
  const quote = SPLASH_QUOTES[quoteIndex];

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 650,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(logoGlowScale, {
              toValue: 1.08,
              duration: 2000,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(logoGlowOpacity, {
              toValue: 0.42,
              duration: 2000,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(logoGlowScale, {
              toValue: 0.92,
              duration: 2000,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(logoGlowOpacity, {
              toValue: 0.22,
              duration: 2000,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
        ]),
      ),
      Animated.sequence([
        Animated.delay(200),
        Animated.parallel([
          Animated.timing(collegeOpacity, { toValue: 1, duration: 550, useNativeDriver: true }),
          Animated.timing(collegeTranslate, {
            toValue: 0,
            duration: 550,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(380),
        Animated.parallel([
          Animated.timing(erpOpacity, { toValue: 1, duration: 550, useNativeDriver: true }),
          Animated.timing(erpTranslate, {
            toValue: 0,
            duration: 550,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: SPLASH_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  }, [
    collegeOpacity,
    collegeTranslate,
    erpOpacity,
    erpTranslate,
    logoGlowOpacity,
    logoGlowScale,
    logoOpacity,
    logoScale,
    progressAnim,
  ]);

  useEffect(() => {
    const listenerId = progressAnim.addListener(({ value }) => {
      setLoadingLabel(loadingPhaseForProgress(Math.round(value * 100)));
    });
    return () => progressAnim.removeListener(listenerId);
  }, [progressAnim]);

  useEffect(() => {
    const timer = setInterval(() => {
      Animated.sequence([
        Animated.timing(moduleOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(moduleOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
      setModuleIndex((current) => (current + 1) % SPLASH_ROTATING_MODULES.length);
    }, MODULE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [moduleOpacity]);

  useEffect(() => {
    const timer = setInterval(() => {
      Animated.sequence([
        Animated.timing(tipOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(tipOpacity, { toValue: 1, duration: 240, useNativeDriver: true }),
      ]).start();
      setTipIndex((current) => (current + 1) % SPLASH_DID_YOU_KNOW.length);
    }, TIP_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [tipOpacity]);

  return (
    <View style={styles.root}>
      <DailyCampusBackdrop />
      <LinearGradient
        colors={['rgba(11,31,74,0.94)', 'rgba(18,55,119,0.92)', 'rgba(26,77,178,0.94)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.radialGlow,
          {
            opacity: logoGlowOpacity,
            transform: [{ scale: logoGlowScale }],
          },
        ]}
      />
      <GridOverlay />
      <ParticleField />

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + (compact ? 12 : 20),
            paddingBottom: insets.bottom + (compact ? 10 : 16),
          },
        ]}
      >
        <Animated.View
          style={[styles.logoWrap, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}
        >
          <View style={styles.logoGlass}>
            <Image
              source={logoSource}
              style={styles.logo}
              resizeMode="contain"
              onError={() => setLogoFailed(true)}
            />
          </View>
        </Animated.View>

        <Animated.View
          style={{
            opacity: collegeOpacity,
            transform: [{ translateY: collegeTranslate }],
          }}
        >
          <Text style={[styles.collegeLine, compact && styles.collegeLineCompact]}>
            DON BOSCO COLLEGE
          </Text>
          <Text style={[styles.cityLine, compact && styles.cityLineCompact]}>TURA</Text>
          <Text style={styles.affiliation}>{SPLASH_AFFILIATION_LINE}</Text>
          <Text style={styles.affiliation}>{NAAC_ACCREDITATION_LABEL}</Text>
        </Animated.View>

        <View style={styles.divider} />

        <Animated.View
          style={{
            opacity: erpOpacity,
            transform: [{ translateY: erpTranslate }],
          }}
        >
          <Text style={[styles.product, compact && styles.productCompact]}>{PRODUCT_NAME}</Text>
          <Text style={styles.productSub}>NEP 2020 Ready</Text>
          <Text style={styles.productTagline}>Campus Management Platform</Text>
        </Animated.View>

        <View style={styles.loadingBlock}>
          <Text style={styles.loadingHeading}>Loading</Text>
          <Animated.Text style={[styles.moduleName, { opacity: moduleOpacity }]}>
            {SPLASH_ROTATING_MODULES[moduleIndex]}
          </Animated.Text>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
          </View>
          <Text style={styles.loadingLabel}>{loadingLabel}</Text>
        </View>

        <View style={styles.tipBlock}>
          <Text style={styles.didYouKnowLabel}>Did you know?</Text>
          <Animated.Text style={[styles.didYouKnowText, { opacity: tipOpacity }]}>
            {SPLASH_DID_YOU_KNOW[tipIndex]}
          </Animated.Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.quoteText}>&ldquo;{quote.text}&rdquo;</Text>
          <Text style={styles.footerLine}>
            Powered by <Text style={styles.footerBrand}>BaseCode Labs Pvt. Ltd.</Text>
          </Text>
          <Text style={styles.footerVersion}>Version {APP_VERSION}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0b1f4a',
  },
  campusImage: {
    opacity: 0.07,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 2,
  },
  radialGlow: {
    position: 'absolute',
    top: '14%',
    alignSelf: 'center',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(147, 197, 253, 0.35)',
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  particle: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  logoGlass: {
    width: 118,
    height: 118,
    borderRadius: 59,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  collegeLine: {
    color: '#ffffff',
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: 1.3,
    textAlign: 'center',
  },
  collegeLineCompact: {
    fontSize: 21,
  },
  cityLine: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 5,
    textAlign: 'center',
    marginTop: 8,
  },
  cityLineCompact: {
    fontSize: 15,
    marginTop: 6,
  },
  affiliation: {
    color: 'rgba(191,219,254,0.88)',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 5,
    lineHeight: 15,
  },
  divider: {
    width: '68%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginVertical: 12,
  },
  product: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  productCompact: {
    fontSize: 20,
  },
  productSub: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 5,
  },
  productTagline: {
    color: 'rgba(219,234,254,0.85)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },
  loadingBlock: {
    width: '100%',
    maxWidth: 320,
    marginTop: 16,
    alignItems: 'center',
    gap: 6,
  },
  loadingHeading: {
    color: 'rgba(191,219,254,0.75)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  moduleName: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    minHeight: 24,
  },
  progressTrack: {
    width: '100%',
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#93c5fd',
  },
  loadingLabel: {
    color: 'rgba(219,234,254,0.9)',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
  tipBlock: {
    marginTop: 14,
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: 8,
  },
  didYouKnowLabel: {
    color: 'rgba(191,219,254,0.65)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  didYouKnowText: {
    color: '#e0f2fe',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
    maxWidth: 300,
  },
  footer: {
    marginTop: 18,
    alignItems: 'center',
    gap: 4,
  },
  quoteText: {
    color: 'rgba(191,219,254,0.72)',
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
    maxWidth: 280,
  },
  footerLine: {
    color: 'rgba(191,219,254,0.78)',
    fontSize: 11,
    textAlign: 'center',
  },
  footerBrand: {
    color: '#ffffff',
    fontWeight: '700',
  },
  footerVersion: {
    color: 'rgba(147,197,253,0.8)',
    fontSize: 10,
  },
});
