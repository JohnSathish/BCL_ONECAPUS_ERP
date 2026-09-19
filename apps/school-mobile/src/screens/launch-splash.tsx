import { ActivityIndicator, Dimensions, Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CREST } from '@/brand';

const { width, height } = Dimensions.get('window');

export function LaunchSplash() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#071a78', '#0b2db8', '#163ee0', '#0a248e']}
        locations={[0, 0.28, 0.62, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.waves}>
        <View style={[styles.wave, styles.waveTL]} />
        <View style={[styles.wave, styles.waveTR]} />
        <View style={[styles.silk, styles.silkTop]} />
        <View style={[styles.silk, styles.silkBottom]} />
        <View style={styles.bookHint} />
      </View>

      <View style={[styles.center, { paddingTop: insets.top + 12 }]}>
        <View style={styles.crestWrap}>
          <View style={styles.crestGlow} />
          <Image source={CREST} style={styles.crest} resizeMode="contain" />
        </View>
        <Text style={styles.title}>St. Luke’s</Text>
        <Text style={styles.subtitle}>Higher Secondary School</Text>
        <View style={styles.placeRow}>
          <View style={styles.goldLine} />
          <Text style={styles.place}>WALBAKGRE - TURA</Text>
          <View style={styles.goldLine} />
        </View>
        <Text style={styles.tagline}>Learn • Grow • Serve</Text>
        <ActivityIndicator color="#ffffff" size="large" style={styles.spinner} />
        <Text style={styles.preparing}>Preparing for a brighter tomorrow...</Text>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.footerTick} />
        <Text style={styles.values}>DISCIPLINE | KNOWLEDGE | CHARACTER | SERVICE</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a2cb8' },
  waves: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  wave: {
    position: 'absolute',
    backgroundColor: 'rgba(140, 185, 255, 0.14)',
    borderRadius: 9999,
  },
  waveTL: {
    width: width * 1.45,
    height: height * 0.5,
    top: -height * 0.22,
    left: -width * 0.42,
    transform: [{ rotate: '-16deg' }],
  },
  waveTR: {
    width: width * 1.2,
    height: height * 0.34,
    top: -height * 0.1,
    right: -width * 0.46,
    backgroundColor: 'rgba(90, 150, 255, 0.1)',
    transform: [{ rotate: '24deg' }],
  },
  silk: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: 'rgba(190, 220, 255, 0.28)',
    backgroundColor: 'transparent',
  },
  silkTop: {
    width: width * 1.8,
    height: height * 0.7,
    top: -height * 0.18,
    left: -width * 0.2,
    transform: [{ rotate: '-8deg' }],
  },
  silkBottom: {
    width: width * 1.9,
    height: height * 0.55,
    bottom: -height * 0.22,
    left: -width * 0.25,
    borderColor: 'rgba(200, 230, 255, 0.32)',
    transform: [{ rotate: '-12deg' }],
  },
  bookHint: {
    position: 'absolute',
    width: width * 0.7,
    height: width * 0.42,
    bottom: height * 0.06,
    left: width * 0.15,
    borderRadius: width * 0.12,
    backgroundColor: 'rgba(20, 40, 120, 0.22)',
    transform: [{ rotate: '-8deg' }],
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  crestWrap: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  crestGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(170, 210, 255, 0.2)',
  },
  crest: {
    width: 168,
    height: 168,
  },
  title: {
    color: '#ffffff',
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.94)',
    fontSize: 20,
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
  },
  goldLine: {
    width: 40,
    height: 1.5,
    backgroundColor: 'rgba(255, 220, 80, 0.9)',
    borderRadius: 2,
  },
  place: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2.6,
  },
  tagline: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: 1.6,
    marginTop: 14,
  },
  spinner: {
    marginTop: 40,
  },
  preparing: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 14,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  footerTick: {
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(120, 180, 255, 0.85)',
  },
  values: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
});
