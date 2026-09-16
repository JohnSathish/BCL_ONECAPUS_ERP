import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SchoolCrest } from '@/components/school-sis/school-crest';
import { SCHOOL_BRAND } from '@/constants/school-branding';

const ROLES = ['Student', 'Parent', 'Teacher', 'Office'];

export function SchoolWelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[SCHOOL_BRAND.navyDeep, SCHOOL_BRAND.navyMid, '#163a7a']}
        style={[styles.hero, { paddingTop: insets.top + 28 }]}
      >
        <Text style={styles.kicker}>School ERP</Text>
        <SchoolCrest size={168} />
        <Text style={styles.name}>{SCHOOL_BRAND.legalName.toUpperCase()}</Text>
        <Text style={styles.motto}>{SCHOOL_BRAND.motto}</Text>
        <View style={styles.goldBar} />
        <Text style={styles.address}>{SCHOOL_BRAND.addressLine}</Text>
        <Text style={styles.addressSub}>
          {SCHOOL_BRAND.district}, {SCHOOL_BRAND.state} {SCHOOL_BRAND.pin}
        </Text>
        <View style={styles.roleRow}>
          {ROLES.map((role) => (
            <View key={role} style={styles.roleChip}>
              <Text style={styles.roleText}>{role}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.welcome}>Welcome to the school app</Text>
        <Text style={styles.lead}>
          Attendance, timetable, fees, exams, notices and more — signed in with your school account.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign in"
          onPress={() => router.push('/(auth)/login')}
        >
          <LinearGradient
            colors={[SCHOOL_BRAND.navyMid, '#2436a0']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>Sign in</Text>
          </LinearGradient>
        </Pressable>
        <Text style={styles.footer}>A dedicated app for {SCHOOL_BRAND.shortName}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SCHOOL_BRAND.cream },
  hero: { paddingHorizontal: 24, paddingBottom: 36, alignItems: 'center' },
  kicker: {
    color: SCHOOL_BRAND.gold,
    fontWeight: '800',
    letterSpacing: 2,
    fontSize: 12,
    marginBottom: 16,
  },
  name: {
    marginTop: 16,
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 0.4,
    lineHeight: 24,
  },
  motto: { marginTop: 8, color: SCHOOL_BRAND.gold, fontWeight: '700', fontSize: 13 },
  goldBar: {
    width: 56,
    height: 3,
    borderRadius: 2,
    backgroundColor: SCHOOL_BRAND.gold,
    marginVertical: 12,
  },
  address: { color: '#e8eefc', fontWeight: '700', fontSize: 15 },
  addressSub: { color: '#b7c4e6', marginTop: 4, fontSize: 13 },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 18,
    justifyContent: 'center',
  },
  roleChip: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  roleText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  sheet: {
    flex: 1,
    marginTop: -18,
    backgroundColor: SCHOOL_BRAND.cream,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  welcome: { fontSize: 22, fontWeight: '800', color: SCHOOL_BRAND.navyDeep },
  lead: { marginTop: 8, color: '#4a5568', lineHeight: 22, fontSize: 15 },
  cta: {
    marginTop: 24,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 17 },
  footer: { marginTop: 18, textAlign: 'center', color: '#7b8494', fontSize: 12 },
});
