import { Fragment, useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  POWERED_BY_TAGLINE,
  PRODUCT_NAME,
  PORTAL_TAGLINE,
  SPLASH_DURATION_MS,
  SPLASH_MOTTO,
  SPLASH_ROLES,
} from '@/constants/release';

const BCL_LOGO = require('../../../assets/bcl-onecampus-logo.png');

const RING_SIZES = [260, 320, 380, 440, 500];

function ConcentricRings() {
  return (
    <View style={styles.ringsLayer} pointerEvents="none">
      {RING_SIZES.map((size) => (
        <View
          key={size}
          style={[
            styles.ring,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              marginLeft: -size / 2,
              marginTop: -size / 2,
            },
          ]}
        />
      ))}
    </View>
  );
}

function BottomWaves() {
  return (
    <View style={styles.wavesLayer} pointerEvents="none">
      <View style={[styles.wave, styles.waveBack]} />
      <View style={[styles.wave, styles.waveMid]} />
      <View style={[styles.wave, styles.waveFront]} />
    </View>
  );
}

function DiamondSeparator() {
  return (
    <View style={styles.separatorRow}>
      <View style={styles.separatorLine} />
      <View style={styles.diamond} />
      <View style={styles.separatorLine} />
    </View>
  );
}

function RoleRow() {
  return (
    <View style={styles.roleRow}>
      {SPLASH_ROLES.map((role, index) => (
        <Fragment key={role.label}>
          {index > 0 ? <View style={styles.roleDivider} /> : null}
          <View style={styles.roleItem}>
            <Text style={styles.roleIcon}>{role.icon}</Text>
            <Text style={styles.roleLabel}>{role.label}</Text>
          </View>
        </Fragment>
      ))}
    </View>
  );
}

function PageDots() {
  return (
    <View style={styles.pageDots}>
      <View style={styles.pageDot} />
      <View style={[styles.pageDot, styles.pageDotActive]} />
      <View style={styles.pageDot} />
    </View>
  );
}

export function PremiumSplashScreen() {
  const insets = useSafeAreaInsets();

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.9)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(16)).current;
  const mottoOpacity = useRef(new Animated.Value(0)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 7,
          tension: 55,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 550,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(contentSlide, {
          toValue: 0,
          duration: 550,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(mottoOpacity, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(footerOpacity, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0.55,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [
    contentOpacity,
    contentSlide,
    footerOpacity,
    glowPulse,
    logoOpacity,
    logoScale,
    mottoOpacity,
  ]);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#020f2e', '#0a2456', '#143d7a', '#0a2456', '#020f2e']}
        locations={[0, 0.25, 0.5, 0.75, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['transparent', 'rgba(37,99,235,0.18)', 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.centerGlow}
        pointerEvents="none"
      />

      <ConcentricRings />
      <BottomWaves />

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + 36,
            paddingBottom: insets.bottom + 12,
          },
        ]}
      >
        <View style={styles.mainBlock}>
          <Animated.View
            style={[styles.logoWrap, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}
          >
            <Image source={BCL_LOGO} style={styles.logo} resizeMode="contain" />
          </Animated.View>

          <Animated.View
            style={{
              opacity: contentOpacity,
              transform: [{ translateY: contentSlide }],
              alignItems: 'center',
              width: '100%',
            }}
          >
            <Text style={styles.productName}>{PRODUCT_NAME}</Text>
            <DiamondSeparator />
            <Text style={styles.tagline}>{PORTAL_TAGLINE}</Text>
            <RoleRow />
          </Animated.View>

          <Animated.View style={[styles.mottoBlock, { opacity: mottoOpacity }]}>
            <Text style={styles.motto}>{SPLASH_MOTTO}</Text>
            <Animated.View style={[styles.mottoGlow, { opacity: glowPulse }]} />
          </Animated.View>
        </View>

        <Animated.View style={[styles.footer, { opacity: footerOpacity }]}>
          <Text style={styles.poweredLabel}>Powered by</Text>
          <Text style={styles.poweredBrand}>BaseCode Labs Pvt. Ltd.</Text>
          <Text style={styles.poweredTagline}>{POWERED_BY_TAGLINE}</Text>
          <PageDots />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020f2e',
  },
  centerGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  ringsLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    top: '38%',
    left: '50%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  wavesLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 140,
    overflow: 'hidden',
  },
  wave: {
    position: 'absolute',
    left: -40,
    right: -40,
    borderTopLeftRadius: 200,
    borderTopRightRadius: 200,
  },
  waveBack: {
    bottom: -20,
    height: 90,
    backgroundColor: 'rgba(15,76,129,0.45)',
  },
  waveMid: {
    bottom: -8,
    height: 72,
    backgroundColor: 'rgba(29,95,167,0.55)',
  },
  waveFront: {
    bottom: 4,
    height: 56,
    backgroundColor: 'rgba(37,99,235,0.35)',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  mainBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 10,
  },
  logo: {
    width: 156,
    height: 156,
  },
  productName: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  separatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 12,
    width: '72%',
    gap: 10,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  diamond: {
    width: 7,
    height: 7,
    backgroundColor: '#60A5FA',
    transform: [{ rotate: '45deg' }],
  },
  tagline: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    paddingHorizontal: 4,
  },
  roleDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.28)',
    marginHorizontal: 10,
  },
  roleItem: {
    alignItems: 'center',
    gap: 5,
    minWidth: 58,
  },
  roleIcon: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  roleLabel: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 11,
    fontWeight: '600',
  },
  mottoBlock: {
    alignItems: 'center',
    marginTop: 28,
    width: '100%',
  },
  motto: {
    color: '#22D3EE',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(34,211,238,0.85)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  mottoGlow: {
    marginTop: 10,
    width: '68%',
    height: 2,
    borderRadius: 2,
    backgroundColor: '#22D3EE',
    shadowColor: '#22D3EE',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 12,
  },
  footer: {
    alignItems: 'center',
    gap: 2,
    paddingBottom: 8,
  },
  poweredLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  poweredBrand: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 2,
  },
  poweredTagline: {
    color: '#22D3EE',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
  pageDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 14,
  },
  pageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(96,165,250,0.45)',
  },
  pageDotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
});

/** @deprecated Use SPLASH_DURATION_MS from constants/release */
export const SPLASH_ANIMATION_MS = SPLASH_DURATION_MS;
